import { describe, it, expect, beforeEach } from '@jest/globals';
import { ManifestResolver } from '../manifestResolver';
import type { Manifest } from '../../schema/types';

describe('ManifestResolver', () => {
    let resolver: ManifestResolver;

    const createManifest = (overrides?: Partial<Manifest>): Manifest => ({
        $schema: 'https://aument.dev/schema/v1',
        version: '1.0.0',
        metadata: {
            name: 'TestApp',
            description: 'Test application for resolver'
        },
        capabilities: {
            addTodo: {
                id: 'addTodo',
                displayName: 'Add Todo',
                description: 'Create a new todo item with text',
                parameters: [],
                handler: { name: 'Add', handlerRef: 'todo.add' }
            },
            deleteTodo: {
                id: 'deleteTodo',
                displayName: 'Delete Todo',
                description: 'Remove a todo item from the list',
                parameters: [],
                handler: { name: 'Delete', handlerRef: 'todo.delete' }
            }
        },
        ...overrides
    });

    beforeEach(() => {
        resolver = new ManifestResolver();
    });

    describe('load()', () => {
        it('loads a valid manifest', () => {
            const manifest = createManifest();
            expect(() => resolver.load(manifest)).not.toThrow();
        });

        it('throws on invalid manifest structure', () => {
            const invalid = { invalid: 'manifest' };
            expect(() => resolver.load(invalid as any)).toThrow();
        });

        it('throws on manifest with missing required fields', () => {
            const invalid = createManifest();
            delete (invalid as any).metadata;
            expect(() => resolver.load(invalid)).toThrow();
        });

        it('throws on manifest with invalid capability', () => {
            const invalid = createManifest({
                capabilities: {
                    broken: {
                        id: 'broken',
                        displayName: 'Broken',
                        description: 'Short',
                        parameters: [],
                        handler: { name: 'Broken', handlerRef: 'broken' }
                    }
                }
            });
            expect(() => resolver.load(invalid)).toThrow();
        });

        it('caches loaded manifests', () => {
            const manifest = createManifest();
            resolver.load(manifest);
            expect(() => resolver.load(manifest)).not.toThrow();
        });
    });

    describe('getCapability()', () => {
        it('returns capability by ID', () => {
            const manifest = createManifest();
            const capability = resolver.getCapability(manifest, 'addTodo');

            expect(capability).not.toBeNull();
            expect(capability?.id).toBe('addTodo');
            expect(capability?.displayName).toBe('Add Todo');
        });

        it('returns null for non-existent capability', () => {
            const manifest = createManifest();
            const capability = resolver.getCapability(manifest, 'nonExistent');

            expect(capability).toBeNull();
        });

        it('returns correct capability when multiple exist', () => {
            const manifest = createManifest();
            const add = resolver.getCapability(manifest, 'addTodo');
            const del = resolver.getCapability(manifest, 'deleteTodo');

            expect(add?.id).toBe('addTodo');
            expect(del?.id).toBe('deleteTodo');
            expect(add?.id).not.toBe(del?.id);
        });

        it('handles empty capability ID', () => {
            const manifest = createManifest();
            const capability = resolver.getCapability(manifest, '');

            expect(capability).toBeNull();
        });

        it('is case-sensitive for capability IDs', () => {
            const manifest = createManifest();
            const capability = resolver.getCapability(manifest, 'AddTodo'); // wrong case
            expect(capability).toBeNull();
        });
    });

    describe('hasCapability()', () => {
        it('returns true for existing capability', () => {
            const manifest = createManifest();
            expect(resolver.hasCapability(manifest, 'addTodo')).toBe(true);
        });

        it('returns false for non-existent capability', () => {
            const manifest = createManifest();
            expect(resolver.hasCapability(manifest, 'nonExistent')).toBe(false);
        });

        it('returns false for empty capability ID', () => {
            const manifest = createManifest();
            expect(resolver.hasCapability(manifest, '')).toBe(false);
        });

        it('handles manifest with no capabilities', () => {
            const manifest = createManifest({ capabilities: {} });
            expect(resolver.hasCapability(manifest, 'anything')).toBe(false);
        });
    });

    describe('getCapabilityIds()', () => {
        it('returns all capability IDs', () => {
            const manifest = createManifest();
            const ids = resolver.getCapabilityIds(manifest);

            expect(ids).toHaveLength(2);
            expect(ids).toContain('addTodo');
            expect(ids).toContain('deleteTodo');
        });

        it('returns empty array for manifest with no capabilities', () => {
            const manifest = createManifest({ capabilities: {} });
            const ids = resolver.getCapabilityIds(manifest);

            expect(ids).toHaveLength(0);
        });

        it('maintains insertion order', () => {
            const manifest: Manifest = {
                $schema: 'https://aument.dev/schema/v1',
                version: '1.0.0',
                metadata: { name: 'Test', description: 'Test application' },
                capabilities: {
                    first: {
                        id: 'first',
                        displayName: 'First',
                        description: 'First capability in order',
                        parameters: [],
                        handler: { name: 'First', handlerRef: 'first' }
                    },
                    second: {
                        id: 'second',
                        displayName: 'Second',
                        description: 'Second capability in order',
                        parameters: [],
                        handler: { name: 'Second', handlerRef: 'second' }
                    }
                }
            };

            const ids = resolver.getCapabilityIds(manifest);
            expect(ids[0]).toBe('first');
            expect(ids[1]).toBe('second');
        });
    });

    describe('Edge Cases', () => {
        it('handles manifest with single capability', () => {
            const manifest = createManifest({
                capabilities: {
                    only: {
                        id: 'only',
                        displayName: 'Only',
                        description: 'Only capability in manifest',
                        parameters: [],
                        handler: { name: 'Only', handlerRef: 'only' }
                    }
                }
            });

            expect(resolver.hasCapability(manifest, 'only')).toBe(true);
            expect(resolver.getCapabilityIds(manifest)).toHaveLength(1);
        });

        it('handles manifest with many capabilities', () => {
            const capabilities: any = {};
            for (let i = 0; i < 50; i++) {
                capabilities[`cap${i}`] = {
                    id: `cap${i}`,
                    displayName: `Capability ${i}`,
                    description: `Capability number ${i} for testing`,
                    parameters: [],
                    handler: { name: `Cap${i}`, handlerRef: `cap${i}` }
                };
            }

            const manifest = createManifest({ capabilities });

            expect(resolver.getCapabilityIds(manifest)).toHaveLength(50);
            expect(resolver.hasCapability(manifest, 'cap25')).toBe(true);
            expect(resolver.getCapability(manifest, 'cap49')).not.toBeNull();
        });

        it('handles capability with complex parameters', () => {
            const manifest = createManifest({
                capabilities: {
                    complex: {
                        id: 'complex',
                        displayName: 'Complex',
                        description: 'Capability with many parameters',
                        parameters: [
                            {
                                name: 'param1',
                                description: 'First parameter',
                                type: 'string',
                                isRequired: true
                            },
                            {
                                name: 'param2',
                                description: 'Second parameter',
                                type: 'number',
                                isRequired: false,
                                validator: { min: 0, max: 100 }
                            }
                        ],
                        handler: { name: 'Complex', handlerRef: 'complex' }
                    }
                }
            });

            const capability = resolver.getCapability(manifest, 'complex');
            expect(capability?.parameters).toHaveLength(2);
        });

        it('handles capability with preconditions', () => {
            const manifest = createManifest({
                capabilities: {
                    withPrecondition: {
                        id: 'withPrecondition',
                        displayName: 'With Precondition',
                        description: 'Capability with precondition checks',
                        parameters: [],
                        handler: { name: 'Test', handlerRef: 'test' },
                        preconditions: [
                            {
                                type: 'state',
                                checker: { name: 'Check', handlerRef: 'check' },
                                description: 'Test check',
                                errorMessage: 'Error'
                            }
                        ]
                    }
                }
            });

            const capability = resolver.getCapability(manifest, 'withPrecondition');
            expect(capability?.preconditions).toHaveLength(1);
        });

        it('handles undefined manifest gracefully', () => {
            expect(() => resolver.getCapability(undefined as any, 'test')).toThrow();
        });

        it('handles null capability ID', () => {
            const manifest = createManifest();
            expect(resolver.hasCapability(manifest, null as any)).toBe(false);
        });
    });
});