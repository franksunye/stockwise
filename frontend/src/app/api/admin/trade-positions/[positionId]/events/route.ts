import { NextResponse } from 'next/server';
import { Client } from '@libsql/client';
import Database from 'better-sqlite3';
import { requireAdminAuth } from '@/lib/admin-auth';
import { getDbClient } from '@/lib/db';

interface TradePositionEventRow {
  event_id: string;
  position_id: string;
  user_id: string;
  symbol: string;
  market: string | null;
  event_date: string;
  event_type: string;
  quantity: number;
  price: number | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
}

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

function buildListSql(): string {
  return `
    SELECT event_id, position_id, user_id, symbol, market, event_date, event_type, quantity, price, note, created_at, updated_at
    FROM user_trade_position_events
    WHERE position_id = ?
    ORDER BY event_date DESC, updated_at DESC, event_id DESC
  `;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ positionId: string }> }
) {
  const unauthorized = requireAdminAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const { positionId } = await params;
    const client = getDbClient();
    const strategy = process.env.DB_STRATEGY || process.env.DB_SOURCE || 'local';

    if (strategy === 'cloud') {
      const turso = client as Client;
      const result = await turso.execute({ sql: buildListSql(), args: [positionId] });
      return NextResponse.json({ events: result.rows as unknown as TradePositionEventRow[] });
    }

    const db = client as Database.Database;
    const events = db.prepare(buildListSql()).all(positionId) as TradePositionEventRow[];
    db.close();
    return NextResponse.json({ events });
  } catch (error) {
    console.error('Failed to fetch trade position events:', error);
    return NextResponse.json({ error: 'Failed to fetch trade position events' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ positionId: string }> }
) {
  const unauthorized = requireAdminAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const { positionId } = await params;
    const body = await request.json();
    const userId = String(body.user_id || '').trim();
    const symbol = String(body.symbol || '').trim().toUpperCase();
    const market = body.market == null ? null : String(body.market).trim().toUpperCase();
    const eventDate = String(body.event_date || '').trim();
    const eventType = normalizeEventType(body.event_type);
    const quantity = toNumber(body.quantity);
    const price = body.price == null || body.price === '' ? null : toNumber(body.price);
    const note = body.note == null || body.note === '' ? null : String(body.note);

    if (!positionId || !userId || !symbol || !eventDate || !eventType || !Number.isFinite(quantity) || (price !== null && !Number.isFinite(price))) {
      return NextResponse.json({ error: 'Missing required event fields' }, { status: 400 });
    }

    const eventId = String(body.event_id || `evt_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`);
    const client = getDbClient();
    const strategy = process.env.DB_STRATEGY || process.env.DB_SOURCE || 'local';
    const sql = `
      INSERT INTO user_trade_position_events (
        event_id, position_id, user_id, symbol, market, event_date, event_type, quantity, price, note, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'), datetime('now', '+8 hours'))
    `;

    if (strategy === 'cloud') {
      const turso = client as Client;
      await turso.execute({ sql, args: [eventId, positionId, userId, symbol, market, eventDate, eventType, quantity, price, note] });
    } else {
      const db = client as Database.Database;
      db.prepare(sql).run(eventId, positionId, userId, symbol, market, eventDate, eventType, quantity, price, note);
      db.close();
    }

    return NextResponse.json({ success: true, event_id: eventId });
  } catch (error) {
    console.error('Failed to create trade position event:', error);
    return NextResponse.json({ error: 'Failed to create trade position event' }, { status: 500 });
  }
}
