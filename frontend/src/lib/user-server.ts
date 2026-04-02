import { getDbClient } from './db';

export type AppTier = 'free' | 'go' | 'plus' | 'pro' | 'alpha';

const _tierCache = new Map<string, { tier: AppTier; ts: number }>();
const TIER_CACHE_TTL = 300_000; // 5 min

function normalizeTier(raw: string | null | undefined): AppTier {
    const tier = String(raw || 'free').toLowerCase();
    if (tier === 'go' || tier === 'plus' || tier === 'pro' || tier === 'alpha') return tier;
    return 'free';
}

export async function getUserTier(userId: string | null): Promise<AppTier> {
    if (!userId) return 'free';

    const cached = _tierCache.get(userId);
    if (cached && Date.now() - cached.ts < TIER_CACHE_TTL) return cached.tier;

    const client = getDbClient();
    try {
        if (client.$type === 'cloud') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cloudClient = client as any;
            const rs = await cloudClient.execute({
                sql: "SELECT subscription_tier FROM users WHERE user_id = ? LIMIT 1",
                args: [userId]
            });
            if (rs.rows.length > 0) {
                const tier = normalizeTier(rs.rows[0].subscription_tier as string | undefined);
                _tierCache.set(userId, { tier, ts: Date.now() });
                return tier;
            }
        } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const localDb = client as any;
            const row = localDb.prepare("SELECT subscription_tier FROM users WHERE user_id = ? LIMIT 1").get(userId) as { subscription_tier: string } | undefined;
            if (row) {
                const tier = normalizeTier(row.subscription_tier);
                _tierCache.set(userId, { tier, ts: Date.now() });
                return tier;
            }
        }
    } catch (e) {
        console.error('Failed to fetch user tier:', e);
    } finally {
        if (client && typeof (client as { close?: () => void }).close === 'function') {
            (client as { close: () => void }).close();
        }
    }

    return 'free';
}
