import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import Database from 'better-sqlite3';
import path from 'path';

function getDbClient() {
    const url = process.env.TURSO_DB_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (url && authToken) {
        return createClient({ url, authToken });
    } else {
        const dbPath = path.join(process.cwd(), '..', 'data', 'stockwise.db');
        return new Database(dbPath, { readonly: true });
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const limit = parseInt(searchParams.get('limit') || '30');

    if (!symbol) {
        return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
    }

    try {
        const client = getDbClient();
        let rows;

        if ('execute' in client) {
            const rs = await client.execute({
                sql: 'SELECT * FROM ai_predictions WHERE symbol = ? ORDER BY date DESC LIMIT ?',
                args: [symbol, limit]
            });
            rows = rs.rows;
        } else {
            rows = client.prepare(`
                SELECT * FROM ai_predictions 
                WHERE symbol = ? 
                ORDER BY date DESC 
                LIMIT ?
            `).all(symbol, limit);
            client.close();
        }

        return NextResponse.json({ predictions: rows });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}
