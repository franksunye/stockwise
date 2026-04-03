import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/lib/stock-dashboard-card-surface.ts')).href;
const {
    getStockDashboardCardSurface,
    getStockDashboardCardTitle,
} = await import(moduleUrl);

const prediction = {
    target_date: '2026-03-27',
    ai_reasoning: JSON.stringify({
        summary: '主升浪延续，优先沿趋势处理。',
        tactics: {
            holding_profit: [{ priority: 'P1', action: '执行落袋', trigger: '接近压力位', reason: '锁定利润' }],
            holding: [{ priority: 'P1', action: '执行观察', trigger: '不破防守位', reason: '继续持有' }],
            empty: [{ priority: 'P1', action: '执行交易', trigger: '放量突破', reason: '确认后跟进' }],
            general: [{ priority: 'P3', action: '等待', trigger: '量能不足', reason: '暂不出手' }],
            holding_loss: [],
        },
    }),
};

describe('stock dashboard card surface helpers', () => {
    it('formats title based on target date freshness', () => {
        const normalizeTargetDate = (value) => value || '';

        assert.equal(getStockDashboardCardTitle({
            displayPrediction: prediction,
            todayStr: '2026-03-27',
            fallbackTitle: '明日建议',
            normalizeTargetDate,
        }), '今日建议');

        assert.equal(getStockDashboardCardTitle({
            displayPrediction: { ...prediction, target_date: '2026-03-26' },
            todayStr: '2026-03-27',
            fallbackTitle: '明日建议',
            normalizeTargetDate,
        }), '3/26 建议');
    });

    it('selects user-position-aware top tactic and summary', () => {
        const holding = getStockDashboardCardSurface({ displayPrediction: prediction, position: 'holding' });
        const empty = getStockDashboardCardSurface({ displayPrediction: prediction, position: 'empty' });

        assert.equal(holding.summaryText, '主升浪延续，优先沿趋势处理。');
        assert.equal(holding.topTactic?.action, '执行观察');
        assert.equal(empty.topTactic?.action, '执行交易');
    });

    it('falls back to pending copy when no prediction exists', () => {
        const surface = getStockDashboardCardSurface({ displayPrediction: null, position: 'empty' });

        assert.equal(surface.tacticalData, null);
        assert.equal(surface.pendingKey, 'common.noData');
    });
});
