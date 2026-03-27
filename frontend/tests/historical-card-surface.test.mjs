import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/lib/historical-card-surface.ts')).href;
const {
    formatHistoricalCardDate,
    getHistoricalCardSurface,
} = await import(moduleUrl);

describe('historical card surface helpers', () => {
    it('parses summary and base snapshot from payload', () => {
        const surface = getHistoricalCardSurface({
            ai_reasoning: JSON.stringify({ summary: '量化建议保持观察。' }),
            close_price: 100,
            layer1_payload: JSON.stringify({ close: 98.5, change_percent: -1.2 }),
            validation_data: null,
            validation_status: 'Pending',
        });

        assert.equal(surface.displayReason, '量化建议保持观察。');
        assert.equal(surface.basePrice, 98.5);
        assert.equal(surface.baseChange, -1.2);
    });

    it('maps validation status to stable labels', () => {
        const correct = getHistoricalCardSurface({
            ai_reasoning: 'plain text',
            close_price: 100,
            validation_data: { window: 3 },
            validation_status: 'Correct',
        });
        const verifying = getHistoricalCardSurface({
            ai_reasoning: 'plain text',
            close_price: 100,
            validation_data: { window: 5 },
            validation_status: 'Verifying',
        });

        assert.equal(correct.validationStyle.label, '3日回看通过');
        assert.equal(correct.validationStyle.iconName, 'correct');
        assert.equal(verifying.validationStyle.label, '5日回看中');
        assert.equal(verifying.validationStyle.iconName, 'verifying');
    });

    it('formats target dates as MM/DD', () => {
        assert.equal(formatHistoricalCardDate('2026-03-27'), '03/27');
    });
});
