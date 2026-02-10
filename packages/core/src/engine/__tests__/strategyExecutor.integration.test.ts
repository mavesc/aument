import { StrategyExecutor } from '../strategyExecutor';
import { Engine } from '../engine';
import { ManifestResolver } from '../manifestResolver';
import type { Manifest, Capability, ParameterType, CollectionApproach, Precondition } from '../../schema';
import type { Intent, HandlerFunction } from '../types';

const createCapability = (
    id: string,
    handlerRef: string,
    params: Array<{ name: string; type: ParameterType; isRequired: boolean; collectionApproach?: CollectionApproach; isSensitive?: boolean }> = [],
    undoCapabilityId?: string,
    preconditions?: Precondition[]
): Capability => ({
    id,
    displayName: id,
    description: `Test capability ${id}`,
    handler: { name: id, handlerRef },
    parameters: params.map(p => ({
        name: p.name,
        description: `Parameter ${p.name}`,
        type: p.type,
        isRequired: p.isRequired,
        collectionApproach: p.collectionApproach ?? 'upfront',
        isSensitive: p.isSensitive ?? false
    })),
    ...(undoCapabilityId && { undoCapabilityId }),
    ...(preconditions && { preconditions })
});

const createManifest = (capabilities: Capability[]): Manifest => ({
    $schema: 'https://aument.dev/schema/v1',
    version: '1.0.0',
    metadata: {
        name: 'Test App',
        author: 'Test Author',
        description: 'Test application'
    },
    capabilities: capabilities.reduce((acc, cap) => {
        acc[cap.id] = cap;
        return acc;
    }, {} as Record<string, Capability>)
});

const createMockHandler = (returnData?: unknown): jest.Mock<Promise<{ success: boolean; data?: unknown }>> =>
    jest.fn().mockResolvedValue({ success: true, data: returnData });

const createFailingHandler = (message = 'Handler failed'): jest.Mock =>
    jest.fn().mockRejectedValue(new Error(message));

