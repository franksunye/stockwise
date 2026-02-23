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
        const parsedLimit = Number.parseInt(searchParams.get('limit') || '100', 10);
        const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 100;
        const symbol = searchParams.get('symbol');
        const model = searchParams.get('model');
        const status = searchParams.get('status');

        const client = getDbClient();
        const strategy = process.env.DB_STRATEGY || 'local';

        const conditions: string[] = [];
        const args: Array<string | number> = [];
        if (symbol) {
            conditions.push('symbol LIKE ?');
            args.push(`%${symbol}%`);
        }
        if (model) {
            conditions.push('model = ?');
            args.push(model);
        }
        if (status) {
            conditions.push('status = ?');
            args.push(status);
        }
        args.push(limit);

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        let traces = [];
        const sql = `
            SELECT 
                trace_id, symbol, model, status, 
                input_tokens, output_tokens, total_tokens,
                latency_ms, retry_count, created_at
            FROM llm_traces 
            ${whereClause}
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
        console.error('Failed to fetch LLM traces:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
