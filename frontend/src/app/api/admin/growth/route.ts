import { NextResponse } from 'next/server';
import { Client } from '@libsql/client';
import Database from 'better-sqlite3';
import { requireAdminAuth } from '@/lib/admin-auth';
import { getDbClient } from '@/lib/db';

export const dynamic = 'force-dynamic';

type SnapshotRow = Record<string, string | number | null>;

function num(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePayload(value: unknown): Record<string, unknown> {
    if (typeof value !== 'string' || !value) return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    } catch {
        return {};
    }
}

async function tableExistsCloud(client: Client): Promise<boolean> {
    const result = await client.execute({
        sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'growth_daily_snapshots'",
        args: [],
    });
    return result.rows.length > 0;
}

function tableExistsLocal(db: Database.Database): boolean {
    const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'growth_daily_snapshots'")
        .get();
    return Boolean(row);
}

function shapeRows(rows: SnapshotRow[]) {
    const snapshots = rows.map((row) => ({
        snapshot_date: String(row.snapshot_date || ''),
        generated_at: row.generated_at ? String(row.generated_at) : null,
        status: String(row.status || 'unknown'),
        sessions_24h: num(row.sessions_24h),
        active_users_24h: num(row.active_users_24h),
        page_views_24h: num(row.page_views_24h),
        new_user_rows_24h: num(row.new_user_rows_24h),
        activated_users_24h: num(row.activated_users_24h),
        activation_rate_24h: num(row.activation_rate_24h),
        paid_rows_24h: num(row.paid_rows_24h),
        active_watchers_24h: num(row.active_watchers_24h),
        total_users: num(row.total_users),
        access_granted_users: num(row.access_granted_users),
        active_paid_users: num(row.active_paid_users),
        stripe_linked_users: num(row.stripe_linked_users),
        payload: parsePayload(row.payload_json),
        errors: parsePayload(row.errors_json),
    }));

    const latest = snapshots[0] ?? null;
    const trend = [...snapshots]
        .reverse()
        .map((row) => ({
            date: row.snapshot_date,
            sessions: row.sessions_24h,
            active_users: row.active_users_24h,
            new_user_rows: row.new_user_rows_24h,
            activated_users: row.activated_users_24h,
            activation_rate: row.activation_rate_24h,
            active_watchers: row.active_watchers_24h,
        }));

    return { latest, trend, snapshots };
}

export async function GET(request: Request) {
    const unauthorized = requireAdminAuth(request);
    if (unauthorized) return unauthorized;

    const url = new URL(request.url);
    const range = Math.min(Math.max(Number(url.searchParams.get('range') || 30), 7), 90);
    const client = getDbClient();
    const strategy = client.$type;

    try {
        const sql = `
            SELECT *
            FROM growth_daily_snapshots
            ORDER BY snapshot_date DESC
            LIMIT ?
        `;

        let rows: SnapshotRow[] = [];
        if (strategy === 'cloud') {
            const turso = client as Client;
            if (!(await tableExistsCloud(turso))) {
                return NextResponse.json({ generated_at: new Date().toISOString(), db_strategy: strategy, latest: null, trend: [], snapshots: [] });
            }
            const result = await turso.execute({ sql, args: [range] });
            rows = result.rows as SnapshotRow[];
        } else {
            const db = client as Database.Database;
            if (!tableExistsLocal(db)) {
                db.close();
                return NextResponse.json({ generated_at: new Date().toISOString(), db_strategy: strategy, latest: null, trend: [], snapshots: [] });
            }
            rows = db.prepare(sql).all(range) as SnapshotRow[];
            db.close();
        }

        return NextResponse.json({
            generated_at: new Date().toISOString(),
            db_strategy: strategy,
            ...shapeRows(rows),
        });
    } catch (error) {
        console.error('Failed to fetch growth snapshots:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
