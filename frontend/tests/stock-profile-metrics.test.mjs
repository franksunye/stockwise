import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/lib/stock-profile-metrics.ts')).href;
const {
    formatStockProfileHistoryLabel,
    getStockProfileStats,
} = await import(moduleUrl);

describe('stock profile metric helpers', () => {
    it('computes win rate from correct and incorrect validations only', () => {
        const stats = getStockProfileStats([
            { validation_status: 'Correct' },
            { validation_status: 'Correct' },
            { validation_status: 'Incorrect' },
            { validation_status: 'Pending' },
        ]);

        assert.deepEqual(stats, {
            winCount: 2,
            totalCount: 3,
            winRate: 67,
        });
    });

    it('formats target date labels as MM/DD', () => {
        assert.equal(formatStockProfileHistoryLabel('2026-03-26'), '03/26');
    });
});
