import { NextResponse } from 'next/server';

import { getDbClient } from '@/lib/db';
import { requireUserSession } from '@/lib/user-session';
import {
  ensurePositionBudgetSchema,
  getUserPositionBudgetPreferences,
  updateUserPositionBudgetPreferences,
} from '@/lib/user-position-budget';
import type { PositionBudgetRMode } from '@/lib/position-budget';

function closeDb(db: unknown): void {
  if (db && typeof db === 'object' && 'close' in db && typeof (db as { close?: () => void }).close === 'function') {
    (db as { close: () => void }).close();
  }
}

function isValidRMode(input: unknown): input is PositionBudgetRMode {
  const value = String(input || '').trim();
  return value === 'system_followed' || value === 'fixed_stop' || value === 'percent_stop';
}

export async function GET(request: Request) {
  const auth = requireUserSession(request);
  if ('response' in auth) return auth.response;

  const userId = auth.userId;
  const client = getDbClient();
  const strategy = client.$type;

  try {
    await ensurePositionBudgetSchema(client, strategy);
    const preferences = await getUserPositionBudgetPreferences(client, strategy, userId);
    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('GET /api/user/trade-management/preferences error:', error);
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
  } finally {
    closeDb(client);
  }
}

export async function PUT(request: Request) {
  const auth = requireUserSession(request);
  if ('response' in auth) return auth.response;

  const userId = auth.userId;
  const body = await request.json().catch(() => ({}));

  const accountSizeRaw = body.default_account_size;
  const riskRatio = Number(body.default_risk_ratio);
  const rMode = body.default_r_mode;
  const accountSize = accountSizeRaw == null || accountSizeRaw === '' ? null : Number(accountSizeRaw);

  if (!Number.isFinite(riskRatio) || riskRatio < 0.001 || riskRatio > 0.05) {
    return NextResponse.json({ error: 'Invalid default_risk_ratio' }, { status: 400 });
  }
  if (accountSize !== null && (!Number.isFinite(accountSize) || accountSize <= 0)) {
    return NextResponse.json({ error: 'Invalid default_account_size' }, { status: 400 });
  }
  if (!isValidRMode(rMode)) {
    return NextResponse.json({ error: 'Invalid default_r_mode' }, { status: 400 });
  }

  const client = getDbClient();
  const strategy = client.$type;

  try {
    await ensurePositionBudgetSchema(client, strategy);
    await updateUserPositionBudgetPreferences(client, strategy, userId, {
      default_account_size: accountSize,
      default_risk_ratio: riskRatio,
      default_r_mode: rMode,
    });
    const preferences = await getUserPositionBudgetPreferences(client, strategy, userId);
    return NextResponse.json({ success: true, preferences });
  } catch (error) {
    console.error('PUT /api/user/trade-management/preferences error:', error);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  } finally {
    closeDb(client);
  }
}
