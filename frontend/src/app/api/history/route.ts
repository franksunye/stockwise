import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { headers } from 'next/headers';
import { getUserTier } from '@/lib/user-server';
import { getModelSqlFilter } from '@/lib/membership-config';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!symbol) {
        return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
    }

    try {
        const headersList = await headers();
        const userId = headersList.get('x-user-id');
        const userTier = await getUserTier(userId);
        const tierFilter = getModelSqlFilter(userTier);

        const sql = `
            SELECT p.symbol, p.date, p.target_date, p.signal, p.confidence,
                   p.support_price, p.ai_reasoning, p.validation_status, p.actual_change,
                   p.max_perf_in_window, p.validation_data,
                   p.is_primary, p.model_id as model, m.display_name,
                   d.close as close_price,
                   d.rsi, d.kdj_k, d.kdj_d, d.kdj_j,
                   d.macd, d.macd_signal, d.macd_hist,
                   d.boll_upper, d.boll_mid, d.boll_lower
            FROM ai_predictions_v2 p
            LEFT JOIN prediction_models m ON p.model_id = m.model_id
            LEFT JOIN daily_prices d ON p.symbol = d.symbol AND p.target_date = d.date
            WHERE p.symbol = ? AND (${tierFilter})
            ORDER BY p.date DESC, m.priority DESC
            LIMIT ? OFFSET ?
        `;

        const client = getDbClient();
        let rows: Record<string, unknown>[];
        try {
            if ('execute' in client) {
                const rs = await client.execute({ sql, args: [symbol, limit, offset] });
                rows = rs.rows as Record<string, unknown>[];
            } else {
                rows = client.prepare(sql).all(symbol, limit, offset) as Record<string, unknown>[];
            }
        } finally {
            if (client && typeof client === 'object' && 'close' in client && typeof (client as { close?: () => void }).close === 'function') {
                (client as { close: () => void }).close();
            }
        }

        return NextResponse.json({ predictions: rows, tier: userTier });
    } catch (error) {
        console.error('History API Error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}
