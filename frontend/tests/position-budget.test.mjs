import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/lib/position-budget.ts')).href;
const {
  buildPositionBudgetVerdict,
  computePositionBudget,
  isValidPositionBudgetSymbol,
} = await import(moduleUrl);

describe('position budget compute', () => {
  it('computes fixed-stop risk budget and R multiple', () => {
    const result = computePositionBudget({
      accountSize: 100_000,
      riskRatio: 0.01,
      entryPrice: 100,
      targetPrice: 120,
      rMode: 'fixed_stop',
      fixedStopLossPrice: 95,
    });

    assert.equal(result.ok, true);
    assert.equal(result.riskAmount, 1000);
    assert.equal(result.riskPerShare, 5);
    assert.equal(result.positionSize, 200);
    assert.equal(result.expectedLoss, 1000);
    assert.equal(result.positionValue, 20_000);
    assert.equal(result.accountExposurePercent, 20);
    assert.equal(result.rMultiple, 4);

    const verdict = buildPositionBudgetVerdict(result);
    assert.equal(verdict.status, 'VALID');
    assert.equal(verdict.checks.some((check) => check.key === 'exposure' && check.status === 'PASS'), true);
  });

  it('warns above 2% risk and blocks above 5%', () => {
    const warning = computePositionBudget({
      accountSize: 100_000,
      riskRatio: 0.021,
      entryPrice: 100,
      rMode: 'fixed_stop',
      fixedStopLossPrice: 95,
    });
    assert.equal(warning.ok, true);
    assert.deepEqual(warning.warnings, ['Risk ratio is above 2%']);
    assert.equal(buildPositionBudgetVerdict(warning).status, 'WARNING');

    const blocked = computePositionBudget({
      accountSize: 100_000,
      riskRatio: 0.051,
      entryPrice: 100,
      rMode: 'fixed_stop',
      fixedStopLossPrice: 95,
    });
    assert.equal(blocked.ok, false);
    assert.ok(blocked.errors.includes('Risk ratio must not exceed 5%'));
    assert.equal(buildPositionBudgetVerdict(blocked).status, 'INVALID');
  });

  it('supports percent stop mode boundaries', () => {
    const valid = computePositionBudget({
      accountSize: 50_000,
      riskRatio: 0.01,
      entryPrice: 100,
      rMode: 'percent_stop',
      stopPercent: 0.05,
    });
    assert.equal(valid.ok, true);
    assert.equal(valid.resolvedStopLossPrice, 95);

    const invalid = computePositionBudget({
      accountSize: 50_000,
      riskRatio: 0.01,
      entryPrice: 100,
      rMode: 'percent_stop',
      stopPercent: 0.2,
    });
    assert.equal(invalid.ok, false);
    assert.ok(invalid.errors.includes('Stop percent must be between 1% and 10%'));
  });

  it('blocks position notional that exceeds account size', () => {
    const result = computePositionBudget({
      accountSize: 10_000,
      riskRatio: 0.05,
      entryPrice: 100,
      rMode: 'fixed_stop',
      fixedStopLossPrice: 99,
    });

    assert.equal(result.ok, false);
    assert.ok(result.errors.includes('Position notional exceeds account size'));
    assert.equal(buildPositionBudgetVerdict(result).status, 'INVALID');
  });

  it('returns incomplete verdict for missing required fields', () => {
    const result = computePositionBudget({
      accountSize: 0,
      riskRatio: 0,
      entryPrice: 0,
      rMode: 'fixed_stop',
      fixedStopLossPrice: null,
    });

    const verdict = buildPositionBudgetVerdict(result);
    assert.equal(verdict.status, 'INCOMPLETE');
    assert.equal(verdict.checks[0].status, 'PENDING');
  });

  it('warns when actual R multiple is below discipline target', () => {
    const result = computePositionBudget({
      accountSize: 100_000,
      riskRatio: 0.01,
      entryPrice: 100,
      targetPrice: 106,
      rMode: 'fixed_stop',
      fixedStopLossPrice: 95,
    });

    const verdict = buildPositionBudgetVerdict(result);
    assert.equal(result.rMultiple, 1.2);
    assert.equal(verdict.status, 'WARNING');
    assert.equal(verdict.checks.some((check) => check.key === 'r_multiple' && check.status === 'WARN'), true);
  });
});

describe('position budget symbol validation', () => {
  it('accepts common CN/HK/US symbol shapes', () => {
    assert.equal(isValidPositionBudgetSymbol('600519'), true);
    assert.equal(isValidPositionBudgetSymbol('00700'), true);
    assert.equal(isValidPositionBudgetSymbol('AAPL'), true);
    assert.equal(isValidPositionBudgetSymbol('BRK.B'), true);
    assert.equal(isValidPositionBudgetSymbol('RDS-A'), true);
  });

  it('rejects empty, unsafe, or overly long symbols', () => {
    assert.equal(isValidPositionBudgetSymbol(''), false);
    assert.equal(isValidPositionBudgetSymbol('../AAPL'), false);
    assert.equal(isValidPositionBudgetSymbol('AAPL;DROP'), false);
    assert.equal(isValidPositionBudgetSymbol('TOO-LONG-SYMBOL-123'), false);
  });
});
