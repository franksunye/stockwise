import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/lib/dashboard-symbol-navigation.ts')).href;
const {
    matchesDashboardSymbol,
    normalizeDashboardSymbol,
    readDashboardSymbolFromSearchParams,
    resolveDashboardPreferredSymbol,
} = await import(moduleUrl);

describe('dashboard symbol navigation helpers', () => {
    it('normalizes symbol input to uppercase trimmed values', () => {
        assert.equal(normalizeDashboardSymbol('  aapl '), 'AAPL');
        assert.equal(normalizeDashboardSymbol(''), null);
    });

    it('matches exact or suffix symbols consistently', () => {
        assert.equal(matchesDashboardSymbol('US.AAPL', 'AAPL'), true);
        assert.equal(matchesDashboardSymbol('AAPL', 'AAPL'), true);
        assert.equal(matchesDashboardSymbol('00700', 'AAPL'), false);
    });

    it('prefers search param symbol over nav intent when both are present', () => {
        const preferred = resolveDashboardPreferredSymbol({
            searchSymbol: '09988',
            navIntentSymbol: 'AAPL',
            availableSymbols: ['AAPL', '09988', '00700'],
        });

        assert.equal(preferred, '09988');
    });

    it('falls back to nav intent symbol when search param is absent', () => {
        const preferred = resolveDashboardPreferredSymbol({
            searchSymbol: null,
            navIntentSymbol: 'AAPL',
            availableSymbols: ['US.AAPL', '09988'],
        });

        assert.equal(preferred, 'US.AAPL');
    });

    it('reads symbol from URLSearchParams-compatible input', () => {
        const params = new URLSearchParams('symbol=00700&brief=true');
        assert.equal(readDashboardSymbolFromSearchParams(params), '00700');
    });
});
