import { Capability } from "../../schema";
import { ExecutionOptions, ExecutionResult } from "./execution";
import type { Intent } from "./intent";
export type Strategy = Intent[];

export interface StrategyExecutionOptions extends ExecutionOptions {
    transactional?: boolean;
    continueOnError?: boolean;
}

export interface ParameterRequest {
    capabilityId: string;
    parameter: string;
    description: string;
    type: string;
    isSensitive: boolean;
}

export interface StrategyResult {
    success: boolean;
    results: ExecutionResult[];
    error?: {
        code: string;
        message: string;
        stepIndex?: number;
    };
    isPaused?: boolean;
    requiredInputs?: ParameterRequest[];
    resumeToken?: string;
    completedSteps: number;
    rolledBack?: boolean;
    rollbackErrors?: string[];
}

export interface ExecutionState {
    strategy: Intent[];
    currentIndex: number;
    results: ExecutionResult[];
    accumulatedContext: Record<string, unknown>;
    collectedParameters: Map<number, Record<string, unknown>>;
    executedSteps: ExecutedStep[];
    options: StrategyExecutionOptions;
}

export interface ExecutedStep {
    intent: Intent;
    result: ExecutionResult;
    capability: Capability;
}