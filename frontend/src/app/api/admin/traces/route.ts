import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { Client } from '@libsql/client';
import Database from 'better-sqlite3';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const symbol = searchParams.get('symbol');

        const client = getDbClient();
        const strategy = process.env.DB_STRATEGY || 'local';

        let traces = [];
        const sql = `
            SELECT 
                trace_id, symbol, date, model_id, strategy_name, 
                status, total_duration_ms, created_at, error_reason
            FROM chain_execution_traces 
            ${symbol ? `WHERE symbol LIKE '%${symbol}%'` : ''}
            ORDER BY created_at DESC 
            LIMIT ${limit}
        `;

        if (strategy === 'cloud') {
            const turso = client as Client;
            const res = await turso.execute(sql);
            traces = res.rows;
        } else {
            const db = client as Database.Database;
            traces = db.prepare(sql).all();
            db.close();
        }

        return NextResponse.json(traces);
    } catch (error) {
        console.error('Failed to fetch traces:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
