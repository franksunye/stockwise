import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { getUserTier } from '@/lib/user-server';
import { getModelSqlFilter } from '@/lib/membership-config';
import { requireUserSession } from '@/lib/user-session';
import {
    ensureInvestmentModeSchema,
    getUserMode,
    type UserTier,
} from '@/lib/investment-mode';
import {
    EFFECTIVE_DECISION_SEMANTIC_SQL,
    EFFECTIVE_LAYER1_STATUS_SQL,
    EFFECTIVE_SIGNAL_SQL,
    EFFECTIVE_VALIDATION_STATUS_SQL,
} from '@/lib/prediction-display';

export const revalidate = 300; // 5 minutes cache

function closeDb(db: unknown): void {
    if (db && typeof db === 'object' && 'close' in db && typeof (db as { close?: () => void }).close === 'function') {
        (db as { close: () => void }).close();
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    let symbol = searchParams.get('symbol');
    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!symbol) {
        return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
    }

    // Sanitize symbol: remove suffix like .SZ or .SS
    if (symbol.includes('.')) {
        symbol = symbol.split('.')[0];
    }

    try {
        const auth = requireUserSession(request);
        if ('response' in auth) return auth.response;
        const userId = auth.userId;
        const userTier = await getUserTier(userId);
        const tierFilter = getModelSqlFilter(userTier);

        const client = getDbClient();
        let rows: Record<string, unknown>[];
        try {
            await ensureInvestmentModeSchema(client);
            const currentMode = await getUserMode(client, userId, userTier as UserTier);

            const sql = `
                SELECT p.symbol, p.date, p.target_date, ${EFFECTIVE_SIGNAL_SQL} AS signal, p.confidence,
                       p.support_price, p.ai_reasoning, ${EFFECTIVE_VALIDATION_STATUS_SQL} AS validation_status, p.actual_change,
                       ${EFFECTIVE_LAYER1_STATUS_SQL} AS layer1_status,
                       p.max_perf_in_window, p.validation_data,
                       p.is_primary, p.model_id as model, m.display_name,
                       ${EFFECTIVE_DECISION_SEMANTIC_SQL} AS decision_semantic,
                       ? AS mode_id,
                       d.close as close_price,
                       d.rsi, d.kdj_k, d.kdj_d, d.kdj_j,
                       d.macd, d.macd_signal, d.macd_hist,
                       d.boll_upper, d.boll_mid, d.boll_lower
                FROM ai_predictions_v2 p
                LEFT JOIN prediction_models m ON p.model_id = m.model_id
                LEFT JOIN mode_decision_log dlog
                    ON dlog.mode_id = ?
                   AND dlog.symbol = p.symbol
                   AND dlog.decision_date = p.date
                LEFT JOIN daily_prices d ON p.symbol = d.symbol AND p.target_date = d.date
                WHERE p.symbol = ? AND (${tierFilter})
                ORDER BY p.date DESC, m.priority DESC
                LIMIT ? OFFSET ?
            `;

            if ('execute' in client) {
                const rs = await client.execute({ sql, args: [currentMode.mode_id, currentMode.mode_id, symbol, limit, offset] });
                rows = rs.rows as Record<string, unknown>[];
            } else {
                rows = client.prepare(sql).all(currentMode.mode_id, currentMode.mode_id, symbol, limit, offset) as Record<string, unknown>[];
            }
        } finally {
            closeDb(client);
        }

        return NextResponse.json({ predictions: rows, tier: userTier });
    } catch (error) {
        console.error('History API Error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}
