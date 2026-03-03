import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { getUserTier } from '@/lib/user-server';
import { getModelSqlFilter } from '@/lib/membership-config';
import { requireUserSession } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const limit = parseInt(searchParams.get('limit') || '30');
    const targetDate = searchParams.get('targetDate');

    if (!symbol) {
        return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
    }

    try {
        const auth = requireUserSession(request);
        if ('response' in auth) return auth.response;
        const userId = auth.userId;
        const userTier = await getUserTier(userId);
        const tierFilter = getModelSqlFilter(userTier);

        const mode = searchParams.get('mode') || 'simple';
        const isPrimaryOnly = mode === 'simple';

        // 构建 SQL
        let whereClause = 'p.symbol = ?';
        const queryArgs: (string | number)[] = [symbol];

        if (isPrimaryOnly) {
            whereClause += ` AND ${tierFilter}`;
        }

        if (targetDate) {
            whereClause += ' AND p.target_date = ?';
            queryArgs.push(targetDate);
        }
        queryArgs.push(limit);

        const sql = `
            SELECT p.symbol, p.date, p.target_date, p.signal, p.confidence, 
                    p.support_price, p.ai_reasoning, p.validation_status, p.actual_change,
                    p.is_primary, p.model_id as model, m.display_name,
                    d.close as close_price,
                    d.rsi, d.kdj_k, d.kdj_d, d.kdj_j, 
                    d.macd, d.macd_signal, d.macd_hist, 
                    d.boll_upper, d.boll_mid, d.boll_lower
            FROM ai_predictions_v2 p
            LEFT JOIN prediction_models m ON p.model_id = m.model_id
            LEFT JOIN daily_prices d ON p.symbol = d.symbol AND p.target_date = d.date
            WHERE ${whereClause}
            ORDER BY p.date DESC, m.priority DESC
            LIMIT ?
        `;

        const client = getDbClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = client as any;
        let rows;
        try {
            if (client.$type === 'cloud') {
                const rs = await db.execute({ sql, args: queryArgs });
                rows = rs.rows;
            } else {
                rows = db.prepare(sql).all(...queryArgs);
            }
        } finally {
            if (client && typeof (client as { close?: () => void }).close === 'function') {
                (client as { close: () => void }).close();
            }
        }

        return NextResponse.json({ predictions: rows, tier: userTier });
    } catch (error) {
        console.error('Predictions API Error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}
