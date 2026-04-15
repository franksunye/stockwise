import type { DbClient } from '@/lib/db';
import { ensureUserReferralAlias } from '@/lib/referral-alias';

type UserRow = Record<string, unknown>;

export type NormalizedLocale = 'cn' | 'en';

export type BootstrapWatchlistItem = {
    symbol: string;
    name: string;
    name_en: string | null;
    addedAt: string | null;
};

export type BootstrapPayloadOptions = {
    watchlist?: string[];
    referredBy?: string | null;
    locale?: unknown;
    explicitLocale?: boolean;
    referralRewardEnabled: boolean;
    referralDays: number;
    includeReferralDetails?: boolean;
    includeWatchlistItems?: boolean;
};

type PreparedUserBootstrap = {
    user: UserRow;
    tier: string;
    expiresAt: string | null;
    hasOnboarded: boolean;
    watchlistCount: number;
    watchlist: BootstrapWatchlistItem[];
    locale: NormalizedLocale;
    isChannel: boolean;
    referralAlias?: string | null;
    referralCount?: number;
    recentTransactions?: Array<Record<string, unknown>>;
    referralBalance?: number;
    totalEarned?: number;
    commissionRate?: number;
    hasStripeCustomer?: boolean;
    isNewUser?: boolean;
};

export function normalizeProfileLocale(input: unknown): NormalizedLocale {
    const raw = String(input || '').trim().toLowerCase();
    if (!raw) return 'cn';
    if (raw === 'cn' || raw === 'zh' || raw.startsWith('zh-')) return 'cn';
    return 'en';
}

function resolveResponseLocale(user: UserRow, preferredLocale: NormalizedLocale, tier: string): NormalizedLocale {
    // Keep invite/onboarding entry aligned with the user's current environment.
    // Otherwise an old anonymous row with locale=cn can force English iPhone users
    // back into Chinese before they ever complete onboarding.
    if (!Boolean(user.has_onboarded) && tier === 'free') {
        return preferredLocale;
    }
    return normalizeProfileLocale(user.locale);
}

function normalizeTier(raw: unknown): string {
    const tier = String(raw || 'free').toLowerCase();
    if (tier === 'go' || tier === 'plus' || tier === 'pro' || tier === 'alpha') return tier;
    return 'free';
}

async function executeQuery<T extends Record<string, unknown> = Record<string, unknown>>(
    client: DbClient,
    sql: string,
    args: Array<string | number | null> = [],
): Promise<T[]> {
    if ('execute' in client) {
        const rs = await client.execute({ sql, args });
        return rs.rows as unknown as T[];
    }
    return client.prepare(sql).all(...args) as T[];
}

async function executeOne<T extends Record<string, unknown> = Record<string, unknown>>(
    client: DbClient,
    sql: string,
    args: Array<string | number | null> = [],
): Promise<T | null> {
    const rows = await executeQuery<T>(client, sql, args);
    return rows[0] || null;
}

async function runStatement(
    client: DbClient,
    sql: string,
    args: Array<string | number | null> = [],
): Promise<void> {
    if ('execute' in client) {
        await client.execute({ sql, args });
        return;
    }
    client.prepare(sql).run(...args);
}

async function batchInsertWatchlist(client: DbClient, userId: string, watchlist: string[]): Promise<void> {
    if (watchlist.length === 0) return;

    if ('execute' in client) {
        await client.batch(
            watchlist.map((symbol) => ({
                sql: 'INSERT OR IGNORE INTO user_watchlist (user_id, symbol) VALUES (?, ?)',
                args: [userId, symbol],
            })),
        );
        return;
    }

    const insertStmt = client.prepare('INSERT OR IGNORE INTO user_watchlist (user_id, symbol) VALUES (?, ?)');
    const transaction = client.transaction((items: string[]) => {
        for (const item of items) insertStmt.run(userId, item);
    });
    transaction(watchlist);
}

