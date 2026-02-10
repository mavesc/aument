import { describe, it, expect } from '@jest/globals';
import { Engine } from '../engine';
import type { Manifest } from '../../schema';
import type { Intent } from '../types';
import type { AppContext } from '../types';

describe('Engine (Integration)', () => {
    const createManifest = (overrides?: Partial<Manifest>): Manifest => ({
        $schema: 'https://aument.dev/schema/v1',
        version: '1.0.0',
        metadata: {
            name: 'TodoApp',
            description: 'Simple todo application for testing'
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
                handler: { name: 'Add Todo', handlerRef: 'todo.add' },
                sideEffects: [{ name: 'todos', properties: {} }]
            },
            deleteTodo: {
                id: 'deleteTodo',
                displayName: 'Delete Todo',
                description: 'Remove a todo item by ID',
                parameters: [
                    {
                        name: 'id',
                        description: 'Todo ID to delete',
                        type: 'number',
                        isRequired: true
                    }
                ],
                handler: { name: 'Delete Todo', handlerRef: 'todo.delete' },
                preconditions: [
                    {
                        type: 'state',
                        checker: { name: 'Todo Exists', handlerRef: 'validators.todoExists' },
                        description: 'Todo must exist',
                        errorMessage: 'Todo not found'
                    }
                ],
                sideEffects: [{ name: 'todos', properties: {} }]
            },
            slowOperation: {
                id: 'slowOperation',
                displayName: 'Slow Operation',
                description: 'An operation that takes time',
                parameters: [],
                handler: { name: 'Slow', handlerRef: 'slow.operation' }
            }
        },
        ...overrides
    });

    const createHandlers = (todos: any[] = []) => {
        let nextId = 1;

        return {
            'todo.add': (params: any) => {
                const todo = { id: nextId++, text: params.text, priority: params.priority || 'medium' };
                todos.push(todo);
                return todo;
            },
            'todo.delete': (params: any) => {
                const index = todos.findIndex(t => t.id === params.id);
                if (index !== -1) {
                    const deleted = todos.splice(index, 1)[0];
                    return { deleted: true, todo: deleted };
                }
                throw new Error('Todo not found in handler');
            },
            'slow.operation': async () => {
                await new Promise(resolve => setTimeout(resolve, 200));
                return 'completed';
            }
        };
    };

    const createCheckers = () => {
        const todos: any[] = [];

        return {
            checkers: {
                'validators.todoExists': (ctx: AppContext) => {
                    return (ctx.todos as any[]).some((t: any) => t.id === ctx.todoId);
                }
            },
            addTodo: (todo: any) => todos.push(todo),
            getTodos: () => todos
        };
    };

    describe('Initialization', () => {
        it('initializes with valid manifest and handlers', () => {
            const manifest = createManifest();
            const handlers = createHandlers();

            expect(() => new Engine(manifest, handlers)).not.toThrow();
        });

        it('validates manifest on construction', () => {
            const invalidManifest = { invalid: 'manifest' } as any;
            const handlers = createHandlers();

            expect(() => new Engine(invalidManifest, handlers)).toThrow();
        });

        it('validates all handlers are registered', () => {
            const manifest = createManifest();
            const incompleteHandlers = {
                'todo.add': (params: any) => params
            };

            expect(() => new Engine(manifest, incompleteHandlers)).toThrow(/Missing handler/);
        });

        it('accepts optional precondition checkers', () => {
            const manifest = createManifest();
            const handlers = createHandlers();
            const { checkers } = createCheckers();

            expect(() => new Engine(manifest, handlers, checkers)).not.toThrow();
        });

        it('validates undo handlers are registered', () => {
            const manifest = createManifest({
                capabilities: {
                    withUndo: {
                        id: 'withUndo',
                        displayName: 'With Undo',
                        description: 'Capability with undo handler',
                        parameters: [],
                        handler: { name: 'Main', handlerRef: 'main.handler' },
                        undoCapabilityId: 'undo'
                    }
                }
            });

            const handlers = {
                'main.handler': () => 'done'
            };

            expect(() => new Engine(manifest, handlers)).toThrow(/Undo capability .* not found/);
        });
    });

    describe('Successful Execution', () => {
        it('executes simple intent successfully', async () => {
            const manifest = createManifest();
            const handlers = createHandlers();
            const engine = new Engine(manifest, handlers);

            const intent: Intent = {
                capabilityId: 'addTodo',
                parameters: { text: 'Buy milk' }
            };

            const result = await engine.execute(intent);

            expect(result.success).toBe(true);
            expect(result.data).toMatchObject({ text: 'Buy milk', priority: 'medium' });
            expect(result.sideEffects).toEqual(['todos']);
            expect(result.executionTime).toBeGreaterThanOrEqual(0);
        });

        it('executes intent with all parameters', async () => {
            const manifest = createManifest();
            const handlers = createHandlers();
            const engine = new Engine(manifest, handlers);

            const intent: Intent = {
                capabilityId: 'addTodo',
                parameters: { text: 'Important task', priority: 'high' }
            };

            const result = await engine.execute(intent);

            expect(result.success).toBe(true);
            expect(result.data).toMatchObject({ text: 'Important task', priority: 'high' });
        });

        it('passes context to execution', async () => {
            const manifest = createManifest();
            const handlers = createHandlers();
            const engine = new Engine(manifest, handlers);

            const context: AppContext = {
                user: { id: '123', isLoggedIn: true }
            };

            const intent: Intent = {
                capabilityId: 'addTodo',
                parameters: { text: 'Test' }
            };

            const result = await engine.execute(intent, { context });

            expect(result.success).toBe(true);
        });

        it('applies custom timeout', async () => {
            const manifest = createManifest();
            const handlers = createHandlers();
            const engine = new Engine(manifest, handlers);

            const intent: Intent = {
                capabilityId: 'slowOperation',
                parameters: {}
            };

            const successResult = await engine.execute(intent, { timeout: 500 });
            expect(successResult.success).toBe(true);

            const timeoutResult = await engine.execute(intent, { timeout: 50 });
            expect(timeoutResult.success).toBe(false);
            expect(timeoutResult.error?.type).toBe('TIMEOUT');
        });

        it('returns capability graph for LLMs', () => {
            const manifest = createManifest();
            const handlers = createHandlers();
            const engine = new Engine(manifest, handlers);

            const graph = engine.getCapabilityGraph();

            expect(graph.appName).toBe('TodoApp');
            expect(graph.appDescription).toBe('Simple todo application for testing');
            expect(graph.capabilities).toHaveLength(3);
            expect(graph.capabilities[0]).toHaveProperty('id');
            expect(graph.capabilities[0]).toHaveProperty('displayName');
            expect(graph.capabilities[0]).toHaveProperty('description');
            expect(graph.capabilities[0]).toHaveProperty('parameters');
        });
    });

    describe('Validation Errors', () => {
        it('rejects intent with non-existent capability', async () => {
            const manifest = createManifest();
            const handlers = createHandlers();
            const engine = new Engine(manifest, handlers);

            const intent: Intent = {
                capabilityId: 'nonExistent',
                parameters: {}
            };

            const result = await engine.execute(intent);

            expect(result.success).toBe(false);
            expect(result.error?.type).toBe('VALIDATION_ERROR');
            expect(result.error?.message).toContain('not found');
        });

        it('rejects intent with missing required parameter', async () => {
            const manifest = createManifest();
            const handlers = createHandlers();
            const engine = new Engine(manifest, handlers);

            const intent: Intent = {
                capabilityId: 'addTodo',
                parameters: {}
            };

            const result = await engine.execute(intent);

            expect(result.success).toBe(false);
            expect(result.error?.type).toBe('VALIDATION_ERROR');
            expect(result.error?.message).toContain('required');
        });

        it('rejects intent with wrong parameter type', async () => {
            const manifest = createManifest();
            const handlers = createHandlers();
            const engine = new Engine(manifest, handlers);

            const intent: Intent = {
                capabilityId: 'deleteTodo',
                parameters: { id: 'not-a-number' }
            };

            const result = await engine.execute(intent);

            expect(result.success).toBe(false);
            expect(result.error?.type).toBe('VALIDATION_ERROR');
        });

        it('rejects intent with invalid enum value', async () => {
            const manifest = createManifest();
            const handlers = createHandlers();
            const engine = new Engine(manifest, handlers);

            const intent: Intent = {
                capabilityId: 'addTodo',
                parameters: { text: 'Test', priority: 'urgent' }
            };

            const result = await engine.execute(intent);

            expect(result.success).toBe(false);
            expect(result.error?.type).toBe('VALIDATION_ERROR');
        });
    });

    describe('Precondition Failures', () => {
        it('fails when precondition not met', async () => {
            const manifest = createManifest();
            const handlers = createHandlers();
            const { checkers } = createCheckers();
            const engine = new Engine(manifest, handlers, checkers);

            const intent: Intent = {
                capabilityId: 'deleteTodo',
                parameters: { id: 999 }
            };

            const context: AppContext = {
                todos: [{ id: 1, text: 'Existing' }],
                todoId: 999
            };

            const result = await engine.execute(intent, { context });

            expect(result.success).toBe(false);
            expect(result.error?.type).toBe('PRECONDITION_FAILED');
            expect(result.error?.message).toBe('Todo not found');
        });

        it('succeeds when precondition met', async () => {
            const manifest = createManifest();
            const handlers = createHandlers([{ id: 1, text: 'Existing' }]);
            const { checkers } = createCheckers();
            const engine = new Engine(manifest, handlers, checkers);

            const intent: Intent = {
                capabilityId: 'deleteTodo',
                parameters: { id: 1 }
            };

            const context: AppContext = {
                todos: [{ id: 1, text: 'Existing' }],
                todoId: 1
            };

            const result = await engine.execute(intent, { context });

            expect(result.success).toBe(true);
        });

        it('fails when checker not registered', async () => {
            const manifest = createManifest();
            const handlers = createHandlers();
            const engine = new Engine(manifest, handlers);

            const intent: Intent = {
                capabilityId: 'deleteTodo',
                parameters: { id: 1 }
            };

            const result = await engine.execute(intent, { context: { todoId: 1 } });

            expect(result.success).toBe(false);
            expect(result.error?.type).toBe('PRECONDITION_FAILED');
            expect(result.error?.message).toContain('not found');
        });
    });

    describe('Handler Execution Errors', () => {
        it('catches handler throwing error', async () => {
            const manifest = createManifest();
            const handlers = {
                ...createHandlers(),
                'todo.delete': () => {
                    throw new Error('Database error');
                }
            };
            const { checkers } = createCheckers();
            const engine = new Engine(manifest, handlers, checkers);

            const intent: Intent = {
                capabilityId: 'deleteTodo',
                parameters: { id: 1 }
            };

            const context: AppContext = {
                todos: [{ id: 1, text: 'Test' }],
                todoId: 1
            };

            const result = await engine.execute(intent, { context });

            expect(result.success).toBe(false);
            expect(result.error?.type).toBe('EXECUTION_ERROR');
            expect(result.error?.message).toContain('Database error');
        });

        it('catches async handler rejection', async () => {
            const manifest = createManifest();
            const handlers = {
                ...createHandlers(),
                'slow.operation': async () => {
                    throw new Error('Async failure');
                }
            };
            const engine = new Engine(manifest, handlers);

            const intent: Intent = {
                capabilityId: 'slowOperation',
                parameters: {}
            };

            const result = await engine.execute(intent);

            expect(result.success).toBe(false);
            expect(result.error?.type).toBe('EXECUTION_ERROR');
            expect(result.error?.message).toContain('Async failure');
        });

        it('handles timeout errors', async () => {
            const manifest = createManifest();
            const handlers = createHandlers();
            const engine = new Engine(manifest, handlers);

            const intent: Intent = {
                capabilityId: 'slowOperation',
                parameters: {}
            };

            const result = await engine.execute(intent, { timeout: 50 });

            expect(result.success).toBe(false);
            expect(result.error?.type).toBe('TIMEOUT');
            expect(result.error?.message).toContain('timeout');
        });
    });

    describe('Dynamic Registration', () => {
        it('registers additional handler after construction', async () => {
            const manifest = createManifest({
                capabilities: {
                    ...createManifest().capabilities,
                    newCapability: {
                        id: 'newCapability',
                        displayName: 'New',
                        description: 'A new capability added dynamically',
                        parameters: [],
                        handler: { name: 'New', handlerRef: 'new.handler' }
                    }
                }
            });

            const handlers = {
                ...createHandlers(),
                'new.handler': () => 'new result'
            };

            const engine = new Engine(manifest, handlers);

            const intent: Intent = {
                capabilityId: 'newCapability',
                parameters: {}
            };

            const result = await engine.execute(intent);

            expect(result.success).toBe(true);
            expect(result.data).toBe('new result');
        });

        it('registers additional checker after construction', async () => {
            const manifest = createManifest();
            const handlers = createHandlers([{ id: 2, text: 'a different todo' }]);
            const engine = new Engine(manifest, handlers);

            engine.registerChecker('validators.todoExists', (ctx: AppContext) => {
                return ctx.todoExists === true;
            });

            const intent: Intent = {
                capabilityId: 'deleteTodo',
                parameters: { id: 2 }
            };

            const failResult = await engine.execute(intent, { context: { todoExists: false } });
            const passResult = await engine.execute(intent, { context: { todoExists: true } });

            expect(failResult.success).toBe(false);
            expect(passResult.success).toBe(true);
        });
    });

    describe('Complete Workflows', () => {
        it('executes multiple intents sequentially', async () => {
            const manifest = createManifest();
            const handlers = createHandlers();
            const engine = new Engine(manifest, handlers);

            const results = await Promise.all([
                engine.execute({ capabilityId: 'addTodo', parameters: { text: 'First' } }),
                engine.execute({ capabilityId: 'addTodo', parameters: { text: 'Second' } }),
                engine.execute({ capabilityId: 'addTodo', parameters: { text: 'Third', priority: 'high' } })
            ]);

            results.forEach(result => {
                expect(result.success).toBe(true);
            });

            expect(results[0].data).toMatchObject({ text: 'First' });
            expect(results[1].data).toMatchObject({ text: 'Second' });
            expect(results[2].data).toMatchObject({ text: 'Third', priority: 'high' });
        });

        it('handles mixed success and failure', async () => {
            const manifest = createManifest();
            const handlers = createHandlers();
            const engine = new Engine(manifest, handlers);

            const validIntent: Intent = {
                capabilityId: 'addTodo',
                parameters: { text: 'Valid' }
            };

            const invalidIntent: Intent = {
                capabilityId: 'addTodo',
                parameters: {}
            };

            const validResult = await engine.execute(validIntent);
            const invalidResult = await engine.execute(invalidIntent);

            expect(validResult.success).toBe(true);
            expect(invalidResult.success).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        it('handles capability with no parameters', async () => {
            const manifest = createManifest();
            const handlers = createHandlers();
            const engine = new Engine(manifest, handlers);

            const intent: Intent = {
                capabilityId: 'slowOperation',
                parameters: {}
            };

            const result = await engine.execute(intent, { timeout: 500 });

            expect(result.success).toBe(true);
        });

        it('handles capability with no side effects', async () => {
            const manifest = createManifest({
                capabilities: {
                    noSideEffects: {
                        id: 'noSideEffects',
                        displayName: 'No Side Effects',
                        description: 'A capability without side effects',
                        parameters: [],
                        handler: { name: 'No SE', handlerRef: 'no.sideeffects' },
                        sideEffects: []
                    }
                }
            });

            const handlers = {
                ...createHandlers(),
                'no.sideeffects': () => 'done'
            };

            const engine = new Engine(manifest, handlers);

            const result = await engine.execute({
                capabilityId: 'noSideEffects',
                parameters: {}
            });

            expect(result.success).toBe(true);
            expect(result.sideEffects).toEqual([]);
        });

        it('handles empty context', async () => {
            const manifest = createManifest();
            const handlers = createHandlers();
            const engine = new Engine(manifest, handlers);

            const result = await engine.execute(
                { capabilityId: 'addTodo', parameters: { text: 'Test' } },
                { context: {} }
            );

            expect(result.success).toBe(true);
        });

        it('handles undefined context', async () => {
            const manifest = createManifest();
            const handlers = createHandlers();
            const engine = new Engine(manifest, handlers);

            const result = await engine.execute({
                capabilityId: 'addTodo',
                parameters: { text: 'Test' }
            });

            expect(result.success).toBe(true);
        });

        it('preserves execution time in results', async () => {
            const manifest = createManifest();
            const handlers = createHandlers();
            const engine = new Engine(manifest, handlers);

            const result = await engine.execute({
                capabilityId: 'addTodo',
                parameters: { text: 'Test' }
            });

            expect(result.executionTime).toBeDefined();
            expect(result.executionTime).toBeGreaterThanOrEqual(0);
        });

        it('includes capability ID in all errors', async () => {
            const manifest = createManifest();
            const handlers = createHandlers();
            const engine = new Engine(manifest, handlers);

            const results = await Promise.all([
                engine.execute({ capabilityId: 'addTodo', parameters: {} }), //no text
                engine.execute({ capabilityId: 'nonExistent', parameters: {} })
            ]);

            results.forEach(result => {
                expect(result.success).toBe(false);
                expect(result.error?.capabilityId).toBeDefined();
            });
        });

        it('handles concurrent executions safely', async () => {
            const manifest = createManifest();
            const handlers = createHandlers();
            const engine = new Engine(manifest, handlers);

            const intents = Array(10).fill(null).map((_, i) => ({
                capabilityId: 'addTodo',
                parameters: { text: `Todo ${i}` }
            }));

            const results = await Promise.all(
                intents.map(intent => engine.execute(intent))
            );

            expect(results).toHaveLength(10);
            results.forEach((result, i) => {
                expect(result.success).toBe(true);
                expect(result.data).toMatchObject({ text: `Todo ${i}` });
            });
        });
    });
});