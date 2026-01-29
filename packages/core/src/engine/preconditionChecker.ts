import type { Precondition } from '../schema';
import type { AppContext, PreconditionResult, PreconditionCheckerFunction } from './types';

export class PreconditionChecker {
    private checkers = new Map<string, PreconditionCheckerFunction>();

    registerChecker(checkerRef: string, checker: PreconditionCheckerFunction): void {
        if (!checkerRef || typeof checkerRef !== 'string') {
            throw new Error('Checker reference must be a non-empty string');
        }

        if (typeof checker !== 'function') {
            throw new Error(`Checker for "${checkerRef}" must be a function`);
        }

        this.checkers.set(checkerRef, checker);
    }

    registerMany(checkers: Record<string, PreconditionCheckerFunction>): void {
        for (const [checkerRef, checker] of Object.entries(checkers)) {
            this.registerChecker(checkerRef, checker);
        }
    }

    async checkAll(
        preconditions: Precondition[] | undefined,
        context: AppContext
    ): Promise<PreconditionResult> {
        if (!preconditions || preconditions.length === 0) {
            return { passed: true };
        }
        for (const precondition of preconditions) {
            const result = await this.checkOne(precondition, context);
            if (!result.passed) {
                return result;
            }
        }

        return { passed: true };
    }

    async checkOne(
        precondition: Precondition,
        context: AppContext
    ): Promise<PreconditionResult> {
        const checkerRef = precondition.checker.handlerRef;
        const checker = this.checkers.get(checkerRef);

        if (!checker) {
            return {
                passed: false,
                failedCondition: {
                    description: precondition.description,
                    errorMessage: `Precondition checker "${checkerRef}" not found`
                }
            };
        }

        try {
            const passed = await checker(context);

            if (!passed) {
                return {
                    passed: false,
                    failedCondition: {
                        description: precondition.description,
                        errorMessage: precondition.errorMessage
                    }
                };
            }

            return { passed: true };
        } catch (error) {
            return {
                passed: false,
                failedCondition: {
                    description: precondition.description,
                    errorMessage: `Precondition check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            };
        }
    }

    getChecker(checkerRef: string): PreconditionCheckerFunction | null {
        return this.checkers.get(checkerRef) || null;
    }

    hasChecker(checkerRef: string): boolean {
        return this.checkers.has(checkerRef);
    }

    unregisterChecker(checkerRef: string): void {
        this.checkers.delete(checkerRef);
    }

    clear(): void {
        this.checkers.clear();
    }
}