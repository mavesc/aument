import { describe, it, expect, beforeEach } from '@jest/globals';
import { HandlerExecutor } from '../handlerExecutor';

describe('HandlerExecutor', () => {
    let executor: HandlerExecutor;

    const syncHandler = (result: any) => (params: any) => result;
    const asyncHandler = (result: any) => async (params: any) => result;
    const delayedHandler = (ms: number, result: any) => async (params: any) => {
        await new Promise(resolve => setTimeout(resolve, ms));
        return result;
    };
    const throwingHandler = (error: string) => (params: any) => {
        throw new Error(error);
    };

    beforeEach(() => {
        executor = new HandlerExecutor();
    });

    describe('Successful Execution', () => {
        it('executes sync handler successfully', async () => {
            const handler = syncHandler({ id: 1, text: 'Buy milk' });
            const result = await executor.execute(handler, { text: 'Buy milk' });

            expect(result.success).toBe(true);
            expect(result.data).toEqual({ id: 1, text: 'Buy milk' });
            expect(result.error).toBeUndefined();
            expect(result.executionTime).toBeGreaterThanOrEqual(0);
        });

        it('executes async handler successfully', async () => {
            const handler = asyncHandler('async result');
            const result = await executor.execute(handler, {});

            expect(result.success).toBe(true);
            expect(result.data).toBe('async result');
        });

        it('passes parameters to handler', async () => {
            let receivedParams: any = null;
            const handler = (params: any) => {
                receivedParams = params;
                return 'ok';
            };

            await executor.execute(handler, { a: 1, b: 'test' });

            expect(receivedParams).toEqual({ a: 1, b: 'test' });
        });

        it('returns different data types correctly', async () => {
            const testCases = [
                { handler: syncHandler('string'), expected: 'string' },
                { handler: syncHandler(123), expected: 123 },
                { handler: syncHandler(true), expected: true },
                { handler: syncHandler(null), expected: null },
                { handler: syncHandler({ key: 'value' }), expected: { key: 'value' } },
                { handler: syncHandler([1, 2, 3]), expected: [1, 2, 3] }
            ];

            for (const { handler, expected } of testCases) {
                const result = await executor.execute(handler, {});
                expect(result.success).toBe(true);
                expect(result.data).toEqual(expected);
            }
        });

        it('handles undefined return value', async () => {
            const handler = () => undefined;
            const result = await executor.execute(handler, {});

            expect(result.success).toBe(true);
            expect(result.data).toBeUndefined();
        });

        it('tracks execution time accurately', async () => {
            const handler = delayedHandler(50, 'result');
            const result = await executor.execute(handler, {});

            expect(result.success).toBe(true);
            expect(result.executionTime).toBeGreaterThanOrEqual(50);
            expect(result.executionTime).toBeLessThan(100);
        });
    });

    describe('Error Handling', () => {
        it('catches synchronous errors', async () => {
            const handler = throwingHandler('Sync error');
            const result = await executor.execute(handler, {});

            expect(result.success).toBe(false);
            expect(result.error?.message).toBe('Sync error');
            expect(result.error?.isTimeout).toBe(false);
            expect(result.data).toBeUndefined();
        });

        it('catches asynchronous errors', async () => {
            const handler = async () => {
                throw new Error('Async error');
            };
            const result = await executor.execute(handler, {});

            expect(result.success).toBe(false);
            expect(result.error?.message).toBe('Async error');
        });

        it('preserves original error in details', async () => {
            const originalError = new Error('Original');
            const handler = () => { throw originalError; };
            const result = await executor.execute(handler, {});

            expect(result.error?.originalError).toBe(originalError);
        });

        it('handles non-Error thrown values', async () => {
            const testCases = [
                { thrown: 'string error', expected: 'Unknown error' },
                { thrown: 123, expected: 'Unknown error' },
                { thrown: null, expected: 'Unknown error' }
            ];

            for (const { thrown } of testCases) {
                const handler = () => { throw thrown; };
                const result = await executor.execute(handler, {});

                expect(result.success).toBe(false);
                expect(result.error?.message).toContain('Unknown error');
            }
        });

        it('tracks execution time even on error', async () => {
            const handler = async () => {
                await new Promise(resolve => setTimeout(resolve, 50));
                throw new Error('Failed');
            };
            const result = await executor.execute(handler, {});

            expect(result.success).toBe(false);
            expect(result.executionTime).toBeGreaterThanOrEqual(50);
        });
    });

    describe('Timeout Handling', () => {
        it('times out handler exceeding timeout', async () => {
            const handler = delayedHandler(200, 'too slow');
            const result = await executor.execute(handler, {}, 100);

            expect(result.success).toBe(false);
            expect(result.error?.isTimeout).toBe(true);
            expect(result.error?.message).toContain('timeout');
        });

        it('succeeds when handler completes within timeout', async () => {
            const handler = delayedHandler(50, 'fast enough');
            const result = await executor.execute(handler, {}, 100);

            expect(result.success).toBe(true);
            expect(result.data).toBe('fast enough');
        });

        it('uses default timeout of 5000ms', async () => {
            const handler = delayedHandler(100, 'result');
            const result = await executor.execute(handler, {});

            expect(result.success).toBe(true);
        });

        it('respects custom timeout', async () => {
            const handler = delayedHandler(150, 'result');

            const shortTimeout = await executor.execute(handler, {}, 100);
            const longTimeout = await executor.execute(handler, {}, 200);

            expect(shortTimeout.success).toBe(false);
            expect(shortTimeout.error?.isTimeout).toBe(true);
            expect(longTimeout.success).toBe(true);
        });

        it('handles very short timeouts', async () => {
            const handler = delayedHandler(50, 'result');
            const result = await executor.execute(handler, {}, 10);

            expect(result.success).toBe(false);
            expect(result.error?.isTimeout).toBe(true);
        });

        it('handles very long timeouts', async () => {
            const handler = delayedHandler(10, 'result');
            const result = await executor.execute(handler, {}, 10000);

            expect(result.success).toBe(true);
        });
    });

    describe('validateHandler()', () => {
        it('validates function as handler', () => {
            expect(executor.validateHandler(() => { })).toBe(true);
            expect(executor.validateHandler(async () => { })).toBe(true);
            expect(executor.validateHandler(function () { })).toBe(true);
        });

        it('rejects non-function values', () => {
            expect(executor.validateHandler('string')).toBe(false);
            expect(executor.validateHandler(123)).toBe(false);
            expect(executor.validateHandler({})).toBe(false);
            expect(executor.validateHandler([])).toBe(false);
            expect(executor.validateHandler(null)).toBe(false);
            expect(executor.validateHandler(undefined)).toBe(false);
        });

        it('validates class methods', () => {
            class Service {
                method() { return 'result'; }
            }
            const service = new Service();
            expect(executor.validateHandler(service.method)).toBe(true);
        });
    });

    describe('Parameter Handling', () => {
        it('handles empty parameters object', async () => {
            const handler = (params: any) => Object.keys(params).length;
            const result = await executor.execute(handler, {});

            expect(result.success).toBe(true);
            expect(result.data).toBe(0);
        });

        it('handles complex parameter objects', async () => {
            const complexParams = {
                string: 'text',
                number: 42,
                boolean: true,
                array: [1, 2, 3],
                nested: { deep: { value: 'nested' } }
            };

            const handler = (params: any) => params;
            const result = await executor.execute(handler, complexParams);

            expect(result.success).toBe(true);
            expect(result.data).toEqual(complexParams);
        });

        it('handles null and undefined parameters', async () => {
            const handler = (params: any) => params;

            const nullResult = await executor.execute(handler, { value: null });
            const undefinedResult = await executor.execute(handler, { value: undefined });

            expect(nullResult.success).toBe(true);
            expect(nullResult.data).toEqual({ value: null });
            expect(undefinedResult.success).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        it('handles handler returning Promise.resolve', async () => {
            const handler = () => Promise.resolve('resolved');
            const result = await executor.execute(handler, {});

            expect(result.success).toBe(true);
            expect(result.data).toBe('resolved');
        });

        it('handles handler returning Promise.reject', async () => {
            const handler = () => Promise.reject(new Error('rejected'));
            const result = await executor.execute(handler, {});

            expect(result.success).toBe(false);
            expect(result.error?.message).toBe('rejected');
        });

        it('handles handler with multiple async operations', async () => {
            const handler = async () => {
                await Promise.all([
                    new Promise(resolve => setTimeout(resolve, 10)),
                    new Promise(resolve => setTimeout(resolve, 20)),
                    new Promise(resolve => setTimeout(resolve, 30))
                ]);
                return 'done';
            };

            const result = await executor.execute(handler, {});

            expect(result.success).toBe(true);
            expect(result.data).toBe('done');
        });

        it('handles recursive handler calls', async () => {
            const handler = (params: any): any => {
                if (params.depth === 0) return 'done';
                return handler({ depth: params.depth - 1 });
            };

            const result = await executor.execute(handler, { depth: 5 });

            expect(result.success).toBe(true);
            expect(result.data).toBe('done');
        });

        it('handles handler modifying parameters', async () => {
            const params = { value: 1 };
            const handler = (p: any) => {
                p.value = 999;
                return p.value;
            };

            const result = await executor.execute(handler, params);

            expect(result.success).toBe(true);
            expect(params.value).toBe(999);
        });

        it('handles zero timeout gracefully', async () => {
            const handler = syncHandler('instant');
            const result = await executor.execute(handler, {}, 0);

            expect(result.success).toBe(true);
        });

        it('handles concurrent executions', async () => {
            const handler = delayedHandler(50, 'result');

            const results = await Promise.all([
                executor.execute(handler, { id: 1 }),
                executor.execute(handler, { id: 2 }),
                executor.execute(handler, { id: 3 })
            ]);

            results.forEach(result => {
                expect(result.success).toBe(true);
            });
        });

        it('measures execution time for very fast handlers', async () => {
            const handler = () => 'instant';
            const result = await executor.execute(handler, {});

            expect(result.executionTime).toBeGreaterThanOrEqual(0);
            expect(result.executionTime).toBeLessThan(10);
        });
    });
});