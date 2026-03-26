import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { getUserTier } from '@/lib/user-server';
import { getModelSqlFilter } from '@/lib/membership-config';
import { requireUserSession } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

function applyNoStoreHeaders(response: NextResponse): NextResponse {
    response.headers.set('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Vary', 'Cookie');
    return response;
}

function closeDb(db: unknown): void {
    if (db && typeof db === 'object' && 'close' in db && typeof (db as { close?: () => void }).close === 'function') {
        (db as { close: () => void }).close();
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols') || '';
    const symbols = symbolsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    if (symbols.length === 0) {
        return applyNoStoreHeaders(NextResponse.json({ items: [] }));
    }

    if (symbols.length > 50) {
        return applyNoStoreHeaders(NextResponse.json({ error: 'Too many symbols' }, { status: 400 }));
    }

    try {
        const auth = requireUserSession(request);
        if ('response' in auth) return applyNoStoreHeaders(auth.response);
        const userTier = await getUserTier(auth.userId);
        const tierFilter = getModelSqlFilter(userTier);
        const db = getDbClient();
        const placeholders = symbols.map(() => '?').join(',');
        const dashboardPredictionThreshold = new Date(Date.now() - 10 * 86400000)
            .toISOString()
            .split('T')[0];

        const sql = `
            WITH RankedPredictions AS (
                SELECT
                    p.symbol,
                    p.date,
                    p.target_date,
                    p.updated_at,
                    ROW_NUMBER() OVER (
                        PARTITION BY p.symbol, p.target_date
                        ORDER BY m.priority DESC
                    ) AS rn_daily
                FROM ai_predictions_v2 p
                LEFT JOIN prediction_models m ON p.model_id = m.model_id
                WHERE p.symbol IN (${placeholders})
                  AND p.target_date >= ?
                  AND (${tierFilter})
            ),
            DailyBest AS (
                SELECT symbol, date, target_date, updated_at
                FROM RankedPredictions
                WHERE rn_daily = 1
            ),
            LatestBySymbol AS (
                SELECT
                    symbol,
                    date,
                    target_date,
                    updated_at,
                    ROW_NUMBER() OVER (
                        PARTITION BY symbol
                        ORDER BY target_date DESC
                    ) AS rn_symbol
                FROM DailyBest
            )
            SELECT symbol, date, target_date, updated_at
            FROM LatestBySymbol
            WHERE rn_symbol = 1
        `;

        try {
            let rows: Record<string, unknown>[] = [];
            if ('execute' in db) {
                const rs = await db.execute({
                    sql,
                    args: [...symbols, dashboardPredictionThreshold],
                });
                rows = rs.rows as Record<string, unknown>[];
            } else {
                rows = db.prepare(sql).all(...symbols, dashboardPredictionThreshold) as Record<string, unknown>[];
            }

            return applyNoStoreHeaders(NextResponse.json({ items: rows }));
        } finally {
            closeDb(db);
        }
    } catch (error) {
        console.error('[API/Stock/PredictionVersions] Error:', error);
        return applyNoStoreHeaders(
            NextResponse.json({ error: 'Failed to fetch prediction versions' }, { status: 500 })
        );
    }
}
