import { NextResponse } from 'next/server';
import { Client } from '@libsql/client';
import Database from 'better-sqlite3';
import { requireAdminAuth } from '@/lib/admin-auth';
import { recomputeRemainingSize } from '@/lib/admin-trade-positions';
import { getDbClient } from '@/lib/db';

function toNumber(input: unknown): number {
  const value = Number(input);
  if (!Number.isFinite(value)) return NaN;
  return value;
}

function normalizeEventType(input: unknown): string {
  const value = String(input || '').trim().toUpperCase();
  if (value === 'BUY' || value === 'SELL') return value;
  return '';
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ positionId: string; eventId: string }> }
) {
  const unauthorized = requireAdminAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const { positionId, eventId } = await params;
    const body = await request.json();
    const userId = String(body.user_id || '').trim();
    const symbol = String(body.symbol || '').trim().toUpperCase();
    const market = body.market == null ? null : String(body.market).trim().toUpperCase();
    const eventDate = String(body.event_date || '').trim();
    const eventType = normalizeEventType(body.event_type);
    const quantity = toNumber(body.quantity);
    const price = body.price == null || body.price === '' ? null : toNumber(body.price);
    const note = body.note == null || body.note === '' ? null : String(body.note);

    if (!positionId || !eventId || !userId || !symbol || !eventDate || !eventType || !Number.isFinite(quantity) || (price !== null && !Number.isFinite(price))) {
      return NextResponse.json({ error: 'Missing required event fields' }, { status: 400 });
    }

    const client = getDbClient();
    const strategy = (process.env.DB_STRATEGY || process.env.DB_SOURCE || 'local') as 'cloud' | 'local';
    const sql = `
      UPDATE user_trade_position_events
      SET user_id = ?, symbol = ?, market = ?, event_date = ?, event_type = ?, quantity = ?, price = ?, note = ?, updated_at = datetime('now', '+8 hours')
      WHERE position_id = ? AND event_id = ?
    `;

    if (strategy === 'cloud') {
      const turso = client as Client;
      await turso.execute({ sql, args: [userId, symbol, market, eventDate, eventType, quantity, price, note, positionId, eventId] });
      await recomputeRemainingSize(turso, strategy, positionId);
    } else {
      const db = client as Database.Database;
      db.prepare(sql).run(userId, symbol, market, eventDate, eventType, quantity, price, note, positionId, eventId);
      await recomputeRemainingSize(db, strategy, positionId);
      db.close();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update trade position event:', error);
    return NextResponse.json({ error: 'Failed to update trade position event' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ positionId: string; eventId: string }> }
) {
  const unauthorized = requireAdminAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const { positionId, eventId } = await params;
    const client = getDbClient();
    const strategy = (process.env.DB_STRATEGY || process.env.DB_SOURCE || 'local') as 'cloud' | 'local';
    const sql = 'DELETE FROM user_trade_position_events WHERE position_id = ? AND event_id = ?';

    if (strategy === 'cloud') {
      const turso = client as Client;
      await turso.execute({ sql, args: [positionId, eventId] });
      await recomputeRemainingSize(turso, strategy, positionId);
    } else {
      const db = client as Database.Database;
      db.prepare(sql).run(positionId, eventId);
      await recomputeRemainingSize(db, strategy, positionId);
      db.close();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete trade position event:', error);
    return NextResponse.json({ error: 'Failed to delete trade position event' }, { status: 500 });
  }
}
