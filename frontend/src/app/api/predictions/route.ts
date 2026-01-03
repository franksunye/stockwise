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
                sql: `
                    SELECT p.*, 
                           d.close as close_price,
                           d.rsi, d.kdj_k, d.kdj_d, d.kdj_j, 
                           d.macd, d.macd_signal, d.macd_hist, 
                           d.boll_upper, d.boll_mid, d.boll_lower
                    FROM ai_predictions p
                    LEFT JOIN daily_prices d ON p.symbol = d.symbol AND p.target_date = d.date
                    WHERE p.symbol = ? 
                    ORDER BY p.date DESC 
                    LIMIT ?
                `,
                args: [symbol, limit]
            });
            rows = rs.rows;
        } else {
            rows = client.prepare(`
                SELECT p.*, 
                       d.close as close_price,
                       d.rsi, d.kdj_k, d.kdj_d, d.kdj_j, 
                       d.macd, d.macd_signal, d.macd_hist, 
                       d.boll_upper, d.boll_mid, d.boll_lower
                FROM ai_predictions p
                LEFT JOIN daily_prices d ON p.symbol = d.symbol AND p.target_date = d.date
                WHERE p.symbol = ? 
                ORDER BY p.date DESC 
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
