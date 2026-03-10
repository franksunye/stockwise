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

export const dynamic = 'force-dynamic';

function closeDb(db: unknown): void {
    if (db && typeof db === 'object' && 'close' in db && typeof (db as { close?: () => void }).close === 'function') {
        (db as { close: () => void }).close();
    }
}

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
        const db = getDbClient();

        const mode = searchParams.get('mode') || 'simple';
        const isPrimaryOnly = mode === 'simple';

        try {
            await ensureInvestmentModeSchema(db);
            const currentMode = await getUserMode(db, userId, userTier as UserTier);

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
                SELECT
                    p.symbol,
                    p.date,
                    p.target_date,
                    CASE
                        WHEN dlog.decision_semantic = '建议进场' OR dlog.decision_semantic = '进场' THEN 'Long'
                        WHEN dlog.decision_semantic = '建议防守' OR dlog.decision_semantic = '防守' THEN 'Short'
                        WHEN dlog.decision_semantic IN ('建议观察', '观察', '暂无信号', '建议空仓', '空仓') THEN 'Side'
                        ELSE p.signal
                    END AS signal,
                    p.confidence,
                    p.support_price,
                    p.ai_reasoning,
                    p.validation_status,
                    p.actual_change,
                    CASE
                        WHEN dlog.decision_semantic = '建议进场' OR dlog.decision_semantic = '进场' THEN 'TriggeredLong'
                        WHEN dlog.decision_semantic = '建议防守' OR dlog.decision_semantic = '防守' THEN 'RiskOff'
                        WHEN dlog.decision_semantic IN ('暂无信号', '建议空仓', '空仓') THEN 'NoSetup'
                        WHEN dlog.decision_semantic = '建议观察' OR dlog.decision_semantic = '观察' THEN 'Watch'
                        ELSE p.layer1_status
                    END AS layer1_status,
                    p.layer1_score,
                    p.layer1_trigger_hit,
                    p.layer1_risk_off_hit,
                    p.layer1_strategy_version,
                    p.layer1_payload,
                    p.is_primary,
                    p.model_id AS model,
                    m.display_name,
                    CASE
                        WHEN dlog.decision_semantic IN ('建议空仓', '空仓') THEN '暂无信号'
                        WHEN dlog.decision_semantic = '防守' THEN '建议防守'
                        WHEN dlog.decision_semantic = '观察' THEN '建议观察'
                        WHEN dlog.decision_semantic = '进场' THEN '建议进场'
                        ELSE dlog.decision_semantic
                    END AS decision_semantic,
                    ? AS mode_id,
                    d.close AS close_price,
                    d.rsi,
                    d.kdj_k,
                    d.kdj_d,
                    d.kdj_j,
                    d.macd,
                    d.macd_signal,
                    d.macd_hist,
                    d.boll_upper,
                    d.boll_mid,
                    d.boll_lower
                FROM ai_predictions_v2 p
                LEFT JOIN prediction_models m ON p.model_id = m.model_id
                LEFT JOIN mode_decision_log dlog
                    ON dlog.mode_id = ?
                   AND dlog.symbol = p.symbol
                   AND dlog.decision_date = p.date
                LEFT JOIN daily_prices d
                    ON p.symbol = d.symbol
                   AND p.target_date = d.date
                WHERE ${whereClause}
                ORDER BY p.date DESC, m.priority DESC
                LIMIT ?
            `;

            const sqlArgs = [currentMode.mode_id, currentMode.mode_id, ...queryArgs];

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawDb = db as any;
            let rows;
            if (db.$type === 'cloud') {
                const rs = await rawDb.execute({ sql, args: sqlArgs });
                rows = rs.rows;
            } else {
                rows = rawDb.prepare(sql).all(...sqlArgs);
            }

            return NextResponse.json({
                predictions: rows,
                tier: userTier,
                mode_id: currentMode.mode_id,
            });
        } finally {
            closeDb(db);
        }
    } catch (error) {
        console.error('Predictions API Error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}
