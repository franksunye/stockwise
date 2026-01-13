import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { Client } from '@libsql/client';
import Database from 'better-sqlite3';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '100');
        const symbol = searchParams.get('symbol');
        const model = searchParams.get('model');
        const status = searchParams.get('status');

        const client = getDbClient();
        const strategy = process.env.DB_STRATEGY || 'local';

        // Build WHERE clauses
        const conditions: string[] = [];
        if (symbol) conditions.push(`symbol LIKE '%${symbol}%'`);
        if (model) conditions.push(`model = '${model}'`);
        if (status) conditions.push(`status = '${status}'`);

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
        console.error('Failed to fetch LLM traces:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
