export interface ExecutionResult {
    success: boolean;
    data?: unknown;
    error?: ExecutionError;
    sideEffects?: string[];
    suggestions?: string[];
    executionTime?: number;
}

export type ExecutionErrorType = 'VALIDATION_ERROR' | 'PRECONDITION_FAILED' | 'HANDLER_NOT_FOUND' | 'EXECUTION_ERROR' | 'TIMEOUT';

export interface ExecutionError {
    type: ExecutionErrorType;
    message: string;
    details?: unknown;
    capabilityId?: string;
}

export interface AppContext {
    [key: string]: unknown;
}

export interface ExecutionOptions {
    timeout?: number;
    context?: AppContext;
}

export interface PreconditionResult {
    passed: boolean;
    failedCondition?: {
        description: string;
        errorMessage: string;
    };
}

export type HandlerFunction = (params: Record<string, unknown>) => unknown | Promise<unknown>;

export type PreconditionCheckerFunction = (context: AppContext) => boolean | Promise<boolean>;