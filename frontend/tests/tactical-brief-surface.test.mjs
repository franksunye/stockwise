import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/lib/tactical-brief-surface.ts')).href;
const {
    getPriceNodes,
    getScenarioTacticGroups,
    getShortPressureState,
    normalizeLegacyTerms,
} = await import(moduleUrl);

const SAMPLE_DATA = {
    summary: 'test',
    reasoning_trace: [],
    tactics: {
        holding_profit: [
            { priority: 'p2', action: '执行落袋', trigger: '接近压力', reason: '保护利润' },
            { priority: 'P1', action: '执行观察', trigger: '不跌破一防位', reason: '趋势仍在' },
            { priority: 'P1', action: '执行观察', trigger: '不跌破一防位', reason: '重复项应去重' },
        ],
        holding_loss: [],
        empty: [
            { priority: 'P2', action: '执行交易', trigger: '放量突破一攻位', reason: '确认后再跟进' },
        ],
        holding: [],
        general: { priority: 'P3', action: '执行观察', trigger: '量能配合', reason: '观察为主' },
    },
    key_levels: {
        immediate_resistance: [112, 112, 108],
        breakout_confirmation_level: 105,
        immediate_support: [96],
        stop_loss_reference: '92',
        support: 96,
        resistance: 108,
        stop_loss: 92,
    },
    conflict_resolution: '遵循趋势优先原则。',
};

describe('tactical brief surface helpers', () => {
    it('dedupes and fills scenario tactics to stable two-card output', () => {
        const { scenarioHoldingProfit, scenarioHoldingLoss, scenarioEmpty } = getScenarioTacticGroups(SAMPLE_DATA);

        assert.equal(scenarioHoldingProfit.length, 2);
        assert.equal(scenarioHoldingProfit[0].priority, 'P1');
        assert.equal(scenarioHoldingProfit[1].priority, 'P2');
        assert.equal(scenarioHoldingLoss.length, 2);
        assert.equal(scenarioHoldingLoss[0].__placeholder, true);
        assert.equal(scenarioEmpty.length, 2);
        assert.equal(scenarioEmpty[1].__placeholder, true);
    });

    it('builds sorted price nodes without duplicate dots', () => {
        const nodes = getPriceNodes(SAMPLE_DATA, 100);
        const prices = nodes.map((node) => node.price);

        assert.deepEqual(prices, [112, 108, 105, 100, 96, 92]);
        assert.equal(nodes.find((node) => node.kind === 'current')?.label, '当前价');
    });

    it('classifies HK short pressure bands and non-HK fallback', () => {
        const hkHigh = getShortPressureState('00700', { short_turnover_ratio: 0.19 });
        const hkMissing = getShortPressureState('00700', { short_turnover_ratio: null });
        const usStock = getShortPressureState('AAPL', { short_turnover_ratio: 0.3 });

        assert.equal(hkHigh.label, '高');
        assert.equal(hkHigh.shortRatio, 0.19);
        assert.equal(hkMissing.label, '待同步');
        assert.equal(usStock.label, '--');
        assert.match(usStock.interpretation, /仅港股显示/);
    });

    it('normalizes legacy tactical wording for newer copy', () => {
        const text = normalizeLegacyTerms('建议进场，等待触发进攻条件，若出现进攻候选即可进攻。');

        assert.equal(text, '建议看多，等待触发交易条件，若出现看多候选即可交易。');
    });
});
