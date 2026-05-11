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
  positionValue: number;
  accountExposurePercent: number;
  expectedProfit: number | null;
  rMultiple: number | null;
}

export type PositionBudgetVerdictStatus = 'VALID' | 'WARNING' | 'INVALID' | 'INCOMPLETE';

export interface PositionBudgetVerdictCheck {
  key: 'required_fields' | 'risk_cap' | 'stop_distance' | 'position_size' | 'exposure' | 'r_multiple';
  label: string;
  status: 'PASS' | 'WARN' | 'FAIL' | 'PENDING';
}

export interface PositionBudgetVerdict {
  status: PositionBudgetVerdictStatus;
  grade: 'A' | 'B+' | 'C' | '—';
  title: string;
  summary: string;
  checks: PositionBudgetVerdictCheck[];
}

const RISK_RATIO_WARN = 0.02;
const RISK_RATIO_MAX = 0.05;
const RISK_RATIO_MIN = 0.001;
const STOP_PERCENT_MIN = 0.01;
const STOP_PERCENT_MAX = 0.1;
const EXPOSURE_WARN_PERCENT = 30;
const EXPOSURE_INVALID_PERCENT = 100;
const R_MULTIPLE_WARN = 2;

const INCOMPLETE_ERRORS = new Set([
  'Invalid account size',
  'Invalid risk ratio',
  'Invalid entry price',
  'Missing stop percent',
  'Invalid stop loss price',
]);

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
      positionValue: 0,
      accountExposurePercent: 0,
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
  const positionValue = positionSize * entryPrice;
  const accountExposurePercent = accountSize > 0 ? (positionValue / accountSize) * 100 : 0;

  if (positionSize <= 0) {
    errors.push('Position size is zero under current parameters');
  }
  if (positionValue > accountSize) {
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
    positionValue: roundMoney(positionValue),
    accountExposurePercent: Number(accountExposurePercent.toFixed(2)),
    expectedProfit: expectedProfit === null ? null : roundMoney(expectedProfit),
    rMultiple: rMultiple === null ? null : Number(rMultiple.toFixed(4)),
  };
}

function hasIncompleteError(errors: string[]): boolean {
  return errors.some((error) => INCOMPLETE_ERRORS.has(error));
}

function checkKeyForError(error: string): PositionBudgetVerdictCheck['key'] {
  if (error === 'Position size is zero under current parameters') return 'position_size';
  if (error === 'Position notional exceeds account size') return 'exposure';
  return 'stop_distance';
}

export function buildPositionBudgetVerdict(output: PositionBudgetOutput): PositionBudgetVerdict {
  if (hasIncompleteError(output.errors)) {
    return {
      status: 'INCOMPLETE',
      grade: '—',
      title: 'Incomplete Setup',
      summary: 'Complete required fields to calculate position size.',
      checks: [
        {
          key: 'required_fields',
          label: 'Required fields complete',
          status: 'PENDING',
        },
      ],
    };
  }

  if (!output.ok) {
    return {
      status: 'INVALID',
      grade: '—',
      title: 'Invalid Setup',
      summary: 'Stop price or risk model needs correction.',
      checks: output.errors.slice(0, 3).map((error) => ({
        key: checkKeyForError(error),
        label: error,
        status: 'FAIL',
      })),
    };
  }

  const riskWarning = output.warnings.length > 0;
  const exposureWarning = output.accountExposurePercent > EXPOSURE_WARN_PERCENT;
  const exposureInvalid = output.accountExposurePercent > EXPOSURE_INVALID_PERCENT;
  const rMultipleWarning = output.rMultiple !== null && output.rMultiple < R_MULTIPLE_WARN;

  const checks: PositionBudgetVerdictCheck[] = [
    {
      key: 'risk_cap',
      label: 'Risk within cap',
      status: riskWarning ? 'WARN' : 'PASS',
    },
    {
      key: 'exposure',
      label: 'Exposure acceptable',
      status: exposureInvalid ? 'FAIL' : exposureWarning ? 'WARN' : 'PASS',
    },
  ];

  if (output.rMultiple !== null) {
    checks.push({
      key: 'r_multiple',
      label: 'R >= 2',
      status: rMultipleWarning ? 'WARN' : 'PASS',
    });
  }

  const status: PositionBudgetVerdictStatus =
    exposureInvalid ? 'INVALID' : riskWarning || exposureWarning || rMultipleWarning ? 'WARNING' : 'VALID';

  if (status === 'INVALID') {
    return {
      status,
      grade: 'C',
      title: 'Invalid Setup',
      summary: 'Exposure exceeds the account budget.',
      checks: checks.slice(0, 3),
    };
  }

  if (status === 'WARNING') {
    return {
      status,
      grade: 'B+',
      title: 'Check Setup',
      summary: 'Risk is acceptable, but one discipline check needs attention.',
      checks: checks.slice(0, 3),
    };
  }

  return {
    status: 'VALID',
    grade: 'A',
    title: 'Valid Setup',
    summary: 'Risk is within your plan.',
    checks: checks.slice(0, 3),
  };
}
