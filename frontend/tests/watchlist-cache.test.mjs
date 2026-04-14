import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/lib/watchlist-cache.ts')).href;
const {
    WATCHLIST_LAST_SYNC_TS_KEY,
    WATCHLIST_STORAGE_KEY,
    hasFreshBootstrapWatchlist,
    readCachedWatchlist,
    writeCachedWatchlist,
} = await import(moduleUrl);

describe('watchlist cache helpers', () => {
    it('round-trips structured watchlist rows', () => {
        const store = new Map();
        globalThis.window = {
            localStorage: {
                getItem: (key) => store.get(key) ?? null,
                setItem: (key, value) => store.set(key, value),
                removeItem: (key) => store.delete(key),
            },
        };

        writeCachedWatchlist([
            { symbol: '00700', name: 'Tencent', name_en: 'Tencent', addedAt: 1234 },
        ], { syncedAt: 5000 });

        assert.equal(store.get(WATCHLIST_STORAGE_KEY)?.includes('Tencent'), true);
        assert.equal(store.get(WATCHLIST_LAST_SYNC_TS_KEY), '5000');
        assert.deepEqual(readCachedWatchlist(), [
            { symbol: '00700', name: 'Tencent', name_en: 'Tencent', addedAt: 1234 },
        ]);
        assert.equal(hasFreshBootstrapWatchlist(5001), true);

        delete globalThis.window;
    });

    it('does not overwrite sync timestamp for optimistic local mutations', () => {
        const store = new Map([[WATCHLIST_LAST_SYNC_TS_KEY, '2000']]);
        globalThis.window = {
            localStorage: {
                getItem: (key) => store.get(key) ?? null,
                setItem: (key, value) => store.set(key, value),
                removeItem: (key) => store.delete(key),
            },
        };

        writeCachedWatchlist([
            { symbol: '09988', name: 'Alibaba', addedAt: 3456 },
        ], { markSynced: false });

        assert.equal(store.get(WATCHLIST_LAST_SYNC_TS_KEY), '2000');
        delete globalThis.window;
    });
});
