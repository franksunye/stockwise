import type { Tier, UserProfile } from '@/hooks/useUserProfile';

const TIERS: Tier[] = ['free', 'go', 'plus', 'pro', 'alpha'];

function coerceTier(raw: unknown): Tier {
    const t = String(raw || 'free').toLowerCase();
    return TIERS.includes(t as Tier) ? (t as Tier) : 'free';
}

/** Map `/api/user/profile` JSON to `UserProfile` (single place for field parity). */
export function mapApiJsonToUserProfile(data: Record<string, unknown> | null | undefined): UserProfile | null {
    if (!data || typeof data.userId !== 'string' || !data.userId) {
        return null;
    }

    return {
        userId: data.userId,
        tier: coerceTier(data.tier),
        expiresAt: data.expiresAt != null ? String(data.expiresAt) : null,
        watchlistCount: typeof data.watchlistCount === 'number' ? data.watchlistCount : undefined,
        email: data.email != null ? String(data.email) : null,
        locale: data.locale != null ? String(data.locale) : null,
        referralBalance: typeof data.referralBalance === 'number' ? data.referralBalance : undefined,
        totalEarned: typeof data.totalEarned === 'number' ? data.totalEarned : undefined,
        commissionRate: typeof data.commissionRate === 'number' ? data.commissionRate : undefined,
        hasOnboarded: typeof data.hasOnboarded === 'boolean' ? data.hasOnboarded : undefined,
        hasStripeCustomer: typeof data.hasStripeCustomer === 'boolean' ? data.hasStripeCustomer : undefined,
        isChannel: typeof data.isChannel === 'boolean' ? data.isChannel : undefined,
        referralAlias: data.referralAlias != null ? String(data.referralAlias) : null,
        referralCount: typeof data.referralCount === 'number' ? data.referralCount : undefined,
        recentTransactions: Array.isArray(data.recentTransactions)
            ? (data.recentTransactions as UserProfile['recentTransactions'])
            : undefined,
    };
}
