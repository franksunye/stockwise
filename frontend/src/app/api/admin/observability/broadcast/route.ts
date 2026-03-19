import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-auth';
import type { Client } from '@libsql/client';
import Database from 'better-sqlite3';

export const dynamic = 'force-dynamic';

type Row = Record<string, string | number | null>;

const CREATE_HEALTH_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ops_broadcast_health (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL,
  market TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  item_count INTEGER DEFAULT 0,
  ok INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  checked_at TEXT NOT NULL
)`;

const CREATE_RECON_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ops_pool_reconcile_runs (
  run_id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  mismatch_before INTEGER DEFAULT 0,
  mismatch_after INTEGER DEFAULT 0,
  non_positive_before INTEGER DEFAULT 0,
  non_positive_after INTEGER DEFAULT 0,
  updated_rows INTEGER DEFAULT 0,
  deleted_rows INTEGER DEFAULT 0,
  details_json TEXT,
  error_message TEXT
)`;

const CREATE_FALLBACK_EVENTS_TABLE_SQL = `
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

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function queryCloud(client: Client, sql: string, args: Array<string | number> = []): Promise<Row[]> {
  const rs = await client.execute({ sql, args });
  return rs.rows as Row[];
}

function queryLocal(db: Database.Database, sql: string, args: Array<string | number> = []): Row[] {
  return db.prepare(sql).all(...args) as Row[];
}

export async function GET(request: Request) {
  const unauthorized = requireAdminAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const client = getDbClient();
    const isCloud = 'execute' in client;

    if (isCloud) {
      const turso = client as Client;
      await turso.execute(CREATE_HEALTH_TABLE_SQL);
      await turso.execute(CREATE_RECON_TABLE_SQL);
      await turso.execute(CREATE_FALLBACK_EVENTS_TABLE_SQL);
    } else {
      const db = client as Database.Database;
      db.exec(CREATE_HEALTH_TABLE_SQL);
      db.exec(CREATE_RECON_TABLE_SQL);
      db.exec(CREATE_FALLBACK_EVENTS_TABLE_SQL);
    }

    const summarySql = `
      SELECT
        COUNT(1) AS total_checks_24h,
        SUM(CASE WHEN ok = 1 THEN 1 ELSE 0 END) AS ok_checks_24h,
        AVG(latency_ms) AS avg_latency_ms_24h,
        MAX(latency_ms) AS max_latency_ms_24h,
        SUM(CASE WHEN item_count = 0 THEN 1 ELSE 0 END) AS empty_result_checks_24h
      FROM ops_broadcast_health
      WHERE datetime(checked_at) >= datetime('now', '-24 hours')
    `;
    const byMarketSql = `
      SELECT market,
             COUNT(1) AS checks,
             SUM(CASE WHEN ok = 1 THEN 1 ELSE 0 END) AS ok_checks,
             AVG(latency_ms) AS avg_latency_ms,
             MAX(latency_ms) AS max_latency_ms,
             MAX(checked_at) AS last_checked_at
      FROM ops_broadcast_health
      WHERE datetime(checked_at) >= datetime('now', '-24 hours')
      GROUP BY market
      ORDER BY market ASC
    `;
    const latestFailuresSql = `
      SELECT market, status_code, latency_ms, item_count, error_message, checked_at
      FROM ops_broadcast_health
      WHERE ok = 0
      ORDER BY datetime(checked_at) DESC
      LIMIT 20
    `;
    const reconcileRunsSql = `
      SELECT run_id, started_at, finished_at, status,
             mismatch_before, mismatch_after, non_positive_before, non_positive_after,
             updated_rows, deleted_rows, error_message
      FROM ops_pool_reconcile_runs
      ORDER BY datetime(started_at) DESC
      LIMIT 20
    `;
    const fallbackSummarySql = `
      SELECT
        COUNT(1) AS total_events_24h,
        SUM(CASE WHEN event_type = 'legacy_fallback_used' THEN 1 ELSE 0 END) AS legacy_fallback_24h,
        SUM(CASE WHEN event_type = 'broadcast_circuit_open' THEN 1 ELSE 0 END) AS circuit_open_24h,
        SUM(CASE WHEN event_type = 'broadcast_recovered' THEN 1 ELSE 0 END) AS recovered_24h,
        MAX(created_at) AS last_event_at
      FROM ops_broadcast_fallback_events
      WHERE datetime(created_at) >= datetime('now', '-24 hours')
    `;
    const fallbackRecentSql = `
      SELECT id, event_type, market, reason, failure_streak, circuit_open_until, client_time, created_at
      FROM ops_broadcast_fallback_events
      ORDER BY datetime(created_at) DESC
      LIMIT 30
    `;

    let summaryRows: Row[] = [];
    let byMarketRows: Row[] = [];
    let latestFailureRows: Row[] = [];
    let reconcileRows: Row[] = [];
    let fallbackSummaryRows: Row[] = [];
    let fallbackRecentRows: Row[] = [];

    if (isCloud) {
      const turso = client as Client;
      [summaryRows, byMarketRows, latestFailureRows, reconcileRows, fallbackSummaryRows, fallbackRecentRows] = await Promise.all([
        queryCloud(turso, summarySql),
        queryCloud(turso, byMarketSql),
        queryCloud(turso, latestFailuresSql),
        queryCloud(turso, reconcileRunsSql),
        queryCloud(turso, fallbackSummarySql),
        queryCloud(turso, fallbackRecentSql),
      ]);
    } else {
      const db = client as Database.Database;
      summaryRows = queryLocal(db, summarySql);
      byMarketRows = queryLocal(db, byMarketSql);
      latestFailureRows = queryLocal(db, latestFailuresSql);
      reconcileRows = queryLocal(db, reconcileRunsSql);
      fallbackSummaryRows = queryLocal(db, fallbackSummarySql);
      fallbackRecentRows = queryLocal(db, fallbackRecentSql);
      db.close();
    }

    const summary = summaryRows[0] || {};
    const fallbackSummary = fallbackSummaryRows[0] || {};
    const total = num(summary.total_checks_24h);
    const ok = num(summary.ok_checks_24h);

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      window: '24h',
      broadcast: {
        total_checks_24h: total,
        ok_checks_24h: ok,
        ok_rate_24h: total > 0 ? Number((ok / total).toFixed(4)) : 0,
        avg_latency_ms_24h: Number(num(summary.avg_latency_ms_24h).toFixed(2)),
        max_latency_ms_24h: num(summary.max_latency_ms_24h),
        empty_result_checks_24h: num(summary.empty_result_checks_24h),
        by_market: byMarketRows.map((r) => ({
          market: String(r.market || ''),
          checks: num(r.checks),
          ok_checks: num(r.ok_checks),
          ok_rate: num(r.checks) > 0 ? Number((num(r.ok_checks) / num(r.checks)).toFixed(4)) : 0,
          avg_latency_ms: Number(num(r.avg_latency_ms).toFixed(2)),
          max_latency_ms: num(r.max_latency_ms),
          last_checked_at: r.last_checked_at ? String(r.last_checked_at) : null,
        })),
        latest_failures: latestFailureRows.map((r) => ({
          market: String(r.market || ''),
          status_code: num(r.status_code),
          latency_ms: num(r.latency_ms),
          item_count: num(r.item_count),
          error_message: r.error_message ? String(r.error_message) : null,
          checked_at: r.checked_at ? String(r.checked_at) : null,
        })),
      },
      pool_reconcile: {
        latest_runs: reconcileRows.map((r) => ({
          run_id: String(r.run_id || ''),
          started_at: r.started_at ? String(r.started_at) : null,
          finished_at: r.finished_at ? String(r.finished_at) : null,
          status: String(r.status || ''),
          mismatch_before: num(r.mismatch_before),
          mismatch_after: num(r.mismatch_after),
          non_positive_before: num(r.non_positive_before),
          non_positive_after: num(r.non_positive_after),
          updated_rows: num(r.updated_rows),
          deleted_rows: num(r.deleted_rows),
          error_message: r.error_message ? String(r.error_message) : null,
        })),
      },
      fallback_events: {
        total_events_24h: num(fallbackSummary.total_events_24h),
        legacy_fallback_24h: num(fallbackSummary.legacy_fallback_24h),
        circuit_open_24h: num(fallbackSummary.circuit_open_24h),
        recovered_24h: num(fallbackSummary.recovered_24h),
        last_event_at: fallbackSummary.last_event_at ? String(fallbackSummary.last_event_at) : null,
        recent: fallbackRecentRows.map((r) => ({
          id: num(r.id),
          event_type: String(r.event_type || ''),
          market: String(r.market || ''),
          reason: r.reason ? String(r.reason) : null,
          failure_streak: num(r.failure_streak),
          circuit_open_until: r.circuit_open_until ? String(r.circuit_open_until) : null,
          client_time: r.client_time ? String(r.client_time) : null,
          created_at: r.created_at ? String(r.created_at) : null,
        })),
      },
    });
  } catch (error) {
    console.error('Failed to fetch broadcast observability:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
