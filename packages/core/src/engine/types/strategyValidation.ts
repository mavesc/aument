export interface StrategyValidationResult {
    isValid: boolean;
    errors: StrategyValidationError[];
}

export interface StrategyDetailedValidationResult extends StrategyValidationResult {
    suggestions: string[];
}

export class StrategyValidationError extends Error {
    constructor(
        message: string,
        public intentIndex: number,
        public field?: string,
        public details?: unknown
    ) {
        super(message);
        this.name = 'StrategyValidationError';
    }
}