import type { HandlerFunction } from './types';

export interface HandlerExecutionResult {
    success: boolean;
    data?: unknown;
    error?: {
        message: string;
        isTimeout: boolean;
        originalError?: unknown;
    };
    executionTime: number;
}

export class HandlerExecutor {
    private readonly DEFAULT_TIMEOUT = 5000;

    async execute(
        handler: HandlerFunction,
        parameters: Record<string, unknown>,
        timeout: number = this.DEFAULT_TIMEOUT
    ): Promise<HandlerExecutionResult> {
        const startTime = Date.now();
        let timer: NodeJS.Timeout | undefined;

        try {

            if (!this.validateHandler(handler)) {
                throw new Error('Handler must be a function');
            }
            const timeoutPromise = new Promise<never>((_, reject) => {
                timer = setTimeout(() => {
                    reject(new Error(`Handler execution timeout after ${timeout}ms`));
                }, timeout);
            });

            const result = await Promise.race([
                handler(parameters),
                timeoutPromise
            ]);

            const executionTime = Date.now() - startTime;

            return {
                success: true,
                data: result,
                executionTime
            };

        } catch (error) {
            const executionTime = Date.now() - startTime;
            const isTimeout = error instanceof Error && error.message.includes('timeout');

            return {
                success: false,
                error: {
                    message: error instanceof Error ? error.message : 'Unknown error during handler execution',
                    isTimeout,
                    originalError: error
                },
                executionTime
            };
        } finally {
            if (timer) {
                clearTimeout(timer);
            }
        }
    }

    validateHandler(handler: unknown): handler is HandlerFunction {
        return typeof handler === 'function';
    }
}