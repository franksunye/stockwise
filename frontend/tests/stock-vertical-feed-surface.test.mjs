import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/lib/stock-vertical-feed-surface.ts')).href;
const {
    getStockFeedCards,
    getVerticalLayerState,
    resolveClosestHistoryIndex,
} = await import(moduleUrl);

describe('stock vertical feed surface helpers', () => {
    const history = [
        { target_date: '2026-03-27' },
        { target_date: '2026-03-26' },
        { target_date: '2026-03-25' },
        { target_date: '2026-03-21' },
    ];

    it('always keeps today card first and appends history cards', () => {
        const cards = getStockFeedCards({
            prediction: { target_date: '2026-03-27' },
            history,
        });

        assert.equal(cards[0].kind, 'today');
        assert.equal(cards.length, 4);
        assert.equal(cards[1].prediction?.target_date, '2026-03-26');
    });

    it('resolves exact and nearest earlier history positions', () => {
        assert.equal(resolveClosestHistoryIndex(history, '2026-03-25'), 2);
        assert.equal(resolveClosestHistoryIndex(history, '2026-03-24'), 3);
    });

    it('maps feed index to stable vertical layer state', () => {
        assert.deepEqual(getVerticalLayerState(history, 0), { type: 'today', date: null });
        assert.deepEqual(getVerticalLayerState(history, 2), { type: 'history', date: '2026-03-25' });
    });
});
