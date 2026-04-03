import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/lib/stock-profile-history.ts')).href;
const {
    STOCK_PROFILE_HISTORY_CACHE_TTL_MS,
    clearStockProfileHistoryCache,
    normalizeStockProfileHistoryResponse,
    readStockProfileHistoryCache,
    resolveStockProfileHistory,
    writeStockProfileHistoryCache,
} = await import(moduleUrl);

describe('stock profile history helpers', () => {
    it('returns cached history within ttl and expires it afterward', () => {
        clearStockProfileHistoryCache();

        const now = 1_000_000;
        const predictions = [{ symbol: '00700', target_date: '2026-03-26' }];

        writeStockProfileHistoryCache('00700', predictions, 'cn', now);
        assert.deepEqual(readStockProfileHistoryCache('00700', 'cn', now + 1), predictions);
        assert.equal(
            readStockProfileHistoryCache(
                '00700',
                'cn',
                now + STOCK_PROFILE_HISTORY_CACHE_TTL_MS
            ),
            null
        );
    });

    it('normalizes predictions payloads defensively', () => {
        assert.deepEqual(
            normalizeStockProfileHistoryResponse({
                predictions: [{ symbol: '09988' }],
            }),
            [{ symbol: '09988' }]
        );
        assert.deepEqual(normalizeStockProfileHistoryResponse({ predictions: null }), []);
        assert.deepEqual(normalizeStockProfileHistoryResponse(null), []);
    });

    it('prefers loaded history and falls back to stock history when empty', () => {
        const fallbackHistory = [{ symbol: '00700', target_date: '2026-03-25' }];
        const loadedHistory = [{ symbol: '00700', target_date: '2026-03-26' }];

        assert.deepEqual(
            resolveStockProfileHistory(loadedHistory, fallbackHistory),
            loadedHistory
        );
        assert.deepEqual(
            resolveStockProfileHistory([], fallbackHistory),
            fallbackHistory
        );
    });
});
