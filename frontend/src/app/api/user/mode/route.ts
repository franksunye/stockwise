import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { getUserTier } from '@/lib/user-server';
import { requireUserSession } from '@/lib/user-session';
import {
    DEFAULT_MODE_ID,
    ensureInvestmentModeSchema,
    getModeDefinition,
    getUserMode,
    listModeCatalogForTier,
    setUserMode,
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
    const db = getDbClient();

    try {
        await ensureInvestmentModeSchema(db);

        const currentMode = await getUserMode(db, userId, tier as UserTier);
        const modeDefinition = getModeDefinition(currentMode.mode_id) || getModeDefinition(DEFAULT_MODE_ID);

        return NextResponse.json({
            mode: modeDefinition,
            mode_id: currentMode.mode_id,
            source: currentMode.source,
            updated_at: currentMode.updated_at,
            tier,
            allowed_modes: listModeCatalogForTier(tier as UserTier),
        });
    } catch (error) {
        console.error('GET /api/user/mode error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    } finally {
        closeDb(db);
    }
}

export async function POST(request: Request) {
    const auth = requireUserSession(request);
    if ('response' in auth) return auth.response;

    const userId = auth.userId;
    const tier = await getUserTier(userId);
    const db = getDbClient();

    try {
        await ensureInvestmentModeSchema(db);

        const body = await request.json().catch(() => ({}));
        const modeId = (body?.mode_id || body?.modeId || '').toString().trim();

        if (!modeId) {
            return NextResponse.json({ error: 'Missing mode_id' }, { status: 400 });
        }

        const result = await setUserMode(db, userId, modeId, tier as UserTier);
        if (!result.ok) {
            if (result.code === 'invalid_mode') {
                return NextResponse.json({ error: 'Invalid mode_id' }, { status: 400 });
            }
            return NextResponse.json(
                { error: '当前会员等级不支持该模式，Free 仅可使用平衡模式' },
                { status: 403 }
            );
        }

        const currentMode = await getUserMode(db, userId, tier as UserTier);
        const modeDefinition = getModeDefinition(currentMode.mode_id) || getModeDefinition(DEFAULT_MODE_ID);

        return NextResponse.json({
            ok: true,
            mode: modeDefinition,
            mode_id: currentMode.mode_id,
            updated_at: currentMode.updated_at,
            note: '模式切换仅影响后续新预测，不回写历史结论',
        });
    } catch (error) {
        console.error('POST /api/user/mode error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    } finally {
        closeDb(db);
    }
}
