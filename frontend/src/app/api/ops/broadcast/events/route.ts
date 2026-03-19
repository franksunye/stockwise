import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import type { Client } from '@libsql/client';
import Database from 'better-sqlite3';

export const dynamic = 'force-dynamic';

const CREATE_EVENTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ops_broadcast_fallback_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  market TEXT NOT NULL DEFAULT 'all',
  reason TEXT,
  failure_streak INTEGER DEFAULT 0,
  circuit_open_until TEXT,
  client_time TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
)`;

const CREATE_EVENTS_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_ops_broadcast_fallback_created
ON ops_broadcast_fallback_events(created_at DESC)`;

type EventPayload = {
  eventType?: string;
  market?: string;
  reason?: string;
  failureStreak?: number;
  circuitOpenUntil?: string | null;
  clientTime?: string | null;
};

function normalizeEventType(raw: unknown): string | null {
  const val = String(raw || '').trim();
  if (!val) return null;
  if (val === 'broadcast_circuit_open' || val === 'legacy_fallback_used' || val === 'broadcast_recovered') {
    return val;
  }
  return null;
}

function normalizeMarket(raw: unknown): string {
  const val = String(raw || 'all').toLowerCase();
  return val === 'hk' || val === 'cn' || val === 'all' ? val : 'all';
}

function normalizeReason(raw: unknown): string {
  return String(raw || '').slice(0, 300);
}

function normalizeFailureStreak(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(Math.trunc(n), 0), 100);
}

function normalizeIso(raw: unknown): string | null {
  const v = String(raw || '').trim();
  if (!v) return null;
  return v.slice(0, 40);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EventPayload;
    const eventType = normalizeEventType(body.eventType);
    if (!eventType) {
      return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 });
    }

    const market = normalizeMarket(body.market);
    const reason = normalizeReason(body.reason);
    const failureStreak = normalizeFailureStreak(body.failureStreak);
    const circuitOpenUntil = normalizeIso(body.circuitOpenUntil);
    const clientTime = normalizeIso(body.clientTime);
    const userAgent = request.headers.get('user-agent')?.slice(0, 500) || null;
    const createdAt = new Date().toISOString();

    const client = getDbClient();
    if ('execute' in client) {
      const turso = client as Client;
      await turso.execute(CREATE_EVENTS_TABLE_SQL);
      await turso.execute(CREATE_EVENTS_INDEX_SQL);
      await turso.execute({
        sql: `
          INSERT INTO ops_broadcast_fallback_events (
            event_type, market, reason, failure_streak, circuit_open_until, client_time, user_agent, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [eventType, market, reason, failureStreak, circuitOpenUntil, clientTime, userAgent, createdAt],
      });
    } else {
      const db = client as Database.Database;
      db.exec(CREATE_EVENTS_TABLE_SQL);
      db.exec(CREATE_EVENTS_INDEX_SQL);
      db.prepare(`
        INSERT INTO ops_broadcast_fallback_events (
          event_type, market, reason, failure_streak, circuit_open_until, client_time, user_agent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(eventType, market, reason, failureStreak, circuitOpenUntil, clientTime, userAgent, createdAt);
      db.close();
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[BroadcastEvent] failed to record event:', error);
    return NextResponse.json({ error: 'Failed to record event' }, { status: 500 });
  }
}
