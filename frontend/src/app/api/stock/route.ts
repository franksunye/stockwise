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
    const history = searchParams.get('history');

    try {
        const client = getDbClient();

        if (!symbol) {
            let rowObjects;
            if ('execute' in client) {
                const rs = await client.execute('SELECT DISTINCT symbol FROM daily_prices');
                rowObjects = rs.rows;
            } else {
                rowObjects = client.prepare('SELECT DISTINCT symbol FROM daily_prices').all();
                client.close();
            }
            return NextResponse.json({ symbols: (rowObjects as { symbol: string }[]).map((r) => r.symbol) });
        }

        if (history) {
            const limit = parseInt(history) || 30;
            let rows;
            if ('execute' in client) {
                const rs = await client.execute({
                    sql: 'SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT ?',
                    args: [symbol, limit]
                });
                rows = rs.rows;
            } else {
                rows = client.prepare('SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT ?').all(symbol, limit);
                client.close();
            }
            return NextResponse.json({ prices: rows });
        }

        // 获取最新价格和 AI 预测
        let row, prediction;
        if ('execute' in client) {
            const rsPrice = await client.execute({
                sql: 'SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1',
                args: [symbol]
            });
            const rsPred = await client.execute({
                sql: 'SELECT * FROM ai_predictions WHERE symbol = ? ORDER BY date DESC LIMIT 1',
                args: [symbol]
            });
            row = rsPrice.rows[0];
            prediction = rsPred.rows[0];
        } else {
            row = client.prepare('SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1').get(symbol);
            prediction = client.prepare('SELECT * FROM ai_predictions WHERE symbol = ? ORDER BY date DESC LIMIT 1').get(symbol);
            client.close();
        }

        if (!row) {
            return NextResponse.json({ error: '未找到该股票数据' }, { status: 404 });
        }

        return NextResponse.json({
            price: row,
            prediction: prediction || null
        });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: '数据库错误' }, { status: 500 });
    }
}
