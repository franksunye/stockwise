import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/lib/dashboard-modal-context.ts')).href;
const {
    createDashboardTacticalSelection,
    findDashboardSelectedStock,
    getBriefDrawerSymbol,
    getDashboardActiveModal,
    getDashboardContentStock,
} = await import(moduleUrl);

describe('dashboard modal context helpers', () => {
    it('treats almanac cards as modal-independent context', () => {
        assert.equal(getDashboardContentStock(null), null);
        assert.equal(getDashboardContentStock({ symbol: 'MARKET_ALMANAC', isAlmanac: true }), null);
        assert.deepEqual(getDashboardContentStock({ symbol: 'AAPL', isAlmanac: false }), { symbol: 'AAPL', isAlmanac: false });
    });

    it('binds brief drawer only to real stock symbols', () => {
        assert.equal(getBriefDrawerSymbol({ symbol: 'AAPL' }), 'AAPL');
        assert.equal(getBriefDrawerSymbol({ symbol: 'MARKET_ALMANAC', isAlmanac: true }), undefined);
    });

    it('creates explicit tactical selection and resolves selected stock', () => {
        const prediction = { symbol: 'AAPL', ai_reasoning: '{}' };
        const selection = createDashboardTacticalSelection('AAPL', prediction);
        const selectedStock = findDashboardSelectedStock([{ symbol: 'AAPL' }, { symbol: 'MSFT' }], selection.symbol);

        assert.equal(selection.symbol, 'AAPL');
        assert.equal(selectedStock?.symbol, 'AAPL');
        assert.equal(findDashboardSelectedStock([{ symbol: 'MSFT' }], selection.symbol), null);
    });

    it('reports the highest-priority active modal consistently', () => {
        assert.equal(getDashboardActiveModal({
            userCenterOpen: false,
            briefOpen: false,
            selectedTactics: null,
            profileStock: null,
        }), 'none');

        assert.equal(getDashboardActiveModal({
            userCenterOpen: true,
            briefOpen: true,
            selectedTactics: null,
            profileStock: null,
        }), 'brief');

        assert.equal(getDashboardActiveModal({
            userCenterOpen: true,
            briefOpen: true,
            selectedTactics: { symbol: 'AAPL', prediction: { symbol: 'AAPL' } },
            profileStock: { symbol: 'AAPL' },
        }), 'tactics');
    });
});
