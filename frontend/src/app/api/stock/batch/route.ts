import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { getUserTier } from '@/lib/user-server';
import { getAllowedPredictionModelIdsForTier } from '@/lib/model-access-policy';
import { requireUserSession } from '@/lib/user-session';
import {
    DEFAULT_MODE_ID,
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
import { getCachedLatestPrices, getCachedShortMetrics } from '@/lib/stock-cache';
import { parsePredictionContentLocaleParam } from '@/lib/prediction-content-locale';
import {
    buildStockFacts,
    getBatchUiSignalModeForTier,
} from '@/lib/batch-stock-facts';

export const dynamic = 'force-dynamic';
const DASHBOARD_PREDICTION_LOOKBACK_DAYS = 10;

// Tier 0: In-memory prediction cache (survives across warm Vercel invocations)
const _predCache = new Map<string, { rows: Record<string, unknown>[]; ts: number }>();
const PRED_CACHE_TTL = 300_000; // 5 min

function getPredCacheKey(
    symbols: string[],
    historyLimit: number,
    tier: string,
    modeId: string,
    contentLocale: string,
): string {
    return `${symbols.join(',')}|${historyLimit}|${tier}|${modeId}|${contentLocale}`;
}

const EFFECTIVE_SIGNAL_WITH_OUTCOME_SQL = EFFECTIVE_SIGNAL_SQL.replace(/p\.signal/g, `COALESCE(pol.signal_state, p.signal)`);

// SAFE_LLM_SIGNAL_SQL is used in the *outer* SELECT over HistoryRanked (alias `h`),
// where `pol` is NOT in scope. The inner CTE already resolves pol overrides into
// `ai_reasoning` and `signal` columns, so we reference those directly.
const SAFE_LLM_SIGNAL_SQL = `
    COALESCE(
        CASE
            WHEN json_valid(h.ai_reasoning) THEN json_extract(h.ai_reasoning, '$.signal')
            ELSE NULL
        END,
        h.signal
    )
`;

function closeDb(db: unknown): void {
    if (db && typeof db === 'object' && 'close' in db && typeof (db as { close?: () => void }).close === 'function') {
        (db as { close: () => void }).close();
    }
}

function formatPriceUpdateTag(hkTime: Date): string {
    const month = String(hkTime.getMonth() + 1).padStart(2, '0');
    const day = String(hkTime.getDate()).padStart(2, '0');
    const hours = String(hkTime.getHours()).padStart(2, '0');
    const minutes = String(hkTime.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
}

function applyNoStoreHeaders(response: NextResponse): NextResponse {
    response.headers.set('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('X-Accel-Buffering', 'no');
    response.headers.set('Vary', 'Cookie');
    return response;
}

function setBatchObservabilityHeaders(
    response: NextResponse,
    metrics: {
        requestId: string;
        tier: string;
        symbolCount: number;
        historyLimit: number;
        uiSignalMode: string;
        queryTime: number;
        predictionCache: 'hit' | 'miss' | 'skipped';
        dataCacheMode: string;
    },
): NextResponse {
    response.headers.set('X-Stockwise-Request-Id', metrics.requestId);
    response.headers.set('X-Stockwise-Tier', metrics.tier);
    response.headers.set('X-Stockwise-Batch-Symbols', String(metrics.symbolCount));
    response.headers.set('X-Stockwise-Batch-History-Limit', String(metrics.historyLimit));
    response.headers.set('X-Stockwise-UI-Signal-Mode', metrics.uiSignalMode);
    response.headers.set('X-Stockwise-Prediction-Cache', metrics.predictionCache);
    response.headers.set('X-Stockwise-Data-Cache-Mode', metrics.dataCacheMode);
    response.headers.set('Server-Timing', `app;dur=${metrics.queryTime}`);
    return response;
}

function logBatchObservation(metrics: {
    requestId: string;
    tier: string;
    symbolCount: number;
    historyLimit: number;
    uiSignalMode: string;
    queryTime: number;
    predictionCache: 'hit' | 'miss' | 'skipped';
    dataCacheMode: string;
    stage: string;
    ok: boolean;
}) {
    console.info(
        JSON.stringify({
            type: 'stockwise_observation',
            route: '/api/stock/batch',
            ...metrics,
            ts: new Date().toISOString(),
        }),
    );
}

async function resolvePredictionContentLocaleForUser(
    client: ReturnType<typeof getDbClient>,
    userId: string,
    requestedLocale: string,
): Promise<string> {
    const fallback = requestedLocale === 'en' ? 'en' : 'cn';
    try {
        if ('execute' in client) {
            const rs = await client.execute({
                sql: 'SELECT lower(COALESCE(locale, ?)) AS locale FROM users WHERE user_id = ? LIMIT 1',
                args: [fallback, userId],
            });
            const row = (rs.rows?.[0] || null) as { locale?: string } | null;
            return String(row?.locale || fallback).trim().toLowerCase() === 'en' ? 'en' : 'cn';
        }
        const row = client
            .prepare('SELECT lower(COALESCE(locale, ?)) AS locale FROM users WHERE user_id = ? LIMIT 1')
            .get(fallback, userId) as { locale?: string } | undefined;
        return String(row?.locale || fallback).trim().toLowerCase() === 'en' ? 'en' : 'cn';
    } catch (error) {
        console.warn('[Batch] Failed to resolve user locale, fallback to requested locale:', error);
        return fallback;
    }
}

// Current international v1 contract:
// - batch is a tier-gated public facts endpoint
// - free/go/plus render from signal-first semantics
// - pro/alpha future paths keep layer1/mode detail, but are not the active v1 path

export async function GET(request: Request) {
    const requestId = `batch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    let debugStage = 'init';
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols') || '';
    const parsedHistoryLimit = Number.parseInt(searchParams.get('historyLimit') || '7', 10);
    const historyLimit = Number.isFinite(parsedHistoryLimit)
        ? Math.min(30, Math.max(1, parsedHistoryLimit))
        : 7;

    const symbols = symbolsParam ? symbolsParam.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];
    if (symbols.length > 50) return NextResponse.json({ error: 'Too many symbols' }, { status: 400 });
    const normalizedCacheSymbols = Array.from(new Set(symbols)).sort();
    const predictionContentLocale = parsePredictionContentLocaleParam(searchParams);

    const startTime = Date.now();
    const dashboardPredictionThreshold = new Date(Date.now() - DASHBOARD_PREDICTION_LOOKBACK_DAYS * 86400000)
        .toISOString()
        .split('T')[0];

    try {
        debugStage = 'require_user_session';
        const auth = requireUserSession(request);
        if ('response' in auth) {
            auth.response.headers.set('X-Stockwise-Request-Id', requestId);
            return applyNoStoreHeaders(auth.response);
        }
        const userId = auth.userId;
        debugStage = 'get_user_tier';
        const userTier = await getUserTier(userId);

        debugStage = 'get_db_client';
        const client = getDbClient();
        let latestPrices: Record<string, unknown>[] = [];
        let allHistory: Record<string, unknown>[] = [];
        let shortMetricsRows: Record<string, unknown>[] = [];
        let currentModeId = DEFAULT_MODE_ID;
        let predictionCache: 'hit' | 'miss' | 'skipped' = 'skipped';

        const placeholders = symbols.length > 0 ? symbols.map(() => '?').join(',') : '';
        const allowedModelIds = await getAllowedPredictionModelIdsForTier(client, userTier);
        const effectivePredictionContentLocale = await resolvePredictionContentLocaleForUser(
            client,
            userId,
            predictionContentLocale,
        );
        if (allowedModelIds.length === 0) {
            const response = NextResponse.json({
                stocks: symbols.map(sym => ({ symbol: sym, price: null, prediction: null, previousPrediction: null, lastUpdated: formatPriceUpdateTag(new Date()) })),
                timestamp: new Date().toISOString(),
                tier: userTier,
                queryTime: Date.now() - startTime,
                requestId
            });
            response.headers.set('X-Stockwise-Request-Id', requestId);
            return applyNoStoreHeaders(response);
        }
        const modelPlaceholders = allowedModelIds.map(() => '?').join(',');
        const historySql = `
            WITH RankedPredictions AS (
                SELECT p.symbol, p.date, p.target_date,
                        p.updated_at,
                        ${EFFECTIVE_SIGNAL_WITH_OUTCOME_SQL} AS signal,
                        COALESCE(pol.signal_state, p.signal) AS canonical_signal,
                        COALESCE(pol.confidence, p.confidence) AS confidence,
                        p.support_price,
                        -- producer_outcome_log.reasoning_payload is not locale-scoped today.
                        -- Keep user-facing reasoning bound to ai_predictions_v2.content_locale.
                        p.ai_reasoning AS ai_reasoning,
                        ${EFFECTIVE_VALIDATION_STATUS_SQL} AS validation_status, p.actual_change,
                        p.validation_data,
                        ${EFFECTIVE_LAYER1_STATUS_SQL} AS layer1_status,
                        p.layer1_status AS layer1_signal,
                        p.layer1_score, p.layer1_trigger_hit, p.layer1_risk_off_hit, p.layer1_strategy_version,
                        json_object(
                            'close', json_extract(p.layer1_payload, '$.close'),
                            'change_percent', json_extract(p.layer1_payload, '$.change_percent')
                        ) AS layer1_payload,
                        p.max_perf_in_window,
                        p.is_primary, p.model_id as model, m.display_name,
                        COALESCE(p.content_locale, 'cn') AS content_locale,
                        ${EFFECTIVE_DECISION_SEMANTIC_SQL} AS decision_semantic,
                        ? AS mode_id,
                        ROW_NUMBER() OVER (
                            PARTITION BY p.symbol, p.target_date
                            ORDER BY
                                m.priority DESC,
                                COALESCE(p.updated_at, p.created_at, p.date || ' 00:00:00') DESC,
                                p.rowid DESC
                        ) as rn_daily
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
                WHERE p.symbol IN (${placeholders})
                  AND p.target_date >= '${dashboardPredictionThreshold}'
                  AND p.model_id IN (${modelPlaceholders})
                  AND COALESCE(p.content_locale, 'cn') = ?
            ),
            DailyBest AS (
                SELECT * FROM RankedPredictions WHERE rn_daily = 1
            ),
            HistoryRanked AS (
                SELECT d.*,
                       ROW_NUMBER() OVER (
                           PARTITION BY symbol
                           ORDER BY
                               target_date DESC,
                               COALESCE(updated_at, date || ' 00:00:00') DESC
                       ) as rn_history
                FROM DailyBest d
            )
            SELECT h.*,
                   h.ai_reasoning AS llm_reasoning,
                   h.validation_data,
                   ${SAFE_LLM_SIGNAL_SQL} AS llm_signal,
                   dp.close as close_price
            FROM HistoryRanked h
            LEFT JOIN daily_prices dp ON h.symbol = dp.symbol AND h.target_date = dp.date
            WHERE h.rn_history <= ${historyLimit}
            ORDER BY h.target_date DESC, COALESCE(h.updated_at, h.date || ' 00:00:00') DESC
        `;
        const fallbackHistorySql = `
            WITH RankedPredictions AS (
                SELECT p.symbol, p.date, p.target_date,
                        p.updated_at,
                        p.signal AS signal,
                        p.signal AS canonical_signal,
                        p.confidence,
                        p.support_price,
                        p.ai_reasoning,
                        p.validation_status AS validation_status, p.actual_change,
                        p.validation_data,
                        p.layer1_status AS layer1_status,
                        p.layer1_status AS layer1_signal,
                        p.layer1_score, p.layer1_trigger_hit, p.layer1_risk_off_hit, p.layer1_strategy_version,
                        json_object(
                            'close', json_extract(p.layer1_payload, '$.close'),
                            'change_percent', json_extract(p.layer1_payload, '$.change_percent')
                        ) AS layer1_payload,
                        p.max_perf_in_window,
                        p.is_primary, p.model_id as model, m.display_name,
                        COALESCE(p.content_locale, 'cn') AS content_locale,
                        p.signal AS decision_semantic,
                        ? AS mode_id,
                        ROW_NUMBER() OVER (
                            PARTITION BY p.symbol, p.target_date
                            ORDER BY
                                m.priority DESC,
                                COALESCE(p.updated_at, p.created_at, p.date || ' 00:00:00') DESC,
                                p.rowid DESC
                        ) as rn_daily
                FROM ai_predictions_v2 p
                LEFT JOIN prediction_models m ON p.model_id = m.model_id
                WHERE p.symbol IN (${placeholders})
                  AND p.target_date >= '${dashboardPredictionThreshold}'
                  AND p.model_id IN (${modelPlaceholders})
                  AND COALESCE(p.content_locale, 'cn') = ?
            ),
            DailyBest AS (
                SELECT * FROM RankedPredictions WHERE rn_daily = 1
            ),
            HistoryRanked AS (
                SELECT d.*,
                       ROW_NUMBER() OVER (
                           PARTITION BY symbol
                           ORDER BY
                               target_date DESC,
                               COALESCE(updated_at, date || ' 00:00:00') DESC
                       ) as rn_history
                FROM DailyBest d
            )
            SELECT h.*,
                   h.ai_reasoning AS llm_reasoning,
                   h.validation_data,
                   h.signal AS llm_signal,
                   dp.close as close_price
            FROM HistoryRanked h
            LEFT JOIN daily_prices dp ON h.symbol = dp.symbol AND h.target_date = dp.date
            WHERE h.rn_history <= ${historyLimit}
            ORDER BY h.target_date DESC, COALESCE(h.updated_at, h.date || ' 00:00:00') DESC
        `;

        try {
            if (symbols.length > 0) {
                // Stage 1: Fetch Shared/Cached data (Prices & HK Short Metrics)
                const [cachedLatestPrices, cachedShortMetrics] = await Promise.all([
                    getCachedLatestPrices(normalizedCacheSymbols),
                    getCachedShortMetrics(normalizedCacheSymbols)
                ]);
                latestPrices = cachedLatestPrices;
                shortMetricsRows = cachedShortMetrics;

                // Stage 2: Fetch Dynamic/User-specific data
                let modeSchemaReady = false;
                try {
                    await ensureInvestmentModeSchema(client);
                    modeSchemaReady = true;
                    const currentMode = await getUserMode(client, userId, userTier as UserTier);
                    currentModeId = currentMode.mode_id;
                } catch (error) {
                    console.error('[Batch] Mode context unavailable, using default mode fallback:', error);
                }

                try {
                    debugStage = 'fetch_predictions';

                    const cacheKey = getPredCacheKey(
                        normalizedCacheSymbols,
                        historyLimit,
                        userTier,
                        currentModeId,
                        effectivePredictionContentLocale,
                    );
                    const cached = _predCache.get(cacheKey);
                    if (cached && Date.now() - cached.ts < PRED_CACHE_TTL) {
                        allHistory = cached.rows;
                        predictionCache = 'hit';
                    } else {
                        predictionCache = 'miss';
                        const isCloud = 'execute' in client;

                        if (isCloud) {
                            let richQuerySucceeded = false;

                            if (modeSchemaReady) {
                                const RICH_QUERY_TIMEOUT_MS = 2000;
                                try {
                                    const historyRs = await Promise.race([
                                        client.execute({
                                            sql: historySql,
                                            args: [currentModeId, currentModeId, ...symbols, ...allowedModelIds, effectivePredictionContentLocale]
                                        }),
                                        new Promise<never>((_, reject) =>
                                            setTimeout(() => reject(new Error('Rich query timeout')), RICH_QUERY_TIMEOUT_MS)
                                        )
                                    ]);
                                    if (historyRs.rows && historyRs.rows.length > 0) {
                                        allHistory = historyRs.rows as Record<string, unknown>[];
                                    }
                                    richQuerySucceeded = true;
                                } catch (e) {
                                    const reason = e instanceof Error ? e.message : 'unknown';
                                    console.warn(`[Batch] Cloud rich history failed (${reason}), falling back...`);
                                }
                            } else {
                                console.warn('[Batch] Mode schema not ready, skipping rich query');
                            }

                            if (!richQuerySucceeded) {
                                const historyRs = await client.execute({
                                    sql: fallbackHistorySql,
                                    args: [currentModeId, ...symbols, ...allowedModelIds, effectivePredictionContentLocale]
                                });
                                allHistory = historyRs.rows as Record<string, unknown>[];
                            }
                        } else {
                            try {
                                allHistory = client.prepare(historySql).all(
                                    currentModeId,
                                    currentModeId,
                                    ...symbols,
                                    ...allowedModelIds,
                                    effectivePredictionContentLocale,
                                ) as Record<string, unknown>[];
                            } catch {
                                console.warn('[Batch] Local rich history failed, falling back...');
                                allHistory = client.prepare(fallbackHistorySql).all(
                                    currentModeId,
                                    ...symbols,
                                    ...allowedModelIds,
                                    effectivePredictionContentLocale,
                                ) as Record<string, unknown>[];
                            }
                        }

                        if (allHistory.length > 0) {
                            _predCache.set(cacheKey, { rows: allHistory, ts: Date.now() });
                        }
                    }
                } catch (error) {
                    console.error('[Batch] Prediction fetch failed:', error);
                }
            }
        } finally {
            closeDb(client);
        }

        allHistory = allHistory.map(withDecisionViews);

        const hkTime = new Date(new Date().getTime() + (new Date().getTimezoneOffset() * 60000) + (3600000 * 8));

        // Calculate the threshold string exactly once to avoid redundant allocations inside the loop
        const PREDICTION_VALIDITY_DAYS = 20;
        const validDateThreshold = new Date(Date.now() - PREDICTION_VALIDITY_DAYS * 86400000).toISOString().split('T')[0];

        const stocks = buildStockFacts({
            symbols,
            latestPrices,
            shortMetricsRows,
            allHistory,
            historyLimit,
            tier: userTier,
            lastUpdated: formatPriceUpdateTag(hkTime),
            validDateThreshold,
        });

        debugStage = 'build_response';
        const response = NextResponse.json({
            stocks,
            timestamp: new Date().toISOString(),
            tier: userTier,
            uiSignalMode: getBatchUiSignalModeForTier(userTier),
            queryTime: Date.now() - startTime,
            requestId
        });
        const queryTime = Date.now() - startTime;
        setBatchObservabilityHeaders(response, {
            requestId,
            tier: userTier,
            symbolCount: symbols.length,
            historyLimit,
            uiSignalMode: getBatchUiSignalModeForTier(userTier),
            queryTime,
            predictionCache,
            dataCacheMode: 'next-unstable-cache+warm-memory',
        });
        logBatchObservation({
            requestId,
            tier: userTier,
            symbolCount: symbols.length,
            historyLimit,
            uiSignalMode: getBatchUiSignalModeForTier(userTier),
            queryTime,
            predictionCache,
            dataCacheMode: 'next-unstable-cache+warm-memory',
            stage: debugStage,
            ok: true,
        });
        return applyNoStoreHeaders(response);
    } catch (error) {
        const debugMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Batch][${requestId}][${debugStage}]`, error);
        const response = NextResponse.json({
            error: 'Database error',
            debugCode: `batch_${debugStage}`,
            debugMessage,
            requestId
        }, { status: 500 });
        setBatchObservabilityHeaders(response, {
            requestId,
            tier: 'unknown',
            symbolCount: symbols.length,
            historyLimit,
            uiSignalMode: 'unknown',
            queryTime: Date.now() - startTime,
            predictionCache: 'skipped',
            dataCacheMode: 'unknown',
        });
        logBatchObservation({
            requestId,
            tier: 'unknown',
            symbolCount: symbols.length,
            historyLimit,
            uiSignalMode: 'unknown',
            queryTime: Date.now() - startTime,
            predictionCache: 'skipped',
            dataCacheMode: 'unknown',
            stage: debugStage,
            ok: false,
        });
        return applyNoStoreHeaders(response);
    }
}
