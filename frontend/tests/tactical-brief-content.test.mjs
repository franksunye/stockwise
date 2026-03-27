import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/lib/tactical-brief-content.ts')).href;
const {
    getFirstSentence,
    getNormalizedNewsItems,
    getPosterSurface,
    getTacticalConflictSummary,
    getTacticalSummary,
    parseTacticalData,
} = await import(moduleUrl);

const reasoning = JSON.stringify({
    summary: '建议进场，等待触发进攻条件。',
    conflict_resolution: '触发进攻条件前，以观察为主。',
    reasoning_trace: [{ step: 'news', data: '建议进场，观察消息催化。', conclusion: '保持耐心' }],
    tactics: {
        holding_profit: [{ priority: 'P1', action: '建议进场', trigger: '回踩企稳', reason: '顺势参与' }],
        holding_loss: [],
        empty: [{ priority: 'P1', action: '可进攻', trigger: '突破确认', reason: '右侧信号' }],
        general: [{ priority: 'P3', action: '观察', trigger: '量能未放大', reason: '等待信号' }],
    },
    news_analysis: ['建议进场，等待触发进攻条件。', '进攻候选开始浮现。'],
    key_levels: {
        strong_resistance: '120',
        stop_loss_reference: '94',
        support: 94,
        resistance: 120,
        stop_loss: 94,
    },
    visual_story: {
        token: '微光潜行',
        almanac: '宜：静待时机',
        visual_state: 'stable',
        aesthetic: { hue: 'indigo-emerald', mood: '晨雾', dynamic_clues: [] },
        meta_version: 'v4',
    },
});

describe('tactical brief content helpers', () => {
    it('parses tactical reasoning payload safely', () => {
        assert.equal(parseTacticalData(reasoning)?.summary, '建议进场，等待触发进攻条件。');
        assert.equal(parseTacticalData('not json'), null);
    });

    it('normalizes summary and conflict text for council usage', () => {
        assert.equal(getTacticalSummary(reasoning), '建议看多，等待触发交易条件。');
        assert.equal(getTacticalConflictSummary(reasoning), '触发交易条件前，以观察为主。');
        assert.equal(getFirstSentence('第一句。第二句。'), '第一句。');
    });

    it('normalizes news items into a stable list', () => {
        assert.deepEqual(getNormalizedNewsItems(parseTacticalData(reasoning)), [
            '建议看多，等待触发交易条件。',
            '看多候选开始浮现。',
        ]);
    });

    it('builds poster surface with user-position-aware tactic fallback', () => {
        const prediction = {
            symbol: '00700',
            target_date: '2026-03-27',
            confidence: 0.83,
            ai_reasoning: reasoning,
        };

        const holdingSurface = getPosterSurface({ prediction, userPos: 'holding' });
        const emptySurface = getPosterSurface({ prediction, userPos: 'empty' });

        assert.equal(holdingSurface.story?.token, '微光潜行');
        assert.equal(holdingSurface.tacticText, '建议看多');
        assert.equal(emptySurface.tacticText, '可交易');
        assert.equal(holdingSurface.resistanceText, '120');
        assert.equal(holdingSurface.supportText, '94');
        assert.match(holdingSurface.intelligence, /建议看多/);
    });
});
