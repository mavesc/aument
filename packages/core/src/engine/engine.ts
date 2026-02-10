import type { Capability, Manifest } from '../schema';
import type { Intent } from './types';
import type { ExecutionResult, ExecutionOptions, HandlerFunction, PreconditionCheckerFunction } from './types';
import { ManifestResolver } from './manifestResolver';
import { StrategyValidator } from './validation/strategyValidator';
import { ParameterValidator } from './validation/parameterValidator';
import { HandlerRegistry } from './handlerRegistry';
import { PreconditionChecker } from './preconditionChecker';
import { HandlerExecutor } from './handlerExecutor';
import { ResultFormatter } from './resultFormatter';

export class Engine {
    private manifestResolver: ManifestResolver;
    private strategyValidator: StrategyValidator;
    private handlerRegistry: HandlerRegistry;
    private preconditionChecker: PreconditionChecker;
    private handlerExecutor: HandlerExecutor;
    private resultFormatter: ResultFormatter;

    constructor(
        private manifest: Manifest,
        handlers: Record<string, HandlerFunction>,
        checkers?: Record<string, PreconditionCheckerFunction>
    ) {
        this.manifestResolver = new ManifestResolver();
        this.manifestResolver.load(manifest);

        const paramValidator = new ParameterValidator();
        this.strategyValidator = new StrategyValidator(this.manifestResolver, paramValidator);
        this.handlerRegistry = new HandlerRegistry();
        this.preconditionChecker = new PreconditionChecker();
        this.handlerExecutor = new HandlerExecutor();
        this.resultFormatter = new ResultFormatter();

        this.handlerRegistry.registerMany(handlers);

        if (checkers) {
            this.preconditionChecker.registerMany(checkers);
        }

        this.validateHandlerBindings();
    }

    async execute(intent: Intent, options: ExecutionOptions = {}): Promise<ExecutionResult> {
        const { timeout, context = {} } = options;

        const validationResult = this.strategyValidator.validate([intent], this.manifest, options.context);
        if (!validationResult.isValid) {
            const firstError = validationResult.errors[0];
            return this.resultFormatter.formatValidationError(
                firstError!.message,
                intent.capabilityId
            );
        }

        const capability = this.manifestResolver.getCapability(this.manifest, intent.capabilityId);
        if (!capability) {
            return this.resultFormatter.formatError(
                'VALIDATION_ERROR',
                `Capability "${intent.capabilityId}" not found`,
                undefined,
                intent.capabilityId
            );
        }

        const preconditionResult = await this.preconditionChecker.checkAll(
            capability.preconditions,
            context
        );

        if (!preconditionResult.passed && preconditionResult.failedCondition) {
            return this.resultFormatter.formatPreconditionFailure(
                preconditionResult.failedCondition.errorMessage,
                preconditionResult.failedCondition.description,
                intent.capabilityId
            );
        }

        const handlerRef = capability.handler.handlerRef;
        const handler = this.handlerRegistry.get(handlerRef);

        if (!handler) {
            return this.resultFormatter.formatError(
                'HANDLER_NOT_FOUND',
                `Handler "${handlerRef}" not registered`,
                undefined,
                intent.capabilityId
            );
        }
        const handlerResult = await this.handlerExecutor.execute(
            handler,
            intent.parameters,
            timeout
        );

        if (handlerResult.success) {
            return this.resultFormatter.formatSuccess(handlerResult, capability);
        } else {
            return this.resultFormatter.formatHandlerError(handlerResult, intent.capabilityId);
        }
    }

    getCapabilityGraph(): CapabilityGraph {
        const capabilities = Object.values(this.manifest.capabilities).map(cap => ({
            id: cap.id,
            displayName: cap.displayName,
            description: cap.description,
            examples: cap.examples ?? [],
            parameters: cap.parameters.map(p => ({
                name: p.name,
                description: p.description,
                type: p.type,
                isRequired: p.isRequired,
                examples: p.examples ?? []
            }))
        }));

        return {
            appName: this.manifest.metadata.name,
            appDescription: this.manifest.metadata.description,
            capabilities
        };
    }

    // If required, extra preconditions and handlers can be added after the Engine is created:

    registerHandler(handlerRef: string, handler: HandlerFunction): void {
        this.handlerRegistry.register(handlerRef, handler);
    }

    registerChecker(checkerRef: string, checker: PreconditionCheckerFunction): void {
        this.preconditionChecker.registerChecker(checkerRef, checker);
    }

    getHandlerRef(capabilities: Record<string, Capability>, capId: string): string {
        return Object.values(capabilities)
            .filter((cap) => cap.id === capId)
            .map((cap) => cap.handler.handlerRef)[0] || "";
    }

    private validateHandlerBindings(): void {
        const missingHandlers: string[] = [];

        for (const capability of Object.values(this.manifest.capabilities)) {
            const handlerRef = capability.handler.handlerRef;
            if (!this.handlerRegistry.has(handlerRef)) {
                missingHandlers.push(handlerRef);
            }

            if (capability.undoCapabilityId) {
                const undoRef = this.getHandlerRef(this.manifest.capabilities, capability.undoCapabilityId);
                if (!this.handlerRegistry.has(undoRef)) {
                    missingHandlers.push(undoRef);
                }
            }
        }

        if (missingHandlers.length > 0) {
            throw new Error(
                `Missing handler registrations: ${missingHandlers.join(', ')}`
            );
        }
    }
}

export interface CapabilityGraph {
    appName: string;
    appDescription: string;
    capabilities: Array<{
        id: string;
        displayName: string;
        description: string;
        examples?: string[];
        parameters: Array<{
            name: string;
            description: string;
            type: string;
            isRequired: boolean;
            examples?: unknown[];
        }>;
    }>;
}