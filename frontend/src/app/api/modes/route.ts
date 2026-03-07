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
        const currentModeDefinition = getModeDefinition(currentMode.mode_id) || getModeDefinition(DEFAULT_MODE_ID);

        return NextResponse.json({
            current_mode_id: currentMode.mode_id,
            current_mode: currentModeDefinition,
            modes: listModeCatalogForTier(tier as UserTier),
            tier,
        });
    } catch (error) {
        console.error('GET /api/modes error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    } finally {
        closeDb(db);
    }
}
