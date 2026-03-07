import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { getUserTier } from '@/lib/user-server';
import { requireUserSession } from '@/lib/user-session';
import {
    DEFAULT_MODE_ID,
    INSUFFICIENT_SAMPLE_TEXT,
    MODE_MIN_SAMPLE_SIZE,
    PERFORMANCE_DISCLAIMER,
    ensureInvestmentModeSchema,
    getLatestPerformanceSnapshot,
    getModeDefinition,
    getUserMode,
    listModeCatalogForTier,
    type Horizon,
    type PerformanceScope,
    type UserTier,
} from '@/lib/investment-mode';

export const dynamic = 'force-dynamic';

function closeDb(db: unknown): void {
    if (db && typeof db === 'object' && 'close' in db && typeof (db as { close?: () => void }).close === 'function') {
        (db as { close: () => void }).close();
    }
}

function toSummaryResponse(
    snapshot: Awaited<ReturnType<typeof getLatestPerformanceSnapshot>>,
    modeId: string,
    scope: PerformanceScope,
    horizon: Horizon
) {
    if (!snapshot) {
        return {
            mode_id: modeId,
            scope,
            horizon,
            state: 'stale_data' as const,
            insufficient_sample: false,
            message: '暂无可用表现数据，请稍后重试',
            disclaimer: PERFORMANCE_DISCLAIMER,
        };
    }

    const insufficient = snapshot.sample_size < MODE_MIN_SAMPLE_SIZE;

    return {
        mode_id: modeId,
        scope,
        horizon,
        state: insufficient ? ('insufficient_sample' as const) : ('ready' as const),
        insufficient_sample: insufficient,
        message: insufficient ? INSUFFICIENT_SAMPLE_TEXT : null,
        as_of_date: snapshot.as_of_date,
        computed_at: snapshot.computed_at,
        segment_key: snapshot.segment_key,
        metrics: {
            coverage: snapshot.coverage,
            hit_rate: snapshot.hit_rate,
            max_drawdown: snapshot.max_drawdown,
            sample_size: snapshot.sample_size,
            payoff_ratio: snapshot.payoff_ratio,
            stability_score: snapshot.stability_score,
        },
        disclaimer: PERFORMANCE_DISCLAIMER,
    };
}

export async function GET(request: Request) {
    const auth = requireUserSession(request);
    if ('response' in auth) return auth.response;

    const userId = auth.userId;
    const tier = await getUserTier(userId);
    const userTier = tier as UserTier;
    const db = getDbClient();

    try {
        await ensureInvestmentModeSchema(db);

        const currentMode = await getUserMode(db, userId, userTier);
        const modeId = currentMode.mode_id || DEFAULT_MODE_ID;
        const modeDefinition = getModeDefinition(modeId) || getModeDefinition(DEFAULT_MODE_ID);
        const horizon: Horizon = '30d';
        const scopes: PerformanceScope[] = userTier === 'pro' ? ['universal', 'pool'] : ['universal'];

        const snapshots = await Promise.all(
            scopes.map(async (scope) => {
                const snapshot = await getLatestPerformanceSnapshot(db, userId, modeId, scope, horizon, null);
                return [scope, toSummaryResponse(snapshot, modeId, scope, horizon)] as const;
            })
        );

        return NextResponse.json({
            mode: modeDefinition,
            mode_id: modeId,
            source: currentMode.source,
            updated_at: currentMode.updated_at,
            tier,
            allowed_modes: listModeCatalogForTier(userTier),
            summaries: Object.fromEntries(snapshots),
        });
    } catch (error) {
        console.error('GET /api/user/mode/summary error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    } finally {
        closeDb(db);
    }
}
