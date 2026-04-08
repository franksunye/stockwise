import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getDbClient } from '@/lib/db';
import { parsePredictionContentLocaleParam } from '@/lib/prediction-content-locale';
import { getTrustedUserIdFromRequest } from '@/lib/user-session';

const SAFE_LLM_SIGNAL_SQL = `
    COALESCE(
        CASE
            WHEN json_valid(p.ai_reasoning) THEN json_extract(p.ai_reasoning, '$.signal')
            ELSE NULL
        END,
        p.signal
    )
`;

async function resolvePredictionContentLocaleForUser(
    client: ReturnType<typeof getDbClient>,
    userId: string | null,
    requestedLocale: string,
): Promise<string> {
    const fallback = requestedLocale === 'en' ? 'en' : 'cn';
    if (!userId) return fallback;
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
        console.warn('[Stock] Failed to resolve user locale, fallback to requested locale:', error);
        return fallback;
    }
}

// Stock detail keeps the original prediction shape and adds explicit dual-track aliases:
// - canonical_signal / layer1_signal for the stored base result
// - llm_signal / llm_reasoning for the AI-side interpretation from ai_reasoning

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const history = searchParams.get('history');
    const predictionContentLocale = parsePredictionContentLocaleParam(searchParams);

    try {
        const client = getDbClient();
        const userId = getTrustedUserIdFromRequest(request);

        try {
            const effectivePredictionContentLocale = await resolvePredictionContentLocaleForUser(
                client,
                userId,
                predictionContentLocale,
            );
            if (!symbol) {
                let rowObjects;
                if ('execute' in client) {
                    const rs = await client.execute('SELECT DISTINCT symbol FROM daily_prices');
                    rowObjects = rs.rows;
                } else {
                    rowObjects = client.prepare('SELECT DISTINCT symbol FROM daily_prices').all();
                }
                return NextResponse.json({ symbols: (rowObjects as { symbol: string }[]).map((r) => r.symbol) });
            }

            if (history) {
                const limit = parseInt(history) || 30;
                let rows;
                if ('execute' in client) {
                    const rs = await client.execute({
                        sql: 'SELECT date, open, high, low, close, volume, change_percent FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT ?',
                        args: [symbol, limit]
                    });
                    rows = rs.rows;
                } else {
                    rows = client.prepare('SELECT date, open, high, low, close, volume, change_percent FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT ?').all(symbol, limit);
                }
                return NextResponse.json({ prices: rows });
            }

            // 获取最新价格和 AI 预测
            let row, latestPrediction, prevPrediction;
            if ('execute' in client) {
                const rsPrice = await client.execute({
                    sql: 'SELECT date, open, high, low, close, volume, change_percent, rsi FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1',
                    args: [symbol]
                });
                const rsPred = await client.execute({
                    sql: `
                        SELECT p.symbol, p.date, p.target_date, p.signal, p.signal AS canonical_signal, p.layer1_status, p.layer1_status AS layer1_signal,
                               p.confidence, p.support_price,
                               p.ai_reasoning,
                               p.ai_reasoning AS llm_reasoning,
                               ${SAFE_LLM_SIGNAL_SQL} AS llm_signal,
                               json_object(
                                   'close', json_extract(p.layer1_payload, '$.close'),
                                   'change_percent', json_extract(p.layer1_payload, '$.change_percent')
                               ) AS layer1_payload,
                               d.close as close_price, m.display_name as model,
                               COALESCE(p.content_locale, 'cn') AS content_locale
                        FROM ai_predictions_v2 p
                        LEFT JOIN daily_prices d ON p.symbol = d.symbol AND p.date = d.date
                        LEFT JOIN prediction_models m ON p.model_id = m.model_id
                        WHERE p.symbol = ? AND p.is_primary = 1 AND COALESCE(p.content_locale, 'cn') = ?
                        ORDER BY p.date DESC 
                        LIMIT 2
                    `,
                    args: [symbol, effectivePredictionContentLocale]
                });
                row = rsPrice.rows[0];
                latestPrediction = rsPred.rows[0];
                prevPrediction = rsPred.rows[1];
            } else {
                row = client.prepare('SELECT date, open, high, low, close, volume, change_percent, rsi FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1').get(symbol);
                const predictions = client.prepare(`
                    SELECT p.symbol, p.date, p.target_date, p.signal, p.signal AS canonical_signal, p.layer1_status, p.layer1_status AS layer1_signal,
                           p.confidence, p.support_price,
                           p.ai_reasoning,
                           p.ai_reasoning AS llm_reasoning,
                           ${SAFE_LLM_SIGNAL_SQL} AS llm_signal,
                           json_object(
                               'close', json_extract(p.layer1_payload, '$.close'),
                               'change_percent', json_extract(p.layer1_payload, '$.change_percent')
                           ) AS layer1_payload,
                           d.close as close_price, m.display_name as model,
                           COALESCE(p.content_locale, 'cn') AS content_locale
                    FROM ai_predictions_v2 p
                    LEFT JOIN daily_prices d ON p.symbol = d.symbol AND p.date = d.date
                    LEFT JOIN prediction_models m ON p.model_id = m.model_id
                    WHERE p.symbol = ? AND p.is_primary = 1 AND COALESCE(p.content_locale, 'cn') = ?
                    ORDER BY p.date DESC 
                    LIMIT 2
                `).all(symbol, effectivePredictionContentLocale) as Record<string, unknown>[];
                latestPrediction = predictions[0];
                prevPrediction = predictions[1];
            }

            if (!row) {
                return NextResponse.json({ error: '未找到该股票数据' }, { status: 404 });
            }

            // 计算客观的最后更新时间 (Honest Label)
            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const hkTime = new Date(utc + (3600000 * 8));
            const todayStr = hkTime.toISOString().split('T')[0];

            const hours = hkTime.getHours();
            const roundedMinutes = Math.floor(hkTime.getMinutes() / 10) * 10;
            const timeStr = `${hours.toString().padStart(2, '0')}:${roundedMinutes.toString().padStart(2, '0')}`;

            let displayUpdateTime = timeStr;
            const priceData = row as { date: string } | undefined;
            if (priceData?.date && String(priceData.date) < todayStr) {
                displayUpdateTime = `${String(priceData.date).substring(5)} ${timeStr}`;
            }

            return NextResponse.json({
                price: row,
                prediction: latestPrediction || null,
                previousPrediction: prevPrediction || null,
                last_update_time: displayUpdateTime
            });
        } finally {
            if (client && typeof client.close === 'function') {
                client.close();
            }
        }

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: '数据库错误' }, { status: 500 });
    }
}
