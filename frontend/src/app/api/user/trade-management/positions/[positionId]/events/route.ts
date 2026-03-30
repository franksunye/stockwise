import { NextResponse } from 'next/server';

import { recomputeRemainingSize } from '@/lib/admin-trade-positions';
import { getDbClient } from '@/lib/db';
import {
  createUserTradePositionEvent,
  getUserTradePositionById,
} from '@/lib/user-trade-management';
import { requireUserSession } from '@/lib/user-session';

function closeDb(db: unknown): void {
  if (db && typeof db === 'object' && 'close' in db && typeof (db as { close?: () => void }).close === 'function') {
    (db as { close: () => void }).close();
  }
}

function normalizeEventType(input: unknown): 'BUY' | 'SELL' | '' {
  const value = String(input || '').trim().toUpperCase();
  if (value === 'BUY' || value === 'SELL') return value;
  return '';
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ positionId: string }> },
) {
  const auth = requireUserSession(request);
  if ('response' in auth) return auth.response;

  const userId = auth.userId;
  const { positionId } = await params;
  const body = await request.json().catch(() => ({}));
  const eventDate = String(body.event_date || '').trim();
  const eventType = normalizeEventType(body.event_type);
  const quantity = Number(body.quantity);
  const price = body.price == null || body.price === '' ? null : Number(body.price);
  const note = body.note == null || body.note === '' ? null : String(body.note);

  if (!positionId || !eventDate || !eventType || !Number.isFinite(quantity) || quantity <= 0 || (price !== null && (!Number.isFinite(price) || price <= 0))) {
    return NextResponse.json({ error: 'Missing required event fields' }, { status: 400 });
  }

  const client = getDbClient();
  const strategy = (process.env.DB_STRATEGY || process.env.DB_SOURCE || 'local') as 'cloud' | 'local';

  try {
    const position = await getUserTradePositionById(client, strategy, userId, positionId);
    if (!position) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 });
    }

    const eventId = `evt_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
    await createUserTradePositionEvent(client, strategy, {
      eventId,
      positionId,
      userId,
      symbol: position.symbol,
      market: position.market,
      eventDate,
      eventType,
      quantity,
      price,
      note,
    });
    await recomputeRemainingSize(client, strategy, positionId);

    return NextResponse.json({ success: true, event_id: eventId });
  } catch (error) {
    console.error('POST /api/user/trade-management/positions/[positionId]/events error:', error);
    return NextResponse.json({ error: 'Failed to create trade position event' }, { status: 500 });
  } finally {
    closeDb(client);
  }
}
