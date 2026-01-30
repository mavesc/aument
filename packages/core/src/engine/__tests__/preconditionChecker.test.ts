import { describe, it, expect, beforeEach } from '@jest/globals';
import { PreconditionChecker } from '../preconditionChecker';
import type { Precondition } from '../../schema';
import type { AppContext } from '../types';

describe('PreconditionChecker', () => {
    let checker: PreconditionChecker;

    const createPrecondition = (overrides?: Partial<Precondition>): Precondition => ({
        type: 'state',
        checker: { name: 'Test Checker', handlerRef: 'test.checker' },
        description: 'Test precondition',
        errorMessage: 'Precondition failed',
        ...overrides
    });

    const createContext = (data?: Record<string, any>): AppContext => ({
        user: { id: '123', isLoggedIn: true },
        cart: { items: [] },
        ...data
    });

    beforeEach(() => {
        checker = new PreconditionChecker();
    });

    describe('registerChecker()', () => {
        it('registers a checker function', () => {
            const checkFn = (ctx: AppContext) => true;
            checker.registerChecker('test', checkFn);

            expect(checker.hasChecker('test')).toBe(true);
        });

        it('registers sync and async checkers', () => {
            const syncChecker = (ctx: AppContext) => true;
            const asyncChecker = async (ctx: AppContext) => true;

            checker.registerChecker('sync', syncChecker);
            checker.registerChecker('async', asyncChecker);

            expect(checker.hasChecker('sync')).toBe(true);
            expect(checker.hasChecker('async')).toBe(true);
        });

        it('throws on empty checker ref', () => {
            expect(() => checker.registerChecker('', () => true)).toThrow();
        });

        it('throws on non-function checker', () => {
            expect(() => checker.registerChecker('test', 'not-function' as any)).toThrow();
            expect(() => checker.registerChecker('test', {} as any)).toThrow();
        });
    });

    describe('registerMany()', () => {
        it('registers multiple checkers at once', () => {
            const checkers = {
                'check.one': (ctx: AppContext) => true,
                'check.two': (ctx: AppContext) => false,
                'check.three': async (ctx: AppContext) => true
            };

            checker.registerMany(checkers);

            expect(checker.hasChecker('check.one')).toBe(true);
            expect(checker.hasChecker('check.two')).toBe(true);
            expect(checker.hasChecker('check.three')).toBe(true);
        });

        it('handles empty object', () => {
            expect(() => checker.registerMany({})).not.toThrow();
        });
    });

    describe('checkOne()', () => {
        it('passes when checker returns true', async () => {
            checker.registerChecker('always-pass', () => true);
            const precondition = createPrecondition({
                checker: { name: 'Pass', handlerRef: 'always-pass' }
            });

            const result = await checker.checkOne(precondition, createContext());

            expect(result.passed).toBe(true);
            expect(result.failedCondition).toBeUndefined();
        });

        it('fails when checker returns false', async () => {
            checker.registerChecker('always-fail', () => false);
            const precondition = createPrecondition({
                checker: { name: 'Fail', handlerRef: 'always-fail' },
                errorMessage: 'Check failed'
            });

            const result = await checker.checkOne(precondition, createContext());

            expect(result.passed).toBe(false);
            expect(result.failedCondition?.errorMessage).toBe('Check failed');
        });

        it('works with async checkers', async () => {
            checker.registerChecker('async-pass', async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                return true;
            });

            const precondition = createPrecondition({
                checker: { name: 'Async', handlerRef: 'async-pass' }
            });

            const result = await checker.checkOne(precondition, createContext());
            expect(result.passed).toBe(true);
        });

        it('fails when checker not found', async () => {
            const precondition = createPrecondition({
                checker: { name: 'Missing', handlerRef: 'nonexistent' }
            });

            const result = await checker.checkOne(precondition, createContext());

            expect(result.passed).toBe(false);
            expect(result.failedCondition?.errorMessage).toContain('not found');
        });

        it('receives context correctly', async () => {
            let receivedContext: AppContext | null = null;

            checker.registerChecker('context-check', (ctx) => {
                receivedContext = ctx;
                return true;
            });

            const context = createContext({ custom: 'data' });
            const precondition = createPrecondition({
                checker: { name: 'Context', handlerRef: 'context-check' }
            });

            await checker.checkOne(precondition, context);

            expect(receivedContext).toEqual(context);
        });

        it('handles checker throwing error', async () => {
            checker.registerChecker('throws', () => {
                throw new Error('Checker error');
            });

            const precondition = createPrecondition({
                checker: { name: 'Throws', handlerRef: 'throws' }
            });

            const result = await checker.checkOne(precondition, createContext());

            expect(result.passed).toBe(false);
            expect(result.failedCondition?.errorMessage).toContain('Checker error');
        });

        it('includes description in failed condition', async () => {
            checker.registerChecker('fail', () => false);
            const precondition = createPrecondition({
                checker: { name: 'Fail', handlerRef: 'fail' },
                description: 'User must be logged in',
                errorMessage: 'Please log in'
            });

            const result = await checker.checkOne(precondition, createContext());

            expect(result.failedCondition?.description).toBe('User must be logged in');
            expect(result.failedCondition?.errorMessage).toBe('Please log in');
        });
    });

    describe('checkAll()', () => {
        it('passes when all preconditions pass', async () => {
            checker.registerMany({
                'check1': () => true,
                'check2': () => true,
                'check3': () => true
            });

            const preconditions = [
                createPrecondition({ checker: { name: '1', handlerRef: 'check1' } }),
                createPrecondition({ checker: { name: '2', handlerRef: 'check2' } }),
                createPrecondition({ checker: { name: '3', handlerRef: 'check3' } })
            ];

            const result = await checker.checkAll(preconditions, createContext());

            expect(result.passed).toBe(true);
        });

        it('fails on first failing precondition (fail fast)', async () => {
            let check3Called = false;

            checker.registerMany({
                'check1': () => true,
                'check2': () => false,
                'check3': () => { check3Called = true; return true; }
            });

            const preconditions = [
                createPrecondition({ checker: { name: '1', handlerRef: 'check1' } }),
                createPrecondition({
                    checker: { name: '2', handlerRef: 'check2' },
                    errorMessage: 'Check 2 failed'
                }),
                createPrecondition({ checker: { name: '3', handlerRef: 'check3' } })
            ];

            const result = await checker.checkAll(preconditions, createContext());

            expect(result.passed).toBe(false);
            expect(result.failedCondition?.errorMessage).toBe('Check 2 failed');
            expect(check3Called).toBe(false);
        });

        it('passes with empty preconditions array', async () => {
            const result = await checker.checkAll([], createContext());
            expect(result.passed).toBe(true);
        });

        it('passes with undefined preconditions', async () => {
            const result = await checker.checkAll(undefined, createContext());
            expect(result.passed).toBe(true);
        });

        it('executes preconditions sequentially', async () => {
            const order: number[] = [];

            checker.registerMany({
                'first': async () => { order.push(1); return true; },
                'second': async () => { order.push(2); return true; },
                'third': async () => { order.push(3); return true; }
            });

            const preconditions = [
                createPrecondition({ checker: { name: 'First', handlerRef: 'first' } }),
                createPrecondition({ checker: { name: 'Second', handlerRef: 'second' } }),
                createPrecondition({ checker: { name: 'Third', handlerRef: 'third' } })
            ];

            await checker.checkAll(preconditions, createContext());

            expect(order).toEqual([1, 2, 3]);
        });
    });

    describe('Context-Based Checks', () => {
        it('checks user logged in state', async () => {
            checker.registerChecker('isLoggedIn', (ctx) => (ctx.user as any).isLoggedIn === true);

            const precondition = createPrecondition({
                checker: { name: 'Login Check', handlerRef: 'isLoggedIn' },
                errorMessage: 'Must be logged in'
            });

            const loggedInContext = createContext({ user: { isLoggedIn: true } });
            const loggedOutContext = createContext({ user: { isLoggedIn: false } });

            const passResult = await checker.checkOne(precondition, loggedInContext);
            const failResult = await checker.checkOne(precondition, loggedOutContext);

            expect(passResult.passed).toBe(true);
            expect(failResult.passed).toBe(false);
        });

        it('checks cart has items', async () => {
            checker.registerChecker('cartHasItems', (ctx) => (ctx.cart as any).items.length > 0);

            const precondition = createPrecondition({
                checker: { name: 'Cart Check', handlerRef: 'cartHasItems' },
                errorMessage: 'Cart is empty'
            });

            const emptyCart = createContext({ cart: { items: [] } });
            const fullCart = createContext({ cart: { items: [{ id: 1 }] } });

            const failResult = await checker.checkOne(precondition, emptyCart);
            const passResult = await checker.checkOne(precondition, fullCart);

            expect(failResult.passed).toBe(false);
            expect(passResult.passed).toBe(true);
        });

        it('handles missing context properties gracefully', async () => {
            checker.registerChecker('checkMissing', (ctx) => (ctx.nonexistent as any).value === true);

            const precondition = createPrecondition({
                checker: { name: 'Missing', handlerRef: 'checkMissing' }
            });

            const result = await checker.checkOne(precondition, createContext());
            expect(result.passed).toBe(false);
        });
    });

    describe('getChecker()', () => {
        it('returns registered checker', () => {
            const checkFn = (ctx: AppContext) => true;
            checker.registerChecker('test', checkFn);

            expect(checker.getChecker('test')).toBe(checkFn);
        });

        it('returns null for unregistered checker', () => {
            expect(checker.getChecker('nonexistent')).toBeNull();
        });
    });

    describe('clear()', () => {
        it('removes all checkers', () => {
            checker.registerMany({
                'one': () => true,
                'two': () => false
            });

            checker.clear();

            expect(checker.hasChecker('one')).toBe(false);
            expect(checker.hasChecker('two')).toBe(false);
        });
    });

    describe('unregisterChecker()', () => {
        it('unregisters checker', () => {
            const checkFn = (ctx: AppContext) => true;
            checker.registerChecker('test', checkFn);

            expect(checker.hasChecker('test')).toBe(true);
            checker.unregisterChecker('test');
            expect(checker.hasChecker('test')).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        it('handles checker returning non-boolean', async () => {
            checker.registerChecker('returns-string', () => 'yes' as any);

            const precondition = createPrecondition({
                checker: { name: 'String', handlerRef: 'returns-string' }
            });

            const result = await checker.checkOne(precondition, createContext());
            expect(result.passed).toBe(true);
        });

        it('handles async checker with delay', async () => {
            checker.registerChecker('delayed', async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
                return true;
            });

            const precondition = createPrecondition({
                checker: { name: 'Delayed', handlerRef: 'delayed' }
            });

            const start = Date.now();
            const result = await checker.checkOne(precondition, createContext());
            const elapsed = Date.now() - start;

            expect(result.passed).toBe(true);
            expect(elapsed).toBeGreaterThanOrEqual(100);
        });

        it('handles 10 preconditions', async () => {
            const checkers: Record<string, any> = {};
            const preconditions: Precondition[] = [];

            for (let i = 0; i < 10; i++) {
                checkers[`check${i}`] = () => true;
                preconditions.push(createPrecondition({
                    checker: { name: `Check ${i}`, handlerRef: `check${i}` }
                }));
            }

            checker.registerMany(checkers);
            const result = await checker.checkAll(preconditions, createContext());

            expect(result.passed).toBe(true);
        });

        it('preserves error message on failure', async () => {
            checker.registerChecker('fail', () => false);

            const precondition = createPrecondition({
                checker: { name: 'Fail', handlerRef: 'fail' },
                description: 'Must have permission',
                errorMessage: 'Permission denied: admin access required'
            });

            const result = await checker.checkOne(precondition, createContext());

            expect(result.failedCondition?.errorMessage).toBe('Permission denied: admin access required');
            expect(result.failedCondition?.description).toBe('Must have permission');
        });
    });
});