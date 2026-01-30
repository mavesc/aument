import { describe, it, expect, beforeEach } from '@jest/globals';
import { ResultFormatter } from '../resultFormatter';
import type { Capability } from '../../schema';
import type { HandlerExecutionResult } from '../handlerExecutor';
import { ExecutionErrorType } from '../types';

describe('ResultFormatter', () => {
    let formatter: ResultFormatter;

    const createCapability = (overrides?: Partial<Capability>): Capability => ({
        id: 'testCapability',
        displayName: 'Test Capability',
        description: 'A test capability for formatting',
        parameters: [],
        handler: { name: 'Test Handler', handlerRef: 'test.handler' },
        ...overrides
    });

    const createHandlerResult = (overrides?: Partial<HandlerExecutionResult>): HandlerExecutionResult => ({
        success: true,
        data: { result: 'test data' },
        executionTime: 100,
        ...overrides
    });

    beforeEach(() => {
        formatter = new ResultFormatter();
    });

    describe('formatSuccess()', () => {
        it('formats basic success result', () => {
            const handlerResult = createHandlerResult();
            const capability = createCapability();

            const result = formatter.formatSuccess(handlerResult, capability);

            expect(result.success).toBe(true);
            expect(result.data).toEqual({ result: 'test data' });
            expect(result.executionTime).toBe(100);
            expect(result.error).toBeUndefined();
        });

        it('includes side effects when present', () => {
            const capability = createCapability({
                sideEffects: [
                    { name: 'todos', properties: {} },
                    { name: 'users', properties: {} }
                ]
            });
            const handlerResult = createHandlerResult();

            const result = formatter.formatSuccess(handlerResult, capability);

            expect(result.sideEffects).toEqual(['todos', 'users']);
        });

        it('excludes side effects when not present', () => {
            const capability = createCapability({});
            const handlerResult = createHandlerResult();

            const result = formatter.formatSuccess(handlerResult, capability);

            expect(result.sideEffects).toEqual([]);
        });

        it('excludes side effects when empty array', () => {
            const capability = createCapability({ sideEffects: [] });
            const handlerResult = createHandlerResult();

            const result = formatter.formatSuccess(handlerResult, capability);

            expect(result.sideEffects).toEqual([]);
        });

        it('preserves handler data types', () => {
            const testCases = [
                { data: 'string', expected: 'string' },
                { data: 123, expected: 123 },
                { data: true, expected: true },
                { data: null, expected: null },
                { data: [1, 2, 3], expected: [1, 2, 3] },
                { data: { nested: { deep: 'value' } }, expected: { nested: { deep: 'value' } } }
            ];

            const capability = createCapability();

            testCases.forEach(({ data, expected }) => {
                const handlerResult = createHandlerResult({ data });
                const result = formatter.formatSuccess(handlerResult, capability);

                expect(result.data).toEqual(expected);
            });
        });

        it('includes execution time from handler', () => {
            const capability = createCapability();
            const handlerResult = createHandlerResult({ executionTime: 250 });

            const result = formatter.formatSuccess(handlerResult, capability);

            expect(result.executionTime).toBe(250);
        });
    });

    describe('formatError()', () => {
        it('formats basic error', () => {
            const result = formatter.formatError(
                'EXECUTION_ERROR',
                'Something went wrong'
            );

            expect(result.success).toBe(false);
            expect(result.error?.type).toBe('EXECUTION_ERROR');
            expect(result.error?.message).toBe('Something went wrong');
            expect(result.data).toBeUndefined();
        });

        it('includes capability ID when provided', () => {
            const result = formatter.formatError(
                'VALIDATION_ERROR',
                'Invalid parameters',
                undefined,
                'addTodo'
            );

            expect(result.error?.capabilityId).toBe('addTodo');
        });

        it('includes error details when provided', () => {
            const details = { field: 'email', constraint: 'format' };
            const result = formatter.formatError(
                'VALIDATION_ERROR',
                'Invalid email',
                details
            );

            expect(result.error?.details).toEqual(details);
        });

        it('handles all error types', () => {
            const errorTypes: Array<ExecutionErrorType> = [
                'VALIDATION_ERROR',
                'PRECONDITION_FAILED',
                'HANDLER_NOT_FOUND',
                'EXECUTION_ERROR',
                'TIMEOUT'
            ];

            errorTypes.forEach(type => {
                const result = formatter.formatError(type, 'Error message');
                expect(result.error?.type).toBe(type);
            });
        });

        it('formats error without optional fields', () => {
            const result = formatter.formatError('EXECUTION_ERROR', 'Failed');

            expect(result.success).toBe(false);
            expect(result.error?.details).toBeUndefined();
            expect(result.error?.capabilityId).toEqual("");
        });
    });

    describe('formatHandlerError()', () => {
        it('formats handler execution error', () => {
            const handlerResult: HandlerExecutionResult = {
                success: false,
                error: {
                    message: 'Handler failed',
                    isTimeout: false,
                    originalError: new Error('Original')
                },
                executionTime: 150
            };

            const result = formatter.formatHandlerError(handlerResult, 'testCapability');

            expect(result.success).toBe(false);
            expect(result.error?.type).toBe('EXECUTION_ERROR');
            expect(result.error?.message).toBe('Handler failed');
            expect(result.error?.capabilityId).toBe('testCapability');
            expect(result.executionTime).toBe(150);
        });

        it('formats timeout error', () => {
            const handlerResult: HandlerExecutionResult = {
                success: false,
                error: {
                    message: 'Handler timeout after 5000ms',
                    isTimeout: true
                },
                executionTime: 5000
            };

            const result = formatter.formatHandlerError(handlerResult, 'slowCapability');

            expect(result.error?.type).toBe('TIMEOUT');
            expect(result.error?.message).toContain('timeout');
        });

        it('includes original error in details', () => {
            const originalError = new Error('Database connection failed');
            const handlerResult: HandlerExecutionResult = {
                success: false,
                error: {
                    message: 'Failed',
                    isTimeout: false,
                    originalError
                },
                executionTime: 50
            };

            const result = formatter.formatHandlerError(handlerResult, 'dbCapability');

            expect(result.error?.details).toBe(originalError);
        });

        it('handles missing error message', () => {
            const handlerResult: HandlerExecutionResult = {
                success: false,
                error: {
                    message: undefined as any,
                    isTimeout: false
                },
                executionTime: 100
            };

            const result = formatter.formatHandlerError(handlerResult, 'testCapability');

            expect(result.error?.message).toBe('Handler execution failed');
        });
    });

    describe('formatPreconditionFailure()', () => {
        it('formats precondition failure', () => {
            const result = formatter.formatPreconditionFailure(
                'Cart is empty',
                'Cart must contain at least one item',
                'placeOrder'
            );

            expect(result.success).toBe(false);
            expect(result.error?.type).toBe('PRECONDITION_FAILED');
            expect(result.error?.message).toBe('Cart is empty');
            expect(result.error?.details).toEqual({
                description: 'Cart must contain at least one item'
            });
            expect(result.error?.capabilityId).toBe('placeOrder');
        });

        it('includes description in details', () => {
            const result = formatter.formatPreconditionFailure(
                'User not logged in',
                'User must be authenticated',
                'checkout'
            );

            expect(result.error?.details).toHaveProperty('description');
            expect((result.error?.details as any).description).toBe('User must be authenticated');
        });
    });

    describe('formatValidationError()', () => {
        it('formats validation error with capability ID', () => {
            const result = formatter.formatValidationError(
                'Parameter "email" is invalid',
                'updateUser'
            );

            expect(result.success).toBe(false);
            expect(result.error?.type).toBe('VALIDATION_ERROR');
            expect(result.error?.message).toBe('Parameter "email" is invalid');
            expect(result.error?.capabilityId).toBe('updateUser');
        });

        it('formats validation error without capability ID', () => {
            const result = formatter.formatValidationError('Invalid strategy structure');

            expect(result.success).toBe(false);
            expect(result.error?.capabilityId).toEqual("");
        });
    });

    describe('addSuggestions()', () => {
        it('adds suggestions to result', () => {
            const baseResult = formatter.formatError('VALIDATION_ERROR', 'Error');
            const suggestions = ['Try "addTodo" instead', 'Check parameter types'];

            const result = formatter.addSuggestions(baseResult, suggestions);

            expect(result.suggestions).toEqual(suggestions);
            expect(result.success).toBe(false);
            expect(result.error?.message).toBe('Error');
        });

        it('returns result unchanged when no suggestions', () => {
            const baseResult = formatter.formatError('EXECUTION_ERROR', 'Failed');
            const result = formatter.addSuggestions(baseResult, []);

            expect(result.suggestions).toBeUndefined();
            expect(result).toEqual(baseResult);
        });

        it('preserves existing result properties', () => {
            const baseResult = formatter.formatSuccess(
                createHandlerResult(),
                createCapability({ sideEffects: [{ name: 'todos', properties: {} }] })
            );

            const result = formatter.addSuggestions(baseResult, ['Suggestion']);

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.sideEffects).toEqual(['todos']);
            expect(result.suggestions).toEqual(['Suggestion']);
        });
    });

    describe('Edge Cases', () => {
        it('handles capability with many side effects', () => {
            const sideEffects = Array(10).fill(null).map((_, i) => ({
                name: `effect${i}`,
                properties: {}
            }));

            const capability = createCapability({ sideEffects });
            const result = formatter.formatSuccess(createHandlerResult(), capability);

            expect(result.sideEffects).toHaveLength(10);
            expect(result.sideEffects?.[0]).toBe('effect0');
            expect(result.sideEffects?.[9]).toBe('effect9');
        });

        it('handles zero execution time', () => {
            const handlerResult = createHandlerResult({ executionTime: 0 });
            const result = formatter.formatSuccess(handlerResult, createCapability());

            expect(result.executionTime).toBe(0);
        });

        it('handles very long execution time', () => {
            const handlerResult = createHandlerResult({ executionTime: 999999 });
            const result = formatter.formatSuccess(handlerResult, createCapability());

            expect(result.executionTime).toBe(999999);
        });

        it('handles complex nested error details', () => {
            const details = {
                errors: [
                    { field: 'email', message: 'Invalid format' },
                    { field: 'age', message: 'Must be positive' }
                ],
                context: { userId: '123', timestamp: '2024-01-01' }
            };

            const result = formatter.formatError('VALIDATION_ERROR', 'Multiple errors', details);

            expect(result.error?.details).toEqual(details);
        });

        it('handles undefined handler data', () => {
            const handlerResult = createHandlerResult({ data: undefined });
            const result = formatter.formatSuccess(handlerResult, createCapability());

            expect(result.success).toBe(true);
            expect(result.data).toBeUndefined();
        });

        it('handles null handler data', () => {
            const handlerResult = createHandlerResult({ data: null });
            const result = formatter.formatSuccess(handlerResult, createCapability());

            expect(result.success).toBe(true);
            expect(result.data).toBeNull();
        });

        it('formats multiple errors sequentially', () => {
            const results = [
                formatter.formatError('VALIDATION_ERROR', 'Error 1'),
                formatter.formatError('EXECUTION_ERROR', 'Error 2'),
                formatter.formatError('TIMEOUT', 'Error 3')
            ];

            results.forEach((result, index) => {
                expect(result.success).toBe(false);
                expect(result.error?.message).toBe(`Error ${index + 1}`);
            });
        });

        it('preserves side effect order', () => {
            const capability = createCapability({
                sideEffects: [
                    { name: 'first', properties: {} },
                    { name: 'second', properties: {} },
                    { name: 'third', properties: {} }
                ]
            });

            const result = formatter.formatSuccess(createHandlerResult(), capability);

            expect(result.sideEffects).toEqual(['first', 'second', 'third']);
        });
    });
});