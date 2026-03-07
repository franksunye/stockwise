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
    isModeAllowedForTier,
    parseHorizon,
    parsePerformanceScope,
    type UserTier,
} from '@/lib/investment-mode';

export const dynamic = 'force-dynamic';

function closeDb(db: unknown): void {
    if (db && typeof db === 'object' && 'close' in db && typeof (db as { close?: () => void }).close === 'function') {
        (db as { close: () => void }).close();
    }
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
        const { searchParams } = new URL(request.url);
        const scope = parsePerformanceScope(searchParams.get('scope'));
        const horizon = parseHorizon(searchParams.get('horizon'));
        if (!scope || !horizon) {
            return NextResponse.json({ error: 'Invalid query. scope=universal|pool, horizon=7d|30d|90d' }, { status: 400 });
        }

        const currentMode = await getUserMode(db, userId, userTier);
        const modeId = (searchParams.get('mode_id') || currentMode.mode_id || DEFAULT_MODE_ID).trim();
        if (!getModeDefinition(modeId)) {
            return NextResponse.json({ error: 'Invalid mode_id' }, { status: 400 });
        }
        if (!isModeAllowedForTier(modeId, userTier)) {
            return NextResponse.json({ error: '当前会员等级不支持该模式' }, { status: 403 });
        }
        if (userTier === 'free' && (modeId !== DEFAULT_MODE_ID || scope !== 'universal' || horizon !== '30d')) {
            return NextResponse.json({ error: 'Free 用户仅可查看平衡模式的通用 30D 表现' }, { status: 403 });
        }

        const snapshot = await getLatestPerformanceSnapshot(db, userId, modeId, scope, horizon, searchParams.get('segment'));
        if (!snapshot) {
            return NextResponse.json({
                mode_id: modeId,
                scope,
                horizon,
                state: 'stale_data',
                insufficient_sample: false,
                disclaimer: PERFORMANCE_DISCLAIMER,
                message: '暂无可用表现数据，请稍后重试',
            });
        }
        const insufficient = snapshot.sample_size < MODE_MIN_SAMPLE_SIZE;
        return NextResponse.json({
            mode_id: modeId,
            scope,
            horizon,
            as_of_date: snapshot.as_of_date,
            state: insufficient ? 'insufficient_sample' : 'ready',
            insufficient_sample: insufficient,
            disclaimer: PERFORMANCE_DISCLAIMER,
            message: insufficient ? INSUFFICIENT_SAMPLE_TEXT : null,
            coverage: snapshot.coverage,
            hit_rate: snapshot.hit_rate,
            max_drawdown: snapshot.max_drawdown,
            sample_size: snapshot.sample_size,
        });
    } catch (error) {
        console.error('GET /api/modes/performance/summary error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    } finally {
        closeDb(db);
    }
}
