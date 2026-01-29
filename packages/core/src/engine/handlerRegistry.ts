import type { HandlerFunction } from './types';

export class HandlerRegistry {
    private handlers = new Map<string, HandlerFunction>();

    register(handlerRef: string, handler: HandlerFunction): void {
        if (!handlerRef || typeof handlerRef !== 'string') {
            throw new Error('Handler reference must be a non-empty string');
        }

        if (typeof handler !== 'function') {
            throw new Error(`Handler for "${handlerRef}" must be a function`);
        }

        this.handlers.set(handlerRef, handler);
    }

    registerMany(handlers: Record<string, HandlerFunction>): void {
        for (const [handlerRef, handler] of Object.entries(handlers)) {
            this.register(handlerRef, handler);
        }
    }

    get(handlerRef: string): HandlerFunction | null {
        return this.handlers.get(handlerRef) || null;
    }

    has(handlerRef: string): boolean {
        return this.handlers.has(handlerRef);
    }

    unregister(handlerRef: string): void {
        this.handlers.delete(handlerRef);
    }

    clear(): void {
        this.handlers.clear();
    }

    getRegisteredRefs(): string[] {
        return Array.from(this.handlers.keys());
    }

    get size(): number {
        return this.handlers.size;
    }
}