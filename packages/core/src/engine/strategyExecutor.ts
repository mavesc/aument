import type { Manifest, Capability } from '../schema';
import type { Intent, ExecutionResult, ExecutionState, StrategyExecutionOptions, StrategyResult, ParameterRequest } from './types';
import type { Engine } from './engine';
import { ManifestResolver } from './manifestResolver';

export class StrategyExecutor {
    private pausedExecutions: Map<string, ExecutionState> = new Map();

    constructor(
        private engine: Engine,
        private manifest: Manifest,
        private manifestResolver: ManifestResolver
    ) { }

    async executeStrategy(
        strategy: Intent[],
        options: StrategyExecutionOptions = {}
    ): Promise<StrategyResult> {
        const state: ExecutionState = {
            strategy,
            currentIndex: 0,
            results: [],
            accumulatedContext: options.context || {},
            collectedParameters: new Map(),
            executedSteps: [],
            options
        };

        return this.executeFromState(state);
    }

    async resumeStrategy(
        resumeToken: string,
        additionalParams: Record<string, unknown>
    ): Promise<StrategyResult> {
        const state = this.pausedExecutions.get(resumeToken);
        if (!state) {
            return {
                success: false,
                results: [],
                error: {
                    code: 'INVALID_RESUME_TOKEN',
                    message: 'Resume token not found or expired'
                },
                completedSteps: 0
            };
        }

        state.collectedParameters.set(state.currentIndex, additionalParams);
        this.pausedExecutions.delete(resumeToken);

        return this.executeFromState(state);
    }

    private async executeFromState(state: ExecutionState): Promise<StrategyResult> {
        while (state.currentIndex < state.strategy.length) {
            const intent = state.strategy[state.currentIndex]!;
            const capability = this.manifestResolver.getCapability(this.manifest, intent.capabilityId);

            if (!capability) {
                return this.handleFailureWithRollback(
                    state,
                    'CAPABILITY_NOT_FOUND',
                    `Capability "${intent.capabilityId}" not found`
                );
            }

            const missingParams = this.findMissingOnDemandParams(
                capability,
                intent.parameters,
                state.collectedParameters.get(state.currentIndex)
            );

            if (missingParams.length > 0) {
                return this.pauseForCollection(state, missingParams);
            }

            const mergedIntent = this.mergeParameters(
                intent,
                state.collectedParameters.get(state.currentIndex)
            );

            const result = await this.engine.execute(mergedIntent, {
                ...state.options,
                context: state.accumulatedContext
            });

            state.results.push(result);

            if (!result.success) {
                if (state.options.continueOnError && this.isNonCriticalError(result)) {
                    state.currentIndex++;
                    continue;
                }

                return this.handleFailureWithRollback(
                    state,
                    result.error?.type || 'EXECUTION_ERROR',
                    result.error?.message || 'Intent execution failed'
                );
            }
            //this becomes helpful for potential rollback
            state.executedSteps.push({
                intent: mergedIntent,
                result,
                capability
            });

            if (result.data) {
                state.accumulatedContext = {
                    ...state.accumulatedContext,
                    ...(result.data as any).data
                };
            }

            state.currentIndex++;
        }

        return {
            success: true,
            results: state.results,
            completedSteps: state.results.length
        };
    }

    private findMissingOnDemandParams(
        capability: Capability,
        providedParams: Record<string, unknown>,
        collectedParams?: Record<string, unknown>
    ): ParameterRequest[] {
        const allProvidedParams = {
            ...providedParams,
            ...(collectedParams || {})
        };

        const missingParams: ParameterRequest[] = [];

        for (const param of capability.parameters) {
            if (param.collectionApproach === 'on-demand' && param.isRequired) {
                const value = allProvidedParams[param.name];

                if (value === undefined || value === null) {
                    missingParams.push({
                        capabilityId: capability.id,
                        parameter: param.name,
                        description: param.description,
                        type: param.type,
                        isSensitive: param.isSensitive || false
                    });
                }
            }
        }

        return missingParams;
    }

    private mergeParameters(
        intent: Intent,
        collectedParams?: Record<string, unknown>
    ): Intent {
        if (!collectedParams || Object.keys(collectedParams).length === 0) {
            return intent;
        }

        return {
            ...intent,
            parameters: {
                ...intent.parameters,
                ...collectedParams
            }
        };
    }

    private pauseForCollection(
        state: ExecutionState,
        requiredInputs: ParameterRequest[]
    ): StrategyResult {
        const resumeToken = this.generateResumeToken();
        this.pausedExecutions.set(resumeToken, state);

        return {
            success: false,
            results: state.results,
            paused: true,
            requiredInputs,
            resumeToken,
            completedSteps: state.results.length
        };
    }

    private async handleFailureWithRollback(
        state: ExecutionState,
        code: string,
        message: string
    ): Promise<StrategyResult> {
        const completedSteps = state.results.filter(r => r.success).length
        if (!state.options.transactional || state.executedSteps.length === 0) {
            return {
                success: false,
                results: state.results,
                error: {
                    code,
                    message,
                    stepIndex: state.currentIndex
                },
                completedSteps
            };
        }

        const rollbackErrors: string[] = [];

        for (let i = state.executedSteps.length - 1; i >= 0; i--) {
            const step = state.executedSteps[i]!;
            if (!step.capability.undoCapabilityId) {
                rollbackErrors.push(
                    `Cannot undo "${step.capability.id}" - no undoHandler defined`
                );
                continue;
            }

            try {
                const undoCapabilityId = step.capability.undoCapabilityId;

                const undoIntent: Intent = {
                    capabilityId: undoCapabilityId,
                    parameters: step.intent.parameters
                };

                const undoResult = await this.engine.execute(undoIntent, {
                    context: state.accumulatedContext
                });

                if (!undoResult.success) {
                    rollbackErrors.push(
                        `Failed to undo "${step.capability.id}": ${undoResult.error?.message || 'Unknown error'}`
                    );
                    break;
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                rollbackErrors.push(
                    `Exception during undo of "${step.capability.id}": ${errorMessage}`
                );
                break;
            }
        }

        return {
            success: false,
            results: state.results,
            error: {
                code,
                message,
                stepIndex: state.currentIndex
            },
            completedSteps,
            rolledBack: true,
            rollbackErrors: rollbackErrors.length > 0 ? rollbackErrors : []
        };
    }

    private isNonCriticalError(result: ExecutionResult): boolean {
        const nonCriticalErrorTypes = ['PRECONDITION_FAILED', 'VALIDATION_WARNING'];
        return result.error?.type !== undefined && nonCriticalErrorTypes.includes(result.error.type);
    }

    private generateResumeToken(): string {
        return `resume_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }
}