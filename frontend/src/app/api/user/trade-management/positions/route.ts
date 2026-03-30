import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { requireUserSession } from '@/lib/user-session';
import { createUserTradePosition, hasActiveUserTradePosition } from '@/lib/user-trade-management';

function closeDb(db: unknown): void {
  if (db && typeof db === 'object' && 'close' in db && typeof (db as { close?: () => void }).close === 'function') {
    (db as { close: () => void }).close();
  }
}

function inferMarket(symbol: string): string {
  return symbol.length === 5 ? 'HK' : 'CN';
}

export async function POST(request: Request) {
  const auth = requireUserSession(request);
  if ('response' in auth) return auth.response;

  const userId = auth.userId;
  const body = await request.json().catch(() => ({}));
  const symbol = String(body.symbol || '').trim().toUpperCase();
  const entryDate = String(body.entry_date || '').trim();
  const entryPrice = Number(body.entry_price);
  const positionSize = Number(body.position_size);
  const note = body.note == null || body.note === '' ? null : String(body.note);
  const market = String(body.market || inferMarket(symbol)).trim().toUpperCase();

  if (!symbol || !entryDate || !Number.isFinite(entryPrice) || !Number.isFinite(positionSize) || positionSize <= 0) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const client = getDbClient();
  const strategy = (process.env.DB_STRATEGY || process.env.DB_SOURCE || 'local') as 'cloud' | 'local';

  try {
    const exists = await hasActiveUserTradePosition(client, strategy, userId, symbol);
    if (exists) {
      return NextResponse.json({ error: 'Active position already exists' }, { status: 409 });
    }

    const positionId = `pos_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    await createUserTradePosition(client, strategy, {
      positionId,
      userId,
      symbol,
      market,
      entryDate,
      entryPrice,
      positionSize,
      note,
    });

    return NextResponse.json({ success: true, position_id: positionId });
  } catch (error) {
    console.error('POST /api/user/trade-management/positions error:', error);
    return NextResponse.json({ error: 'Failed to create trade position' }, { status: 500 });
  } finally {
    closeDb(client);
  }
}
