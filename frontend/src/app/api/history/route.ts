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

export const revalidate = 300; // 5 minutes cache

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

// History route exposes both compatibility fields and explicit dual-track fields.
// Consumers that need richer decision context should prefer:
// - canonical_signal / layer1_signal for base rule-disciplined view
// - llm_signal / llm_reasoning for AI-side view

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
                SELECT p.symbol, p.date, p.target_date, ${EFFECTIVE_SIGNAL_WITH_OUTCOME_SQL} AS signal, ${BASE_SIGNAL_SQL} AS canonical_signal, ${BASE_CONFIDENCE_SQL} AS confidence,
                       p.support_price, ${BASE_REASONING_SQL} AS ai_reasoning, ${BASE_REASONING_SQL} AS llm_reasoning,
                       ${SAFE_LLM_SIGNAL_SQL} AS llm_signal,
                       ${EFFECTIVE_VALIDATION_STATUS_SQL} AS validation_status, p.actual_change,
                       ${EFFECTIVE_LAYER1_STATUS_SQL} AS layer1_status, p.layer1_status AS layer1_signal,
                       p.max_perf_in_window, p.validation_data,
                       json_object(
                           'close', json_extract(p.layer1_payload, '$.close'),
                           'change_percent', json_extract(p.layer1_payload, '$.change_percent')
                       ) AS layer1_payload,
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
                LEFT JOIN producer_outcome_log pol
                    ON pol.symbol = p.symbol
                   AND pol.trade_date = p.date
                   AND pol.producer_id = p.model_id
                   AND pol.outcome_kind = 'prediction'
                   AND pol.producer_type = 'AI'
                   AND pol.role_type = CASE WHEN COALESCE(p.is_primary, 0) = 1 THEN 'primary' ELSE 'secondary' END
                LEFT JOIN daily_prices d ON p.symbol = d.symbol AND p.target_date = d.date
                WHERE p.symbol = ? AND (${tierFilter})
                ORDER BY p.date DESC, m.priority DESC
                LIMIT ? OFFSET ?
            `;
            const sqlArgs = [currentMode.mode_id, currentMode.mode_id, symbol, limit, offset];
            try {
                if ('execute' in client) {
                    const rs = await client.execute({ sql, args: sqlArgs });
                    rows = rs.rows as Record<string, unknown>[];
                } else {
                    rows = client.prepare(sql).all(...sqlArgs) as Record<string, unknown>[];
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                if (!message.includes('producer_outcome_log')) throw error;
                console.warn('[History] producer_outcome_log unavailable, fallback to ai_predictions_v2 only');
                const fallbackSql = `
                    SELECT p.symbol, p.date, p.target_date, ${EFFECTIVE_SIGNAL_SQL} AS signal, p.signal AS canonical_signal, p.confidence,
                           p.support_price, p.ai_reasoning, p.ai_reasoning AS llm_reasoning,
                           COALESCE(
                               CASE
                                   WHEN json_valid(p.ai_reasoning) THEN json_extract(p.ai_reasoning, '$.signal')
                                   ELSE NULL
                               END,
                               p.signal
                           ) AS llm_signal,
                           ${EFFECTIVE_VALIDATION_STATUS_SQL} AS validation_status, p.actual_change,
                           ${EFFECTIVE_LAYER1_STATUS_SQL} AS layer1_status, p.layer1_status AS layer1_signal,
                           p.max_perf_in_window, p.validation_data,
                           json_object(
                               'close', json_extract(p.layer1_payload, '$.close'),
                               'change_percent', json_extract(p.layer1_payload, '$.change_percent')
                           ) AS layer1_payload,
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
                    const rs = await client.execute({ sql: fallbackSql, args: sqlArgs });
                    rows = rs.rows as Record<string, unknown>[];
                } else {
                    rows = client.prepare(fallbackSql).all(...sqlArgs) as Record<string, unknown>[];
                }
            }
        } finally {
            closeDb(client);
        }

        return NextResponse.json({ predictions: rows.map(withDecisionViews), tier: userTier });
    } catch (error) {
        console.error('History API Error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}