async function getWatchlistSummary(
    client: DbClient,
    userId: string,
    includeWatchlistItems: boolean,
): Promise<{ count: number; items: BootstrapWatchlistItem[] }> {
    const countRow = await executeOne<{ count?: number }>(
        client,
        'SELECT COUNT(*) as count FROM user_watchlist WHERE user_id = ?',
        [userId],
    );
    const count = Number(countRow?.count || 0);

    if (!includeWatchlistItems) {
        return { count, items: [] };
    }

    const rows = await executeQuery<{
        symbol?: string;
        name?: string;
        name_en?: string | null;
        added_at?: string | null;
    }>(
        client,
        `SELECT uw.symbol,
                COALESCE(sm.name, gp.name) AS name,
                sm.name_en AS name_en,
                uw.added_at
         FROM user_watchlist uw
         LEFT JOIN global_stock_pool gp ON uw.symbol = gp.symbol
         LEFT JOIN stock_meta sm ON uw.symbol = sm.symbol
         WHERE uw.user_id = ?
         ORDER BY uw.added_at DESC`,
        [userId],
    );

    return {
        count,
        items: rows.map((row) => ({
            symbol: String(row.symbol || ''),
            name: String(row.name || row.symbol || ''),
            name_en: row.name_en == null ? null : String(row.name_en),
            addedAt: row.added_at == null ? null : String(row.added_at),
        })).filter((row) => row.symbol.length > 0),
    };
}

async function maybeLoadReferralDetails(
    client: DbClient,
    userId: string,
): Promise<{
    referralCount: number;
    recentTransactions: Array<Record<string, unknown>>;
    referralAlias: string | null;
}> {
    const referralCountRow = await executeOne<{ count?: number }>(
        client,
        'SELECT COUNT(*) as count FROM users WHERE referred_by = ? AND has_onboarded = 1',
        [userId],
    );
    const transactions = await executeQuery<Record<string, unknown>>(
        client,
        'SELECT type, amount, status, created_at, note FROM referral_transactions WHERE referrer_id = ? ORDER BY created_at DESC LIMIT 20',
        [userId],
    );
    const userRow = await executeOne<{ referral_alias?: string | null }>(
        client,
        'SELECT referral_alias FROM users WHERE user_id = ? LIMIT 1',
        [userId],
    );

    let referralAlias = userRow?.referral_alias ? String(userRow.referral_alias) : null;
    try {
        referralAlias = await ensureUserReferralAlias(client, userId, referralAlias);
    } catch (error) {
        console.error(`Failed to ensure referral alias for bootstrap ${userId}:`, error);
    }

    return {
        referralCount: Number(referralCountRow?.count || 0),
        recentTransactions: transactions,
        referralAlias,
    };
}

