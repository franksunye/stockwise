import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { getUserTier } from '@/lib/user-server';
import { requireUserSession } from '@/lib/user-session';
import {
    DEFAULT_MODE_ID,
    ensureInvestmentModeSchema,
    getModeDefinition,
    getModeLedger,
    getUserMode,
    isModeAllowedForTier,
    parseHorizon,
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
        const horizon = parseHorizon(searchParams.get('horizon'));
        if (!horizon) {
            return NextResponse.json({ error: 'Invalid horizon. Use 7d|30d|90d' }, { status: 400 });
        }
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
        const symbol = userTier === 'free' ? null : searchParams.get('symbol');
        const tradeStatus = userTier === 'free' ? null : searchParams.get('trade_status');

        if (userTier === 'free' && (modeId !== DEFAULT_MODE_ID || horizon !== '30d')) {
            return NextResponse.json({ error: 'Free 用户仅可查看平衡模式 30D 的摘要台账' }, { status: 403 });
        }

        const result = await getModeLedger(db, modeId, horizon, userId, page, pageSize, symbol, tradeStatus);
        return NextResponse.json({
            mode_id: modeId,
            horizon,
            page,
            page_size: pageSize,
            total: result.total,
            items: result.items,
        });
    } catch (error) {
        console.error('GET /api/modes/performance/ledger error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    } finally {
        closeDb(db);
    }
}
