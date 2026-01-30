import { describe, it, expect, beforeEach } from '@jest/globals';
import { HandlerRegistry } from '../handlerRegistry';

describe('HandlerRegistry', () => {
    let registry: HandlerRegistry;

    const mockHandler = (result: any) => (params: any) => result;
    const asyncHandler = (result: any) => async (params: any) => result;

    beforeEach(() => {
        registry = new HandlerRegistry();
    });

    describe('register()', () => {
        it('registers a handler', () => {
            const handler = mockHandler('success');
            registry.register('test.handler', handler);

            expect(registry.has('test.handler')).toBe(true);
            expect(registry.get('test.handler')).toBe(handler);
        });

        it('registers multiple different handlers', () => {
            const handler1 = mockHandler('one');
            const handler2 = mockHandler('two');

            registry.register('handler.one', handler1);
            registry.register('handler.two', handler2);

            expect(registry.size).toBe(2);
            expect(registry.get('handler.one')).toBe(handler1);
            expect(registry.get('handler.two')).toBe(handler2);
        });

        it('overwrites existing handler with same ref', () => {
            const original = mockHandler('original');
            const replacement = mockHandler('replacement');

            registry.register('test', original);
            registry.register('test', replacement);

            expect(registry.get('test')).toBe(replacement);
            expect(registry.size).toBe(1);
        });

        it('throws on empty handler ref', () => {
            expect(() => registry.register('', mockHandler('test'))).toThrow();
        });

        it('throws on non-string handler ref', () => {
            expect(() => registry.register(null as any, mockHandler('test'))).toThrow();
            expect(() => registry.register(123 as any, mockHandler('test'))).toThrow();
        });

        it('throws on non-function handler', () => {
            expect(() => registry.register('test', 'not-a-function' as any)).toThrow();
            expect(() => registry.register('test', {} as any)).toThrow();
            expect(() => registry.register('test', null as any)).toThrow();
        });

        it('accepts async handlers', () => {
            const handler = asyncHandler('async-result');
            expect(() => registry.register('async', handler)).not.toThrow();
        });

        it('accepts arrow functions', () => {
            const handler = (params: any) => params.value * 2;
            expect(() => registry.register('arrow', handler)).not.toThrow();
        });

        it('accepts class methods', () => {
            class Service {
                method(params: any) { return 'result'; }
            }
            const service = new Service();
            expect(() => registry.register('method', service.method.bind(service))).not.toThrow();
        });
    });

    describe('registerMany()', () => {
        it('registers multiple handlers at once', () => {
            const handlers = {
                'handler.one': mockHandler('one'),
                'handler.two': mockHandler('two'),
                'handler.three': mockHandler('three')
            };

            registry.registerMany(handlers);

            expect(registry.size).toBe(3);
            expect(registry.has('handler.one')).toBe(true);
            expect(registry.has('handler.two')).toBe(true);
            expect(registry.has('handler.three')).toBe(true);
        });

        it('handles empty object', () => {
            expect(() => registry.registerMany({})).not.toThrow();
            expect(registry.size).toBe(0);
        });

        it('throws on invalid handler in batch', () => {
            const handlers = {
                'valid': mockHandler('ok'),
                'invalid': 'not-a-function' as any
            };

            expect(() => registry.registerMany(handlers)).toThrow();
        });
    });

    describe('get()', () => {
        it('returns registered handler', () => {
            const handler = mockHandler('test');
            registry.register('test', handler);

            expect(registry.get('test')).toBe(handler);
        });

        it('returns null for unregistered handler', () => {
            expect(registry.get('nonexistent')).toBeNull();
        });

        it('returns null for empty string', () => {
            expect(registry.get('')).toBeNull();
        });

        it('is case-sensitive', () => {
            registry.register('MyHandler', mockHandler('test'));

            expect(registry.get('MyHandler')).not.toBeNull();
            expect(registry.get('myhandler')).toBeNull();
            expect(registry.get('MYHANDLER')).toBeNull();
        });
    });

    describe('has()', () => {
        it('returns true for registered handler', () => {
            registry.register('test', mockHandler('value'));
            expect(registry.has('test')).toBe(true);
        });

        it('returns false for unregistered handler', () => {
            expect(registry.has('nonexistent')).toBe(false);
        });

        it('returns false after unregister', () => {
            registry.register('test', mockHandler('value'));
            registry.unregister('test');
            expect(registry.has('test')).toBe(false);
        });
    });

    describe('unregister()', () => {
        it('removes registered handler', () => {
            registry.register('test', mockHandler('value'));
            registry.unregister('test');

            expect(registry.has('test')).toBe(false);
            expect(registry.get('test')).toBeNull();
        });

        it('does nothing for unregistered handler', () => {
            expect(() => registry.unregister('nonexistent')).not.toThrow();
        });

        it('reduces size count', () => {
            registry.register('one', mockHandler('1'));
            registry.register('two', mockHandler('2'));
            expect(registry.size).toBe(2);

            registry.unregister('one');
            expect(registry.size).toBe(1);
        });
    });

    describe('clear()', () => {
        it('removes all handlers', () => {
            registry.registerMany({
                'one': mockHandler('1'),
                'two': mockHandler('2'),
                'three': mockHandler('3')
            });

            registry.clear();

            expect(registry.size).toBe(0);
            expect(registry.has('one')).toBe(false);
            expect(registry.has('two')).toBe(false);
        });

        it('handles empty registry', () => {
            expect(() => registry.clear()).not.toThrow();
        });
    });

    describe('getRegisteredRefs()', () => {
        it('returns all handler references', () => {
            registry.registerMany({
                'handler.one': mockHandler('1'),
                'handler.two': mockHandler('2')
            });

            const refs = registry.getRegisteredRefs();
            expect(refs).toHaveLength(2);
            expect(refs).toContain('handler.one');
            expect(refs).toContain('handler.two');
        });

        it('returns empty array for empty registry', () => {
            expect(registry.getRegisteredRefs()).toEqual([]);
        });

        it('reflects changes after registration', () => {
            registry.register('test', mockHandler('value'));
            expect(registry.getRegisteredRefs()).toHaveLength(1);

            registry.register('another', mockHandler('value'));
            expect(registry.getRegisteredRefs()).toHaveLength(2);
        });
    });

    describe('size', () => {
        it('returns count of registered handlers', () => {
            expect(registry.size).toBe(0);

            registry.register('one', mockHandler('1'));
            expect(registry.size).toBe(1);

            registry.register('two', mockHandler('2'));
            expect(registry.size).toBe(2);
        });

        it('decreases on unregister', () => {
            registry.registerMany({
                'one': mockHandler('1'),
                'two': mockHandler('2')
            });
            expect(registry.size).toBe(2);

            registry.unregister('one');
            expect(registry.size).toBe(1);
        });
    });

    describe('Edge Cases', () => {
        it('handles handler refs with special characters', () => {
            const refs = ['test.handler', 'test_handler', 'test-handler', 'test$handler'];

            refs.forEach(ref => {
                registry.register(ref, mockHandler('test'));
                expect(registry.has(ref)).toBe(true);
            });
        });

        it('handles very long handler refs', () => {
            const longRef = 'a'.repeat(1000);
            registry.register(longRef, mockHandler('test'));
            expect(registry.has(longRef)).toBe(true);
        });

        it('handles unicode in handler refs', () => {
            registry.register('test.处理器', mockHandler('test'));
            registry.register('test.обработчик', mockHandler('test'));
            expect(registry.size).toBe(2);
        });

        it('maintains handler references correctly', () => {
            const handler1 = mockHandler('one');
            const handler2 = mockHandler('two');

            registry.register('test1', handler1);
            registry.register('test2', handler2);

            expect(registry.get('test1')).not.toBe(registry.get('test2'));
        });

        it('handles 100+ handlers', () => {
            const handlers: Record<string, any> = {};
            for (let i = 0; i < 100; i++) {
                handlers[`handler${i}`] = mockHandler(i);
            }

            registry.registerMany(handlers);
            expect(registry.size).toBe(100);
            expect(registry.get('handler50')).not.toBeNull();
        });
    });
});