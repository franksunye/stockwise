import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { requireUserSession } from '@/lib/user-session';
import { getUserTradeManagementBySymbol } from '@/lib/user-trade-management';

function closeDb(db: unknown): void {
  if (db && typeof db === 'object' && 'close' in db && typeof (db as { close?: () => void }).close === 'function') {
    (db as { close: () => void }).close();
  }
}

export async function GET(request: Request) {
  const auth = requireUserSession(request);
  if ('response' in auth) return auth.response;

  const userId = auth.userId;
  const { searchParams } = new URL(request.url);
  const symbol = String(searchParams.get('symbol') || '').trim().toUpperCase();

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
  }

  const client = getDbClient();
  const strategy = (process.env.DB_STRATEGY || process.env.DB_SOURCE || 'local') as 'cloud' | 'local';

  try {
    const payload = await getUserTradeManagementBySymbol(client, strategy, userId, symbol);
    return NextResponse.json(payload);
  } catch (error) {
    console.error('GET /api/user/trade-management/stock error:', error);
    return NextResponse.json({ error: 'Failed to fetch trade management surface' }, { status: 500 });
  } finally {
    closeDb(client);
  }
}
