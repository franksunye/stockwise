import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

function getDb() {
    const dbPath = path.join(process.cwd(), '..', 'data', 'stockwise.db');
    return new Database(dbPath, { readonly: true });
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const history = searchParams.get('history');

    try {
        const db = getDb();

        if (!symbol) {
            const rows = db.prepare('SELECT DISTINCT symbol FROM daily_prices').all() as { symbol: string }[];
            db.close();
            return NextResponse.json({ symbols: rows.map(r => r.symbol) });
        }

        if (history) {
            const limit = parseInt(history) || 30;
            const rows = db.prepare('SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT ?').all(symbol, limit);
            db.close();
            return NextResponse.json({ prices: rows });
        }

        const row = db.prepare('SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1').get(symbol);
        const prediction = db.prepare('SELECT * FROM ai_predictions WHERE symbol = ? ORDER BY date DESC LIMIT 1').get(symbol);
        db.close();

        if (!row) {
            return NextResponse.json({ error: '未找到该股票数据' }, { status: 404 });
        }

        return NextResponse.json({
            price: row,
            prediction: prediction || null
        });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: '数据库错误: ' + String(error) }, { status: 500 });
    }
}
