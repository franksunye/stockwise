import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getDbClient } from '@/lib/db';

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
