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
    const limit = parseInt(searchParams.get('limit') || '30');

    if (!symbol) {
        return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
    }

    try {
        const db = getDb();
        const rows = db.prepare(`
            SELECT * FROM ai_predictions 
            WHERE symbol = ? 
            ORDER BY date DESC 
            LIMIT ?
        `).all(symbol, limit);
        db.close();

        return NextResponse.json({ predictions: rows });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}
