import type { ExecutionResult, ExecutionError } from './types';
import type { Capability } from '../schema';
import type { HandlerExecutionResult } from './handlerExecutor';

export class ResultFormatter {

    formatSuccess(
        handlerResult: HandlerExecutionResult,
        capability: Capability
    ): ExecutionResult {
        return {
            success: true,
            data: handlerResult.data,
            sideEffects: this.extractSideEffects(capability),
            executionTime: handlerResult.executionTime
        };
    }

    formatError(
        errorType: ExecutionError['type'],
        message: string,
        details?: unknown,
        capabilityId: string = ""
    ): ExecutionResult {
        return {
            success: false,
            error: {
                type: errorType,
                message,
                details,
                capabilityId
            }
        };
    }

    formatHandlerError(
        handlerResult: HandlerExecutionResult,
        capabilityId: string
    ): ExecutionResult {
        const errorType = handlerResult.error?.isTimeout ? 'TIMEOUT' : 'EXECUTION_ERROR';

        return {
            success: false,
            error: {
                type: errorType,
                message: handlerResult.error?.message || 'Handler execution failed',
                details: handlerResult.error?.originalError,
                capabilityId
            },
            executionTime: handlerResult.executionTime
        };
    }

    formatPreconditionFailure(
        errorMessage: string,
        description: string,
        capabilityId: string
    ): ExecutionResult {
        return {
            success: false,
            error: {
                type: 'PRECONDITION_FAILED',
                message: errorMessage,
                details: { description },
                capabilityId
            }
        };
    }

    formatValidationError(
        message: string,
        capabilityId: string = ""
    ): ExecutionResult {
        return {
            success: false,
            error: {
                type: 'VALIDATION_ERROR',
                message,
                capabilityId
            }
        };
    }

    private extractSideEffects(capability: Capability): string[] {
        if (!capability.sideEffects || capability.sideEffects.length === 0) {
            return [];
        }

        return capability.sideEffects.map(effect => effect.name);
    }

    addSuggestions(result: ExecutionResult, suggestions: string[]): ExecutionResult {
        if (suggestions.length === 0) {
            return result;
        }

        return {
            ...result,
            suggestions
        };
    }
}