export async function prepareUserBootstrapPayload(
    client: DbClient,
    userId: string,
    options: BootstrapPayloadOptions,
): Promise<PreparedUserBootstrap> {
    const preferredLocale = normalizeProfileLocale(options.locale);
    const shouldPersistLocale = options.explicitLocale === true;
    const referredBy = options.referredBy || null;
    const watchlist = Array.isArray(options.watchlist)
        ? Array.from(new Set(options.watchlist.filter((symbol): symbol is string => typeof symbol === 'string' && symbol.trim().length > 0)))
        : [];

    let user = await executeOne<UserRow>(client, 'SELECT * FROM users WHERE user_id = ? LIMIT 1', [userId]);

    if (!user) {
        const now = new Date().toISOString();
        let initialTier = 'free';
        let expiresAt: string | null = null;
        let validReferrerId: string | null = null;

        if (options.referralRewardEnabled && referredBy && referredBy !== userId) {
            const referrer = await executeOne(client, 'SELECT 1 FROM users WHERE user_id = ? LIMIT 1', [referredBy]);
            if (referrer) {
                validReferrerId = referredBy;
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + options.referralDays);
                initialTier = 'go';
                expiresAt = expiryDate.toISOString();
            }
        }

        await runStatement(
            client,
            "INSERT INTO users (user_id, registration_type, subscription_tier, subscription_expires_at, locale, referred_by, created_at) VALUES (?, 'anonymous', ?, ?, ?, ?, ?)",
            [userId, initialTier, expiresAt, preferredLocale, validReferrerId, now],
        );

        user = {
            user_id: userId,
            subscription_tier: initialTier,
            subscription_expires_at: expiresAt,
            locale: preferredLocale,
            referred_by: validReferrerId,
            is_new_user_flag: true,
        };
    } else {
        try {
            const now = new Date().toISOString();
            if (shouldPersistLocale) {
                await runStatement(
                    client,
                    'UPDATE users SET last_active_at = ?, locale = ? WHERE user_id = ?',
                    [now, preferredLocale, userId],
                );
                user = { ...user, last_active_at: now, locale: preferredLocale };
            } else {
                await runStatement(
                    client,
                    'UPDATE users SET last_active_at = ? WHERE user_id = ?',
                    [now, userId],
                );
                user = { ...user, last_active_at: now };
            }
        } catch (error) {
            console.error('Failed to update last_active_at:', error);
        }

        const shouldProcessReferral =
            options.referralRewardEnabled &&
            referredBy &&
            referredBy !== userId &&
            normalizeTier(user.subscription_tier) === 'free' &&
            !user.referred_by;

        if (shouldProcessReferral) {
            const referrer = await executeOne(client, 'SELECT 1 FROM users WHERE user_id = ? LIMIT 1', [referredBy]);
            if (referrer) {
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + options.referralDays);
                const expiresAt = expiryDate.toISOString();
                await runStatement(
                    client,
                    "UPDATE users SET subscription_tier = 'go', subscription_expires_at = ?, referred_by = ? WHERE user_id = ?",
                    [expiresAt, referredBy, userId],
                );
                user = {
                    ...user,
                    subscription_tier: 'go',
                    subscription_expires_at: expiresAt,
                    referred_by: referredBy,
                };
            }
        }
    }

    await batchInsertWatchlist(client, userId, watchlist);

    let isExpired = false;
    const expiresAtRaw = user.subscription_expires_at;
    if (typeof expiresAtRaw === 'string' && expiresAtRaw) {
        const expiry = new Date(expiresAtRaw);
        if (expiry < new Date()) {
            isExpired = true;
            if (normalizeTier(user.subscription_tier) !== 'free') {
                try {
                    await runStatement(client, "UPDATE users SET subscription_tier = 'free' WHERE user_id = ?", [userId]);
                } catch (error) {
                    console.error('Lazy correction error:', error);
                }
            }
        }
    }

    const watchlistSummary = await getWatchlistSummary(client, userId, Boolean(options.includeWatchlistItems));
    const tier = isExpired ? 'free' : normalizeTier(user.subscription_tier);
    const isChannel = user.custom_commission_rate != null;

    const payload: PreparedUserBootstrap = {
        user,
        tier,
        expiresAt: typeof user.subscription_expires_at === 'string' ? user.subscription_expires_at : null,
        hasOnboarded: Boolean(user.has_onboarded),
        watchlistCount: watchlistSummary.count,
        watchlist: watchlistSummary.items,
        locale: resolveResponseLocale(user, preferredLocale, tier),
        isChannel,
        referralBalance: Number(user.referral_balance || 0),
        totalEarned: Number(user.total_earned || 0),
        commissionRate: typeof user.custom_commission_rate === 'number' ? user.custom_commission_rate : undefined,
        hasStripeCustomer: Boolean(user.stripe_customer_id),
        isNewUser: Boolean(user.is_new_user_flag),
    };

    if (options.includeReferralDetails) {
        const referralDetails = await maybeLoadReferralDetails(client, userId);
        payload.referralAlias = referralDetails.referralAlias;
        payload.referralCount = referralDetails.referralCount;
        payload.recentTransactions = referralDetails.recentTransactions;
    }

    return payload;
}
