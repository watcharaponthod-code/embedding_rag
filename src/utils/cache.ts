type CacheEntry<T> = {
    value: T;
    expiry: number;
};

export class SimpleCache<T> {
    private cache: Map<string, CacheEntry<T>> = new Map();
    private ttlMs: number;
    private maxSize: number;

    constructor(ttlSeconds: number = 3600, maxSize: number = 1000) {
        this.ttlMs = ttlSeconds * 1000;
        this.maxSize = maxSize;
    }

    get(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return null;
        }

        // Refresh expiry on hit? Optional. Let's keep it simple (strict TTL).
        return entry.value;
    }

    set(key: string, value: T): void {
        if (this.cache.size >= this.maxSize) {
            // Simple eviction: remove the oldest inserted (first key in Map iterator)
            const firstKey = this.cache.keys().next().value;
            if (firstKey) this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            value,
            expiry: Date.now() + this.ttlMs
        });
    }

    clear(): void {
        this.cache.clear();
    }
}

// Export a singleton for search results (1 hour cache)
export const searchCache = new SimpleCache<any[]>(3600);
