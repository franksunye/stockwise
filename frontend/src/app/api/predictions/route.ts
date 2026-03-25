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
import { withDecisionViews } from '@/lib/decision-views';

export const dynamic = 'force-dynamic';

const BASE_SIGNAL_SQL = `COALESCE(pol.signal_state, p.signal)`;
const BASE_CONFIDENCE_SQL = `COALESCE(pol.confidence, p.confidence)`;
const BASE_REASONING_SQL = `COALESCE(NULLIF(pol.reasoning_payload, ''), p.ai_reasoning)`;
const EFFECTIVE_SIGNAL_WITH_OUTCOME_SQL = EFFECTIVE_SIGNAL_SQL.replace(/p\.signal/g, BASE_SIGNAL_SQL);
const SAFE_LLM_SIGNAL_SQL = `
    COALESCE(
        CASE
            WHEN json_valid(${BASE_REASONING_SQL}) THEN json_extract(${BASE_REASONING_SQL}, '$.signal')
            ELSE NULL
        END,
        ${BASE_SIGNAL_SQL}
    )
`;

function closeDb(db: unknown): void {
    if (db && typeof db === 'object' && 'close' in db && typeof (db as { close?: () => void }).close === 'function') {
        (db as { close: () => void }).close();
    }
}

// Field semantics:
// - signal / layer1_status: compatibility fields that may already include current mode overlay
// - canonical_signal / layer1_signal: base stored decision view from ai_predictions_v2
// - llm_signal / llm_reasoning: AI-side interpretation extracted from ai_reasoning
// This route intentionally adds explicit views without changing existing callers.

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
                    ${EFFECTIVE_SIGNAL_WITH_OUTCOME_SQL} AS signal,
                    ${BASE_SIGNAL_SQL} AS canonical_signal,
                    ${BASE_CONFIDENCE_SQL} AS confidence,
                    p.support_price,
                    ${BASE_REASONING_SQL} AS ai_reasoning,
                    ${BASE_REASONING_SQL} AS llm_reasoning,
                    ${SAFE_LLM_SIGNAL_SQL} AS llm_signal,
                    ${EFFECTIVE_VALIDATION_STATUS_SQL} AS validation_status,
                    p.actual_change,
                    p.validation_data,
                    ${EFFECTIVE_LAYER1_STATUS_SQL} AS layer1_status,
                    p.layer1_status AS layer1_signal,
                    p.layer1_score,
                    p.layer1_trigger_hit,
                    p.layer1_risk_off_hit,
                    p.layer1_strategy_version,
                    json_object(
                        'close', json_extract(p.layer1_payload, '$.close'),
                        'change_percent', json_extract(p.layer1_payload, '$.change_percent')
                    ) AS layer1_payload,
                    p.is_primary,
                    p.model_id AS model,
                    m.display_name,
                    ${EFFECTIVE_DECISION_SEMANTIC_SQL} AS decision_semantic,
                    ? AS mode_id,
                    d.close AS close_price
                FROM ai_predictions_v2 p
                LEFT JOIN prediction_models m ON p.model_id = m.model_id
                LEFT JOIN mode_decision_log dlog
                    ON dlog.mode_id = ?
                   AND dlog.symbol = p.symbol
                   AND dlog.decision_date = p.date
                LEFT JOIN producer_outcome_log pol
                    ON pol.symbol = p.symbol
                   AND pol.trade_date = p.date
                   AND pol.producer_id = p.model_id
                   AND pol.outcome_kind = 'prediction'
                   AND pol.producer_type = 'AI'
                   AND pol.role_type = CASE WHEN COALESCE(p.is_primary, 0) = 1 THEN 'primary' ELSE 'secondary' END
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
            try {
                if (db.$type === 'cloud') {
                    const rs = await rawDb.execute({ sql, args: sqlArgs });
                    rows = rs.rows;
                } else {
                    rows = rawDb.prepare(sql).all(...sqlArgs);
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                if (!message.includes('producer_outcome_log')) throw error;
                console.warn('[Predictions] producer_outcome_log unavailable, fallback to ai_predictions_v2 only');
                const fallbackSql = `
                    SELECT
                        p.symbol,
                        p.date,
                        p.target_date,
                        ${EFFECTIVE_SIGNAL_SQL} AS signal,
                        p.signal AS canonical_signal,
                        p.confidence,
                        p.support_price,
                        p.ai_reasoning,
                        p.ai_reasoning AS llm_reasoning,
                        COALESCE(
                            CASE
                                WHEN json_valid(p.ai_reasoning) THEN json_extract(p.ai_reasoning, '$.signal')
                                ELSE NULL
                            END,
                            p.signal
                        ) AS llm_signal,
                        ${EFFECTIVE_VALIDATION_STATUS_SQL} AS validation_status,
                        p.actual_change,
                        p.validation_data,
                        ${EFFECTIVE_LAYER1_STATUS_SQL} AS layer1_status,
                        p.layer1_status AS layer1_signal,
                        p.layer1_score,
                        p.layer1_trigger_hit,
                        p.layer1_risk_off_hit,
                        p.layer1_strategy_version,
                        json_object(
                            'close', json_extract(p.layer1_payload, '$.close'),
                            'change_percent', json_extract(p.layer1_payload, '$.change_percent')
                        ) AS layer1_payload,
                        p.is_primary,
                        p.model_id AS model,
                        m.display_name,
                        ${EFFECTIVE_DECISION_SEMANTIC_SQL} AS decision_semantic,
                        ? AS mode_id,
                        d.close AS close_price
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
                if (db.$type === 'cloud') {
                    const rs = await rawDb.execute({ sql: fallbackSql, args: sqlArgs });
                    rows = rs.rows;
                } else {
                    rows = rawDb.prepare(fallbackSql).all(...sqlArgs);
                }
            }

            const enrichedRows = (rows as Record<string, unknown>[]).map(withDecisionViews);

            return NextResponse.json({
                predictions: enrichedRows,
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
