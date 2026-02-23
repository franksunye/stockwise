import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-auth';
import { Client } from '@libsql/client';
import Database from 'better-sqlite3';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const unauthorized = requireAdminAuth(request);
    if (unauthorized) return unauthorized;

    try {
        const { searchParams } = new URL(request.url);
        const parsedLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
        const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50;
        const symbol = searchParams.get('symbol');

        const client = getDbClient();
        const strategy = process.env.DB_STRATEGY || 'local';

        let traces = [];
        const whereClauses: string[] = [];
        const args: Array<string | number> = [];
        if (symbol) {
            whereClauses.push('symbol LIKE ?');
            args.push(`%${symbol}%`);
        }
        args.push(limit);

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const sql = `
            SELECT 
                trace_id, symbol, date, model_id, strategy_name, 
                status, total_duration_ms, created_at, error_reason
            FROM chain_execution_traces 
            ${whereSql}
            ORDER BY created_at DESC 
            LIMIT ?
        `;

        if (strategy === 'cloud') {
            const turso = client as Client;
            const res = await turso.execute({ sql, args });
            traces = res.rows;
        } else {
            const db = client as Database.Database;
            traces = db.prepare(sql).all(...args);
            db.close();
        }

        return NextResponse.json(traces);
    } catch (error) {
        console.error('Failed to fetch traces:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
