import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { getUserTier } from '@/lib/user-server';
import { requireUserSession } from '@/lib/user-session';
import {
    DEFAULT_MODE_ID,
    ensureInvestmentModeSchema,
    getModeDecisions,
    getModeDefinition,
    getUserMode,
    isModeAllowedForTier,
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
        const currentMode = await getUserMode(db, userId, userTier);
        const modeId = (searchParams.get('mode_id') || currentMode.mode_id || DEFAULT_MODE_ID).trim();
        if (!getModeDefinition(modeId)) {
            return NextResponse.json({ error: 'Invalid mode_id' }, { status: 400 });
        }
        if (!isModeAllowedForTier(modeId, userTier)) {
            return NextResponse.json({ error: '当前会员等级不支持该模式' }, { status: 403 });
        }

        const page = Math.max(1, Number(searchParams.get('page') || '1'));
        const requestedPageSize = Math.max(1, Number(searchParams.get('page_size') || '20'));
        const pageSize = userTier === 'free' ? Math.min(10, requestedPageSize) : Math.min(100, requestedPageSize);
        const dateFrom = searchParams.get('date_from');
        const dateTo = searchParams.get('date_to');
        const symbol = userTier === 'free' ? null : searchParams.get('symbol');

        if (userTier === 'free' && modeId !== DEFAULT_MODE_ID) {
            return NextResponse.json({ error: 'Free 用户仅可查看平衡模式决策摘要' }, { status: 403 });
        }

        const result = await getModeDecisions(db, modeId, userId, dateFrom, dateTo, page, pageSize, symbol);
        return NextResponse.json({
            mode_id: modeId,
            page,
            page_size: pageSize,
            total: result.total,
            items: result.items,
        });
    } catch (error) {
        console.error('GET /api/modes/decisions error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    } finally {
        closeDb(db);
    }
}
