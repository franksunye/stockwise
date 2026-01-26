import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getDbClient } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const limit = parseInt(searchParams.get('limit') || '30');

    const targetDate = searchParams.get('targetDate');

    if (!symbol) {
        return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
    }

    try {
        const client = getDbClient();
        let rows;

        const mode = searchParams.get('mode') || 'simple';
        const isPrimaryOnly = mode === 'simple';

        // 构建基础查询条件
        let whereClause = 'p.symbol = ?';
        const queryArgs: (string | number)[] = [symbol];

        if (isPrimaryOnly) {
            whereClause += ' AND p.is_primary = 1';
        }

        if (targetDate) {
            whereClause += ' AND p.target_date = ?';
            queryArgs.push(targetDate);
        }

        queryArgs.push(limit);

        const sql = `
            SELECT p.symbol, p.date, p.target_date, p.signal, p.confidence, 
                    p.support_price, p.ai_reasoning, p.validation_status, p.actual_change,
                    p.is_primary,
                    p.model_id as model, 
                    m.display_name,
                    d.close as close_price,
                    d.rsi, d.kdj_k, d.kdj_d, d.kdj_j, 
                    d.macd, d.macd_signal, d.macd_hist, 
                    d.boll_upper, d.boll_mid, d.boll_lower
            FROM ai_predictions_v2 p
            LEFT JOIN prediction_models m ON p.model_id = m.model_id
            LEFT JOIN daily_prices d ON p.symbol = d.symbol AND p.target_date = d.date
            WHERE ${whereClause}
            ORDER BY p.date DESC 
            LIMIT ?
        `;

        if ('execute' in client) {
            const rs = await client.execute({ sql, args: queryArgs });
            rows = rs.rows;
        } else {
            // Local SQLite
            rows = client.prepare(sql).all(...queryArgs);
            client.close();
        }

        return NextResponse.json({ predictions: rows });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}
