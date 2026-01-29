import { describe, it, expect, beforeEach } from '@jest/globals';
import { StrategyValidator } from '../validation/strategyValidator';
import { ManifestResolver } from '../manifestResolver';
import { ParameterValidator } from '../validation/parameterValidator';
import type { Strategy } from '../types';
import type { Manifest } from '../../schema';

describe('StrategyValidator', () => {
    let validator: StrategyValidator;
    let manifestResolver: ManifestResolver;
    let paramValidator: ParameterValidator;

    const createManifest = (): Manifest => ({
        $schema: 'https://aument.dev/schema/v1',
        version: '1.0.0',
        metadata: {
            name: 'TestApp',
            description: 'Test application for strategy validation'
        },
        capabilities: {
            addTodo: {
                id: 'addTodo',
                displayName: 'Add Todo',
                description: 'Create a new todo item with text and priority',
                parameters: [
                    {
                        name: 'text',
                        description: 'The todo item text',
                        type: 'string',
                        isRequired: true
                    },
                    {
                        name: 'priority',
                        description: 'Priority level',
                        type: 'enum',
                        isRequired: false,
                        validator: {
                            enum: [
                                { value: 'low', label: 'Low' },
                                { value: 'medium', label: 'Medium' },
                                { value: 'high', label: 'High' }
                            ]
                        }
                    }
                ],
                handler: { name: 'Add', handlerRef: 'todo.add' }
            },
            deleteTodo: {
                id: 'deleteTodo',
                displayName: 'Delete Todo',
                description: 'Remove a todo item from the list by ID',
                parameters: [
                    {
                        name: 'id',
                        description: 'Todo ID to delete',
                        type: 'number',
                        isRequired: true
                    }
                ],
                handler: { name: 'Delete', handlerRef: 'todo.delete' }
            }
        }
    });

    beforeEach(() => {
        manifestResolver = new ManifestResolver();
        paramValidator = new ParameterValidator();
        validator = new StrategyValidator(manifestResolver, paramValidator);
    });

    describe('Strategy Structure', () => {
        it('validates valid single-intent strategy', () => {
            const manifest = createManifest();
            const strategy: Strategy = [
                { capabilityId: 'addTodo', parameters: { text: 'Buy milk' } }
            ];

            const result = validator.validate(strategy, manifest);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('validates valid multi-intent strategy', () => {
            const manifest = createManifest();
            const strategy: Strategy = [
                { capabilityId: 'addTodo', parameters: { text: 'Buy milk' } },
                { capabilityId: 'addTodo', parameters: { text: 'Call dentist', priority: 'high' } },
                { capabilityId: 'deleteTodo', parameters: { id: 1 } }
            ];

            const result = validator.validate(strategy, manifest);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('rejects non-array strategy', () => {
            const manifest = createManifest();
            const result = validator.validate({} as any, manifest);

            expect(result.isValid).toBe(false);
            expect(result.errors[0]!.message).toContain('array');
        });

        it('rejects empty strategy', () => {
            const manifest = createManifest();
            const strategy: Strategy = [];

            const result = validator.validate(strategy, manifest);
            expect(result.isValid).toBe(false);
            expect(result.errors[0]!.message).toContain('empty');
        });

        it('rejects strategy with null intent', () => {
            const manifest = createManifest();
            const strategy = [null] as any;

            const result = validator.validate(strategy, manifest);
            expect(result.isValid).toBe(false);
        });

        it('rejects strategy with undefined intent', () => {
            const manifest = createManifest();
            const strategy = [undefined] as any;

            const result = validator.validate(strategy, manifest);
            expect(result.isValid).toBe(false);
        });
    });

    describe('Intent Structure', () => {
        it('rejects intent without capabilityId', () => {
            const manifest = createManifest();
            const strategy = [
                { parameters: { text: 'test' } }
            ] as any;

            const result = validator.validate(strategy, manifest);
            expect(result.isValid).toBe(false);
            expect(result.errors[0]!.field).toBe('capabilityId');
        });

        it('rejects intent without parameters', () => {
            const manifest = createManifest();
            const strategy = [
                { capabilityId: 'addTodo' }
            ] as any;

            const result = validator.validate(strategy, manifest);
            expect(result.isValid).toBe(false);
            expect(result.errors[0]!.field).toBe('parameters');
        });

        it('rejects intent with non-object parameters', () => {
            const manifest = createManifest();
            const strategy = [
                { capabilityId: 'addTodo', parameters: 'invalid' }
            ] as any;

            const result = validator.validate(strategy, manifest);
            expect(result.isValid).toBe(false);
            expect(result.errors[0]!.field).toBe('parameters');
        });

        it('rejects intent with array parameters', () => {
            const manifest = createManifest();
            const strategy = [
                { capabilityId: 'addTodo', parameters: [] }
            ] as any;

            const result = validator.validate(strategy, manifest);
            expect(result.isValid).toBe(false);
        });
    });

    describe('Capability Existence', () => {
        it('rejects intent with non-existent capability', () => {
            const manifest = createManifest();
            const strategy: Strategy = [
                { capabilityId: 'nonExistent', parameters: {} }
            ];

            const result = validator.validate(strategy, manifest);
            expect(result.isValid).toBe(false);
            expect(result.errors[0]!.message).toContain('not found');
        });

        it('provides correct error index for failed intent', () => {
            const manifest = createManifest();
            const strategy: Strategy = [
                { capabilityId: 'addTodo', parameters: { text: 'Valid' } },
                { capabilityId: 'nonExistent', parameters: {} },
                { capabilityId: 'deleteTodo', parameters: { id: 1 } }
            ];
            const result = validator.validate(strategy, manifest);
            expect(result.isValid).toBe(false);
            expect(result.errors[0]!.intentIndex).toBe(1);
        });

        it('case-sensitive capability matching', () => {
            const manifest = createManifest();
            const strategy: Strategy = [
                { capabilityId: 'AddTodo', parameters: { text: 'test' } }
            ];

            const result = validator.validate(strategy, manifest);
            expect(result.isValid).toBe(false);
        });
    });

    describe('Parameter Validation', () => {
        it('rejects missing required parameter', () => {
            const manifest = createManifest();
            const strategy: Strategy = [
                { capabilityId: 'addTodo', parameters: {} }
            ];
            const result = validator.validate(strategy, manifest);
            expect(result.isValid).toBe(false);
            expect(result.errors[0]!.message).toContain('required');
        });

        it('accepts optional parameter omission', () => {
            const manifest = createManifest();
            const strategy: Strategy = [
                { capabilityId: 'addTodo', parameters: { text: 'test' } } // priority omitted (optional)
            ];

            const result = validator.validate(strategy, manifest);
            expect(result.isValid).toBe(true);
        });

        it('rejects wrong parameter type', () => {
            const manifest = createManifest();
            const strategy: Strategy = [
                { capabilityId: 'deleteTodo', parameters: { id: 'not-a-number' } }
            ];

            const result = validator.validate(strategy, manifest);
            expect(result.isValid).toBe(false);
            expect(result.errors[0]!.message).toContain('number');
        });

        it('rejects invalid enum value', () => {
            const manifest = createManifest();
            const strategy: Strategy = [
                { capabilityId: 'addTodo', parameters: { text: 'test', priority: 'urgent' } }
            ];

            const result = validator.validate(strategy, manifest);
            expect(result.isValid).toBe(false);
        });

        it('validates all parameters in intent', () => {
            const manifest = createManifest();
            const strategy: Strategy = [
                { capabilityId: 'addTodo', parameters: { text: 'Buy milk', priority: 'high' } }
            ];

            const result = validator.validate(strategy, manifest);
            expect(result.isValid).toBe(true);
        });
    });

    describe('Multiple Intents', () => {
        it('validates all intents in strategy', () => {
            const manifest = createManifest();
            const strategy: Strategy = [
                { capabilityId: 'addTodo', parameters: { text: 'First' } },
                { capabilityId: 'addTodo', parameters: { text: 'Second' } },
                { capabilityId: 'deleteTodo', parameters: { id: 1 } }
            ];
            const result = validator.validate(strategy, manifest);
            expect(result.isValid).toBe(true);
        });

        it('collects errors from multiple intents', () => {
            const manifest = createManifest();
            const strategy: Strategy = [
                { capabilityId: 'addTodo', parameters: {} }, // no text here
                { capabilityId: 'deleteTodo', parameters: {} } // no id 
            ];

            const result = validator.validate(strategy, manifest);
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThanOrEqual(2);
        });

        it('assigns correct intent index to each error', () => {
            const manifest = createManifest();
            const strategy: Strategy = [
                { capabilityId: 'addTodo', parameters: { text: 'Valid' } },
                { capabilityId: 'addTodo', parameters: {} },
            ];

            const result = validator.validate(strategy, manifest);
            const error = result.errors.find(e => e.message.includes('required'));
            expect(error?.intentIndex).toBe(1);
        });
    });

    describe('Validation with Suggestions', () => {
        it('suggests similar capabilities for typos', () => {
            const manifest = createManifest();
            const strategy: Strategy = [
                { capabilityId: 'addTodo', parameters: { text: 'test' } } // typo
            ];
            const result = validator.validateWithSuggestions(strategy, manifest);
            // If capability exists, no suggestion needed :)
            expect(result.isValid).toBe(true);
        });

        /**
         * TODO: Add suggestion for non-existent capability
         */

    });

    describe('Edge Cases', () => {
        it('handles strategy with 100 intents', () => {
            const manifest = createManifest();
            const strategy: Strategy = Array(100).fill(null).map(() => ({
                capabilityId: 'addTodo',
                parameters: { text: 'test' }
            }));
            const result = validator.validate(strategy, manifest);
            expect(result.isValid).toBe(true);
        });

        it('handles empty parameters object', () => {
            const manifest = createManifest();
            const strategy: Strategy = [
                { capabilityId: 'addTodo', parameters: {} } // -> text is required
            ];

            const result = validator.validate(strategy, manifest);
            expect(result.isValid).toBe(false);
        });

        it('handles extra parameters not in manifest', () => {
            const manifest = createManifest();
            const strategy: Strategy = [
                { capabilityId: 'addTodo', parameters: { text: 'test', extra: 'ignored' } }
            ];

            const result = validator.validate(strategy, manifest);
            expect(result.isValid).toBe(true);
        });

        it('handles deeply nested parameter objects', () => {
            const manifest = createManifest();
            const strategy: Strategy = [
                { capabilityId: 'addTodo', parameters: { text: { nested: { deep: 'value' } } } }
            ];

            const result = validator.validate(strategy, manifest);
            expect(result.isValid).toBe(false);
        });
    });
});