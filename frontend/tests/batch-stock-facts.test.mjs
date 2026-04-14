import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/lib/batch-stock-facts.ts')).href;
const {
    buildStockFacts,
    getBatchUiSignalModeForTier,
    projectPredictionForTier,
} = await import(moduleUrl);

describe('batch stock facts helpers', () => {
    it('keeps signal-first semantics for free/go/plus and strips mode-only fields', () => {
        const base = {
            symbol: '00700',
            signal: 'Long',
            canonical_signal: 'Side',
            layer1_status: 'TriggeredLong',
            layer1_signal: 'Watch',
            decision_semantic: '建议看多',
            effective_decision_semantic: '建议看多',
            effective_layer1_status: 'TriggeredLong',
            mode_id: 'balanced_v1',
            producer_outcome_view: { producer_id: 'deepseek-v3' },
        };

        const projected = projectPredictionForTier(base, 'go');
        assert.equal(projected.signal, 'Side');
        assert.equal(projected.layer1_status, 'Watch');
        assert.equal(projected.mode_id, undefined);
        assert.equal(projected.decision_semantic, undefined);
        assert.equal(projected.effective_decision_semantic, undefined);
    });

    it('preserves layer1-capable fields for future pro/alpha tiers', () => {
        const base = {
            symbol: '00700',
            signal: 'Long',
            canonical_signal: 'Side',
            layer1_status: 'TriggeredLong',
            layer1_signal: 'Watch',
        };

        const projected = projectPredictionForTier(base, 'pro');
        assert.equal(projected.signal, 'Long');
        assert.equal(projected.layer1_status, 'TriggeredLong');
    });

    it('builds lite facts payload without heavy history arrays', () => {
        const stocks = buildStockFacts({
            symbols: ['00700'],
            latestPrices: [{
                symbol: '00700',
                close: 320.5,
                change_percent: 1.2,
                ma5: 100,
            }],
            shortMetricsRows: [],
            allHistory: [{
                symbol: '00700',
                date: '2026-04-14',
                signal: 'Long',
                canonical_signal: 'Long',
                ai_reasoning: '{"summary":"ok"}',
                layer1_status: 'TriggeredLong',
                layer1_signal: 'TriggeredLong',
            }],
            historyLimit: 1,
            tier: 'free',
            lastUpdated: '04-14 15:30',
            validDateThreshold: '2026-03-01',
        });

        assert.equal(stocks.length, 1);
        assert.equal(stocks[0].symbol, '00700');
        assert.equal(stocks[0].history, undefined);
        assert.equal(stocks[0].prediction.signal, 'Long');
        assert.equal(stocks[0].price.ma5, undefined);
    });

    it('reports tier signal mode contract for v1 and future tiers', () => {
        assert.equal(getBatchUiSignalModeForTier('free'), 'signal');
        assert.equal(getBatchUiSignalModeForTier('go'), 'signal');
        assert.equal(getBatchUiSignalModeForTier('plus'), 'signal');
        assert.equal(getBatchUiSignalModeForTier('pro'), 'layer1_status');
    });
});
