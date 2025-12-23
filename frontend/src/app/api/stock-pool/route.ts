import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

function getDb(readonly = true) {
    const dbPath = path.join(process.cwd(), '..', 'data', 'stockwise.db');
    return new Database(dbPath, { readonly });
}

export async function GET() {
    try {
        const db = getDb();
        const stocks = db.prepare('SELECT symbol, name FROM stock_pool ORDER BY added_at').all();
        db.close();

        return NextResponse.json({ stocks });
    } catch (error) {
        console.error('Fetch stock pool error:', error);
        return NextResponse.json({ stocks: [] }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { symbol, name } = await request.json();
        const db = getDb(false);

        db.prepare('INSERT OR REPLACE INTO stock_pool (symbol, name) VALUES (?, ?)').run(
            symbol,
            name || `股票 ${symbol}`
        );
        db.close();

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

        const db = getDb(false);
        db.prepare('DELETE FROM stock_pool WHERE symbol = ?').run(symbol);
        db.close();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete stock error:', error);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
