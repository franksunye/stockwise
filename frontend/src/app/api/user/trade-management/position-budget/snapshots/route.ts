import { NextResponse } from 'next/server';

import { getDbClient } from '@/lib/db';
import {
  computePositionBudget,
  isValidPositionBudgetSymbol,
  type PositionBudgetInput,
  type PositionBudgetRMode,
} from '@/lib/position-budget';
import { requireUserSession } from '@/lib/user-session';
import {
  createPositionBudgetSnapshot,
  ensurePositionBudgetSchema,
  listPositionBudgetSnapshots,
} from '@/lib/user-position-budget';

function closeDb(db: unknown): void {
  if (db && typeof db === 'object' && 'close' in db && typeof (db as { close?: () => void }).close === 'function') {
    (db as { close: () => void }).close();
  }
}

function isValidRMode(input: unknown): input is PositionBudgetRMode {
  const value = String(input || '').trim();
  return value === 'system_followed' || value === 'fixed_stop' || value === 'percent_stop';
}

function isCloseEnough(a: number, b: number, epsilon: number = 0.01): boolean {
  return Math.abs(a - b) <= epsilon;
}

export async function GET(request: Request) {
  const auth = requireUserSession(request);
  if ('response' in auth) return auth.response;

  const userId = auth.userId;
  const { searchParams } = new URL(request.url);
  const symbol = String(searchParams.get('symbol') || '').trim().toUpperCase() || undefined;
  const parsedLimit = Number(searchParams.get('limit'));
  const limit = Number.isFinite(parsedLimit) ? Math.min(100, Math.max(1, parsedLimit)) : 20;

  const client = getDbClient();
  const strategy = client.$type;

  try {
    await ensurePositionBudgetSchema(client, strategy);
    const snapshots = await listPositionBudgetSnapshots(client, strategy, userId, symbol, limit);
    return NextResponse.json({ snapshots });
  } catch (error) {
    console.error('GET /api/user/trade-management/position-budget/snapshots error:', error);
    return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
  } finally {
    closeDb(client);
  }
}

export async function POST(request: Request) {
  const auth = requireUserSession(request);
  if ('response' in auth) return auth.response;

  const userId = auth.userId;
  const body = await request.json().catch(() => ({}));
  const symbol = String(body.symbol || '').trim().toUpperCase();
  const rMode = body.r_mode;

  if (!symbol || !isValidPositionBudgetSymbol(symbol)) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
  }
  if (!isValidRMode(rMode)) {
    return NextResponse.json({ error: 'Invalid r_mode' }, { status: 400 });
  }

  const computeInput: PositionBudgetInput = {
    accountSize: Number(body.account_size),
    riskRatio: Number(body.risk_ratio),
    entryPrice: Number(body.entry_price),
    targetPrice: body.target_price == null || body.target_price === '' ? null : Number(body.target_price),
    rMode,
    systemStopLossPrice: body.stop_loss_price == null || body.stop_loss_price === '' ? null : Number(body.stop_loss_price),
    fixedStopLossPrice: body.stop_loss_price == null || body.stop_loss_price === '' ? null : Number(body.stop_loss_price),
    stopPercent: body.stop_percent == null || body.stop_percent === '' ? null : Number(body.stop_percent),
  };

  const computed = computePositionBudget(computeInput);
  if (!computed.ok) {
    return NextResponse.json({ error: 'Invalid budget parameters', details: computed.errors }, { status: 400 });
  }
  if (computed.resolvedStopLossPrice === null) {
    return NextResponse.json({ error: 'Unable to resolve stop loss price' }, { status: 400 });
  }

  const providedRiskAmount = Number(body.risk_amount);
  const providedPositionSize = Number(body.position_size);
  const providedExpectedLoss = Number(body.expected_loss);
  if (
    (Number.isFinite(providedRiskAmount) && !isCloseEnough(providedRiskAmount, computed.riskAmount)) ||
    (Number.isFinite(providedPositionSize) && providedPositionSize !== computed.positionSize) ||
    (Number.isFinite(providedExpectedLoss) && !isCloseEnough(providedExpectedLoss, computed.expectedLoss))
  ) {
    return NextResponse.json(
      { error: 'Client result mismatch with server recomputation' },
      { status: 400 },
    );
  }

  const snapshotId = `pbs_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  const client = getDbClient();
  const strategy = client.$type;

  try {
    await ensurePositionBudgetSchema(client, strategy);
    await createPositionBudgetSnapshot(client, strategy, {
      snapshot_id: snapshotId,
      user_id: userId,
      symbol,
      entry_price: Number(computeInput.entryPrice),
      stop_loss_price: computed.resolvedStopLossPrice,
      target_price: computeInput.targetPrice ?? null,
      account_size: Number(computeInput.accountSize),
      risk_ratio: Number(computeInput.riskRatio),
      risk_amount: computed.riskAmount,
      risk_per_share: computed.riskPerShare,
      position_size: computed.positionSize,
      expected_loss: computed.expectedLoss,
      r_mode: rMode,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      snapshot_id: snapshotId,
      computed,
    });
  } catch (error) {
    console.error('POST /api/user/trade-management/position-budget/snapshots error:', error);
    return NextResponse.json({ error: 'Failed to save snapshot' }, { status: 500 });
  } finally {
    closeDb(client);
  }
}
