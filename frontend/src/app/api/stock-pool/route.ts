import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import Database from 'better-sqlite3';
import path from 'path';

function getDbClient() {
    const url = process.env.TURSO_DB_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (url && authToken) {
        // 远程模式 (Vercel + Turso)
        return createClient({ url, authToken });
    } else {
        // 本地模式 (Local SQLite)
        const dbPath = path.join(process.cwd(), '..', 'data', 'stockwise.db');
        return new Database(dbPath);
    }
}

export async function GET() {
    try {
        const client = getDbClient();
        let stocks;

        if ('execute' in client) {
            const rs = await client.execute('SELECT symbol, name FROM stock_pool ORDER BY added_at');
            stocks = rs.rows;
        } else {
            stocks = client.prepare('SELECT symbol, name FROM stock_pool ORDER BY added_at').all();
            client.close();
        }

        return NextResponse.json({ stocks });
    } catch (error) {
        console.error('Fetch stock pool error:', error);
        return NextResponse.json({ stocks: [] }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { symbol, name } = await request.json();
        const client = getDbClient();
        const displayName = name || `股票 ${symbol}`;

        if ('execute' in client) {
            await client.execute({
                sql: 'INSERT OR REPLACE INTO stock_pool (symbol, name) VALUES (?, ?)',
                args: [symbol, displayName]
            });
        } else {
            client.prepare('INSERT OR REPLACE INTO stock_pool (symbol, name) VALUES (?, ?)').run(symbol, displayName);
            client.close();
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Add stock error:', error);
        return NextResponse.json({ error: 'Failed to add' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    try {
        if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });

        const client = getDbClient();

        if ('execute' in client) {
            await client.execute({
                sql: 'DELETE FROM stock_pool WHERE symbol = ?',
                args: [symbol]
            });
        } else {
            client.prepare('DELETE FROM stock_pool WHERE symbol = ?').run(symbol);
            client.close();
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete stock error:', error);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
