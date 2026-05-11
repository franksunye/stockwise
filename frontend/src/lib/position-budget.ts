export type PositionBudgetRMode = 'system_followed' | 'fixed_stop' | 'percent_stop';

export interface PositionBudgetInput {
  accountSize: number;
  riskRatio: number;
  entryPrice: number;
  targetPrice?: number | null;
  rMode: PositionBudgetRMode;
  systemStopLossPrice?: number | null;
  fixedStopLossPrice?: number | null;
  stopPercent?: number | null;
}

export interface PositionBudgetOutput {
  ok: boolean;
  errors: string[];
  warnings: string[];
  resolvedStopLossPrice: number | null;
  riskAmount: number;
  riskPerShare: number;
  positionSize: number;
  expectedLoss: number;
  expectedProfit: number | null;
  rMultiple: number | null;
}

const RISK_RATIO_WARN = 0.02;
const RISK_RATIO_MAX = 0.05;
const RISK_RATIO_MIN = 0.001;
const STOP_PERCENT_MIN = 0.01;
const STOP_PERCENT_MAX = 0.1;

export function isValidPositionBudgetSymbol(input: string): boolean {
  return /^[A-Z0-9][A-Z0-9.-]{0,15}$/.test(input);
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computePositionBudget(input: PositionBudgetInput): PositionBudgetOutput {
  const errors: string[] = [];
  const warnings: string[] = [];

  const accountSize = toFiniteNumber(input.accountSize);
  const riskRatio = toFiniteNumber(input.riskRatio);
  const entryPrice = toFiniteNumber(input.entryPrice);
  const targetPrice = toFiniteNumber(input.targetPrice ?? null);

  if (accountSize === null || accountSize <= 0) {
    errors.push('Invalid account size');
  }
  if (riskRatio === null) {
    errors.push('Invalid risk ratio');
  } else {
    if (riskRatio < RISK_RATIO_MIN) errors.push('Risk ratio must be at least 0.1%');
    if (riskRatio > RISK_RATIO_MAX) errors.push('Risk ratio must not exceed 5%');
    if (riskRatio > RISK_RATIO_WARN) warnings.push('Risk ratio is above 2%');
  }
  if (entryPrice === null || entryPrice <= 0) {
    errors.push('Invalid entry price');
  }

  let resolvedStopLossPrice: number | null = null;
  if (input.rMode === 'percent_stop') {
    const stopPercent = toFiniteNumber(input.stopPercent);
    if (stopPercent === null) {
      errors.push('Missing stop percent');
    } else if (stopPercent < STOP_PERCENT_MIN || stopPercent > STOP_PERCENT_MAX) {
      errors.push('Stop percent must be between 1% and 10%');
    } else if (entryPrice !== null) {
      resolvedStopLossPrice = entryPrice * (1 - stopPercent);
    }
  } else if (input.rMode === 'fixed_stop') {
    resolvedStopLossPrice = toFiniteNumber(input.fixedStopLossPrice);
  } else {
    resolvedStopLossPrice = toFiniteNumber(input.systemStopLossPrice);
  }

  if (resolvedStopLossPrice === null || resolvedStopLossPrice <= 0) {
    errors.push('Invalid stop loss price');
  }

  if (errors.length > 0 || accountSize === null || riskRatio === null || entryPrice === null || resolvedStopLossPrice === null) {
    return {
      ok: false,
      errors,
      warnings,
      resolvedStopLossPrice,
      riskAmount: 0,
      riskPerShare: 0,
      positionSize: 0,
      expectedLoss: 0,
      expectedProfit: null,
      rMultiple: null,
    };
  }

  const riskPerShare = entryPrice - resolvedStopLossPrice;
  if (riskPerShare <= 0) {
    errors.push('Entry price must be greater than stop loss price');
  }

  const riskAmount = accountSize * riskRatio;
  const positionSize = riskPerShare > 0 ? Math.floor(riskAmount / riskPerShare) : 0;
  const expectedLoss = positionSize * riskPerShare;
  const notional = positionSize * entryPrice;

  if (positionSize <= 0) {
    errors.push('Position size is zero under current parameters');
  }
  if (notional > accountSize) {
    errors.push('Position notional exceeds account size');
  }

  let expectedProfit: number | null = null;
  let rMultiple: number | null = null;
  if (targetPrice !== null && targetPrice > entryPrice && riskPerShare > 0) {
    expectedProfit = positionSize * (targetPrice - entryPrice);
    rMultiple = (targetPrice - entryPrice) / riskPerShare;
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    resolvedStopLossPrice: roundMoney(resolvedStopLossPrice),
    riskAmount: roundMoney(riskAmount),
    riskPerShare: roundMoney(riskPerShare),
    positionSize,
    expectedLoss: roundMoney(expectedLoss),
    expectedProfit: expectedProfit === null ? null : roundMoney(expectedProfit),
    rMultiple: rMultiple === null ? null : Number(rMultiple.toFixed(4)),
  };
}