describe('StrategyExecutor (Integration)', () => {
    let executor: StrategyExecutor;
    let engine: Engine;
    let manifest: Manifest;
    let handlers: Record<string, HandlerFunction>;

    describe('Basic Strategy Execution', () => {
        beforeEach(() => {
            const addToCart = createCapability('addToCart', 'handlers.addToCart', [
                { name: 'itemId', type: 'string', isRequired: true },
                { name: 'quantity', type: 'number', isRequired: true }
            ]);

            const placeOrder = createCapability('placeOrder', 'handlers.placeOrder', [
                { name: 'paymentMethod', type: 'string', isRequired: true }
            ]);

            const failingAddToCart = createCapability('failingAddToCart', 'handlers.failingAddToCart', [
                { name: 'itemId', type: 'string', isRequired: true },
                { name: 'quantity', type: 'number', isRequired: true }
            ]);

            manifest = createManifest([addToCart, placeOrder, failingAddToCart]);

            handlers = {
                'handlers.addToCart': createMockHandler({ cartId: 'cart-123' }),
                'handlers.placeOrder': createMockHandler({ orderId: 'order-456' }),
                'handlers.failingAddToCart': createFailingHandler('Out of stock')
            };

            engine = new Engine(manifest, handlers);
            const resolver = new ManifestResolver();
            resolver.load(manifest);
            executor = new StrategyExecutor(engine, manifest, resolver);
        });

        it('should execute single intent successfully', async () => {
            const strategy: Intent[] = [
                { capabilityId: 'addToCart', parameters: { itemId: 'item-1', quantity: 2 } }
            ];

            const result = await executor.executeStrategy(strategy);

            expect(result.success).toBe(true);
            expect(result.results).toHaveLength(1);
            expect(result.completedSteps).toBe(1);
            expect(handlers['handlers.addToCart']).toHaveBeenCalledWith(
                { itemId: 'item-1', quantity: 2 }
            );
        });

        it('should execute multiple intents sequentially', async () => {
            const strategy: Intent[] = [
                { capabilityId: 'addToCart', parameters: { itemId: 'item-1', quantity: 2 } },
                { capabilityId: 'addToCart', parameters: { itemId: 'item-2', quantity: 1 } },
                { capabilityId: 'placeOrder', parameters: { paymentMethod: 'credit-card' } }
            ];

            const result = await executor.executeStrategy(strategy);

            expect(result.success).toBe(true);
            expect(result.results).toHaveLength(3);
            expect(result.completedSteps).toBe(3);
            expect(handlers['handlers.addToCart']).toHaveBeenCalledTimes(2);
            expect(handlers['handlers.placeOrder']).toHaveBeenCalledTimes(1);
        });

        it('should return error for unknown capability', async () => {
            const strategy: Intent[] = [
                { capabilityId: 'unknownCapability', parameters: {} }
            ];

            const result = await executor.executeStrategy(strategy);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('CAPABILITY_NOT_FOUND');
            expect(result.completedSteps).toBe(0);
        });

        it('should stop execution on first failure', async () => {
            const strategy: Intent[] = [
                { capabilityId: 'failingAddToCart', parameters: { itemId: 'item-1', quantity: 2 } },
                { capabilityId: 'placeOrder', parameters: { paymentMethod: 'credit-card' } }
            ];

            const result = await executor.executeStrategy(strategy);

            expect(result.success).toBe(false);
            expect(result.completedSteps).toBe(0);
            expect(result.error?.stepIndex).toBe(0);
            expect(handlers['handlers.placeOrder']).not.toHaveBeenCalled();
        });
    });

    describe('Context Accumulation', () => {
        beforeEach(() => {
            const searchRestaurants = createCapability('searchRestaurants', 'handlers.search', [
                { name: 'cuisine', type: 'string', isRequired: true }
            ]);

            const getMenu = createCapability('getMenu', 'handlers.getMenu', [
                { name: 'restaurantId', type: 'string', isRequired: true }
            ]);

            manifest = createManifest([searchRestaurants, getMenu]);

            handlers = {
                'handlers.search': createMockHandler({ restaurantId: 'rest-123', name: 'Pizza Place' }),
                'handlers.getMenu': createMockHandler({ items: ['Margherita', 'Pepperoni'] })
            };

            engine = new Engine(manifest, handlers);
            const resolver = new ManifestResolver();
            resolver.load(manifest);
            executor = new StrategyExecutor(engine, manifest, resolver);
        });

        it('should accumulate context across intents', async () => {
            const strategy: Intent[] = [
                { capabilityId: 'searchRestaurants', parameters: { cuisine: 'Italian' } },
                { capabilityId: 'getMenu', parameters: {} }
            ];

            const result = await executor.executeStrategy(strategy);

            expect(result.success).toBe(true);
            expect(handlers['handlers.getMenu']).toHaveBeenCalledWith(
                { restaurantId: 'rest-123' }
            );
        });

        it('should pass initial context to first intent', async () => {
            const strategy: Intent[] = [
                { capabilityId: 'searchRestaurants', parameters: { cuisine: 'Italian' } }
            ];

            await executor.executeStrategy(strategy, {
                context: { userId: 'user-123', location: 'NYC' }
            });

            expect(handlers['handlers.search']).toHaveBeenCalled();
        });
    });

    describe('Progressive Parameter Collection', () => {
        beforeEach(() => {
            const placeOrder = createCapability('placeOrder', 'handlers.placeOrder', [
                { name: 'paymentMethod', type: 'string', isRequired: true, collectionApproach: 'upfront' },
                { name: 'cvv', type: 'string', isRequired: true, collectionApproach: 'on-demand', isSensitive: true }
            ]);

            manifest = createManifest([placeOrder]);
            handlers = { 'handlers.placeOrder': createMockHandler({ orderId: 'order-456' }) };

            engine = new Engine(manifest, handlers);
            const resolver = new ManifestResolver();
            resolver.load(manifest);
            executor = new StrategyExecutor(engine, manifest, resolver);
        });

        it('should pause when on-demand parameter is missing', async () => {
            const strategy: Intent[] = [
                { capabilityId: 'placeOrder', parameters: { paymentMethod: 'credit-card' } }
            ];

            const result = await executor.executeStrategy(strategy);

            expect(result.success).toBe(false);
            expect(result.paused).toBe(true);
            expect(result.requiredInputs).toHaveLength(1);
            expect(result.requiredInputs![0]).toMatchObject({
                capabilityId: 'placeOrder',
                parameter: 'cvv',
                type: 'string',
                isSensitive: true
            });
            expect(result.resumeToken).toBeDefined();
        });

        it('should resume execution with collected parameters', async () => {
            const strategy: Intent[] = [
                { capabilityId: 'placeOrder', parameters: { paymentMethod: 'credit-card' } }
            ];

            const pausedResult = await executor.executeStrategy(strategy);
            const resumeToken = pausedResult.resumeToken!;

            const finalResult = await executor.resumeStrategy(resumeToken, { cvv: '123' });

            expect(finalResult.success).toBe(true);
            expect(finalResult.completedSteps).toBe(1);
            expect(handlers['handlers.placeOrder']).toHaveBeenCalledWith(
                { paymentMethod: 'credit-card', cvv: '123' },
            );
        });

        it('should return error for invalid resume token', async () => {
            const result = await executor.resumeStrategy('invalid-token', { cvv: '123' });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INVALID_RESUME_TOKEN');
        });

        it('should collect multiple on-demand parameters at once', async () => {
            const checkout = createCapability('checkout', 'handlers.checkout', [
                { name: 'total', type: 'number', isRequired: true, collectionApproach: 'upfront' },
                { name: 'cvv', type: 'string', isRequired: true, collectionApproach: 'on-demand', isSensitive: true },
                { name: 'billingZip', type: 'string', isRequired: true, collectionApproach: 'on-demand' }
            ]);

            manifest = createManifest([checkout]);
            handlers = { 'handlers.checkout': createMockHandler({ success: true }) };

            engine = new Engine(manifest, handlers);
            const resolver = new ManifestResolver();
            resolver.load(manifest);
            executor = new StrategyExecutor(engine, manifest, resolver);

            const strategy: Intent[] = [
                { capabilityId: 'checkout', parameters: { total: 99.99 } }
            ];

            const result = await executor.executeStrategy(strategy);

            expect(result.paused).toBe(true);
            expect(result.requiredInputs).toHaveLength(2);
            expect(result.requiredInputs?.map(r => r.parameter)).toEqual(['cvv', 'billingZip']);
        });
    });

    describe('Transactional Rollback', () => {
        beforeEach(() => {
            const addToCart = createCapability(
                'addToCart',
                'handlers.addToCart',
                [{ name: 'itemId', type: 'string', isRequired: true }],
                'removeFromCart'
            );

            const removeFromCart = createCapability(
                'removeFromCart',
                'handlers.removeFromCart',
                [{ name: 'itemId', type: 'string', isRequired: true }]
            );

            const addToCartWithUndoFailing = createCapability(
                'addToCartWithUndoFailing',
                'handlers.addToCartWithUndoFailing',
                [{ name: 'itemId', type: 'string', isRequired: true }],
                'removeFromCartFailing'
            );

            const removeFromCartFailing = createCapability(
                'removeFromCartFailing',
                'handlers.removeFromCartFailing',
                [{ name: 'itemId', type: 'string', isRequired: true }]
            )

            const placeOrder = createCapability(
                'placeOrder',
                'handlers.placeOrder',
                [{ name: 'paymentMethod', type: 'string', isRequired: true }],
                'cancelOrder'
            );

            const cancelOrder = createCapability(
                'cancelOrder',
                'handlers.cancelOrder',
                [{ name: 'paymentMethod', type: 'string', isRequired: true }]
            );

            manifest = createManifest([addToCart, removeFromCart, placeOrder, cancelOrder, addToCartWithUndoFailing, removeFromCartFailing]);

            handlers = {
                'handlers.addToCart': createMockHandler({ cartId: 'cart-123' }),
                'handlers.removeFromCart': createMockHandler({ success: true }),
                'handlers.placeOrder': createFailingHandler('Payment declined'),
                'handlers.cancelOrder': createMockHandler({ success: true }),
                'handlers.addToCartWithUndoFailing': createMockHandler({ cartId: 'cart-123' }),
                'handlers.removeFromCartFailing': createFailingHandler('Failed just because'),
            };

            engine = new Engine(manifest, handlers);
            const resolver = new ManifestResolver();
            resolver.load(manifest);
            executor = new StrategyExecutor(engine, manifest, resolver);
        });

        it('should rollback executed steps on failure when transactional', async () => {
            const strategy: Intent[] = [
                { capabilityId: 'addToCart', parameters: { itemId: 'item-1' } },
                { capabilityId: 'addToCart', parameters: { itemId: 'item-2' } },
                { capabilityId: 'placeOrder', parameters: { paymentMethod: 'credit-card' } }
            ];

            const result = await executor.executeStrategy(strategy, { transactional: true });

            expect(result.success).toBe(false);
            expect(result.rolledBack).toBe(true);
            expect(result.completedSteps).toBe(2);
            expect(handlers['handlers.removeFromCart']).toHaveBeenCalledTimes(2);
            expect(handlers['handlers.removeFromCart']).toHaveBeenNthCalledWith(
                1,
                { itemId: 'item-2' },
            );
            expect(handlers['handlers.removeFromCart']).toHaveBeenNthCalledWith(
                2,
                { itemId: 'item-1' },
            );
        });

        it('should not rollback when transactional option is false', async () => {
            const strategy: Intent[] = [
                { capabilityId: 'addToCart', parameters: { itemId: 'item-1' } },
                { capabilityId: 'placeOrder', parameters: { paymentMethod: 'credit-card' } }
            ];

            const result = await executor.executeStrategy(strategy, { transactional: false });

            expect(result.success).toBe(false);
            expect(result.rolledBack).toBeUndefined();
            expect(handlers['handlers.removeFromCart']).not.toHaveBeenCalled();
        });

        it('should warn about non-transactional capabilities during rollback', async () => {
            const nonTransactional = createCapability(
                'logEvent',
                'handlers.logEvent',
                [{ name: 'event', type: 'string', isRequired: true }]
                // No undoCapabilityId
            );

            engine.registerHandler('handlers.logEvent', createMockHandler({ logged: true }));

            manifest.capabilities['logEvent'] = nonTransactional;

            const strategy: Intent[] = [
                { capabilityId: 'logEvent', parameters: { event: 'cart-started' } },
                { capabilityId: 'addToCart', parameters: { itemId: 'item-1' } },
                { capabilityId: 'placeOrder', parameters: { paymentMethod: 'credit-card' } }
            ];

            const result = await executor.executeStrategy(strategy, { transactional: true });

            expect(result.rolledBack).toBe(true);
            expect(result.rollbackErrors).toContain(
                'Cannot undo "logEvent" - no undoHandler defined'
            );
        });

        it('should stop rollback on first undo failure', async () => {

            const strategy: Intent[] = [
                { capabilityId: 'addToCartWithUndoFailing', parameters: { itemId: 'item-1' } },
                { capabilityId: 'addToCartWithUndoFailing', parameters: { itemId: 'item-2' } },
                { capabilityId: 'placeOrder', parameters: { paymentMethod: 'credit-card' } }
            ];

            const result = await executor.executeStrategy(strategy, { transactional: true });

            expect(result.rolledBack).toBe(true);
            expect(result.rollbackErrors).toHaveLength(1);
            expect(result.rollbackErrors![0]).toMatch(/.* Failed just because/);
            expect(handlers['handlers.removeFromCartFailing']).toHaveBeenCalledTimes(1);
        });

        it('should handle exceptions during rollback', async () => {

            const strategy: Intent[] = [
                { capabilityId: 'addToCartWithUndoFailing', parameters: { itemId: 'item-1' } },
                { capabilityId: 'placeOrder', parameters: { paymentMethod: 'credit-card' } }
            ];

            const result = await executor.executeStrategy(strategy, { transactional: true });

            expect(result.rolledBack).toBe(true);
            expect(result.rollbackErrors).toHaveLength(1);
            expect(result.rollbackErrors![0]).toMatch(/.* Failed just because/);
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            const step1 = createCapability('step1', 'handlers.step1', []);
            const step2 = createCapability('step2', 'handlers.step2', [], undefined, [{ type: 'state', checker: { name: 'Test Checker', handlerRef: 'test.checker' }, errorMessage: 'Precondition not met', description: 'Test precondition' }]);
            const step3 = createCapability('step3', 'handlers.step3', []);

            manifest = createManifest([step1, step2, step3]);

            handlers = {
                'handlers.step1': createMockHandler({ data: 'success' }),
                'handlers.step2': jest.fn().mockRejectedValue(new Error('Precondition not met')),
                'handlers.step3': createMockHandler({ data: 'success' })
            };

            engine = new Engine(manifest, handlers);
            const resolver = new ManifestResolver();
            resolver.load(manifest);
            executor = new StrategyExecutor(engine, manifest, resolver);
        });

        it('should continue on non-critical errors when continueOnError is true', async () => {
            const strategy: Intent[] = [
                { capabilityId: 'step1', parameters: {} },
                { capabilityId: 'step2', parameters: {} },
                { capabilityId: 'step3', parameters: {} }
            ];

            const result = await executor.executeStrategy(strategy, { continueOnError: true });

            expect(result.success).toBe(true);
            expect(result.completedSteps).toBe(3);
            expect(handlers['handlers.step3']).toHaveBeenCalled();
        });

        it('should stop on non-critical errors when continueOnError is false', async () => {
            const strategy: Intent[] = [
                { capabilityId: 'step1', parameters: {} },
                { capabilityId: 'step2', parameters: {} },
                { capabilityId: 'step3', parameters: {} }
            ];

            const result = await executor.executeStrategy(strategy, { continueOnError: false });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('PRECONDITION_FAILED');
            expect(handlers['handlers.step3']).not.toHaveBeenCalled();
        });
    });

    describe('Complex Integration Scenarios', () => {
        it('should handle multi-step transactional flow with progressive collection', async () => {
            const addItem = createCapability(
                'addItem',
                'handlers.addItem',
                [{ name: 'itemId', type: 'string', isRequired: true }],
                'removeItem'
            );

            const removeItem = createCapability(
                'removeItem',
                'handlers.removeItem',
                [{ name: 'itemId', type: 'string', isRequired: true }]
            );

            const checkout = createCapability(
                'checkout',
                'handlers.checkout',
                [
                    { name: 'total', type: 'number', isRequired: true },
                    { name: 'cvv', type: 'string', isRequired: true, collectionApproach: 'on-demand', isSensitive: true }
                ],
                'cancelCheckout'
            );

            const cancelCheckout = createCapability(
                'cancelCheckout',
                'handlers.cancelCheckout',
                [{ name: 'total', type: 'number', isRequired: true }]
            );

            manifest = createManifest([addItem, removeItem, checkout, cancelCheckout]);

            handlers = {
                'handlers.addItem': createMockHandler({ cartTotal: 99.99 }),
                'handlers.removeItem': createMockHandler({ success: true }),
                'handlers.checkout': createFailingHandler('Invalid CVV'),
                'handlers.cancelCheckout': createMockHandler({ success: true })
            };

            engine = new Engine(manifest, handlers);
            const resolver = new ManifestResolver();
            resolver.load(manifest);
            executor = new StrategyExecutor(engine, manifest, resolver);

            const strategy: Intent[] = [
                { capabilityId: 'addItem', parameters: { itemId: 'item-1' } },
                { capabilityId: 'checkout', parameters: { total: 99.99 } }
            ];

            //pauses for CVV
            const pausedResult = await executor.executeStrategy(strategy, { transactional: true });
            expect(pausedResult.paused).toBe(true);
            expect(pausedResult.requiredInputs![0]?.parameter).toBe('cvv');

            //resumes with CVV, but checkout fails
            const finalResult = await executor.resumeStrategy(pausedResult.resumeToken!, { cvv: '000' });

            expect(finalResult.success).toBe(false);
            expect(finalResult.rolledBack).toBe(true);
            expect(handlers['handlers.removeItem']).toHaveBeenCalledWith({ itemId: 'item-1' });
        });
    });
});