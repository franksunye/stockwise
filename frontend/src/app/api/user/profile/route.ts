import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { MEMBERSHIP_CONFIG } from '@/lib/membership-config';
import { requireUserSession } from '@/lib/user-session';
import { ensureUserReferralAlias } from '@/lib/referral-alias';

function normalizeLocale(input: unknown): 'cn' | 'en' {
    const raw = String(input || '').trim().toLowerCase();
    if (!raw) return 'cn';
    // Chinese family -> cn; all other locales route to en for prediction content.
    if (raw === 'cn' || raw === 'zh' || raw.startsWith('zh-')) return 'cn';
    return 'en';
}

export async function POST(request: Request) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let db: any;
    try {
        const auth = requireUserSession(request);
        if ('response' in auth) return auth.response;
        const userId = auth.userId;

        const { watchlist, referredBy, locale } = await request.json().catch(() => ({}));
        const preferredLocale = normalizeLocale(locale);

        db = getDbClient();
        const isCloud = db.$type === 'cloud';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = db as any;

        // 1. Get or Create User
        let user;
        if (isCloud) {
            const res = await client.execute({
                sql: "SELECT * FROM users WHERE user_id = ?",
                args: [userId]
            });
            user = res.rows[0];
        } else {
            user = client.prepare("SELECT * FROM users WHERE user_id = ?").get(userId);
        }

        if (!user) {
            // Create new free user
            const now = new Date().toISOString();
            let initialTier = 'free';
            let expiresAt = null;

            // 只有当邀请奖励开关开启时，才处理邀请奖励
            const shouldProcessReferral = MEMBERSHIP_CONFIG.switches.enableReferralReward && referredBy && referredBy !== userId;
            let validReferrerId = null;

            if (shouldProcessReferral) {
                // 1. Security Check: Verify Referrer Exists FIRST
                let referrerExists = false;
                try {
                    if (isCloud) {
                        const res = await client.execute({
                            sql: "SELECT 1 FROM users WHERE user_id = ?",
                            args: [referredBy]
                        });
                        referrerExists = res.rows.length > 0;
                    } else {
                        referrerExists = !!client.prepare("SELECT 1 FROM users WHERE user_id = ?").get(referredBy);
                    }
                } catch (e) {
                    console.error('Failed to verify referrer:', e);
                }

                if (referrerExists) {
                    // ✅ Referrer exists! Record relationship + grant referee Pro.
                    // NOTE: Referrer reward is deferred to onboarding completion
                    // to ensure the invited user truly engages with the product.
                    validReferrerId = referredBy;

                    // Referee Reward (New User gets Go trial immediately)
                    const expiryDate = new Date();
                    expiryDate.setDate(expiryDate.getDate() + MEMBERSHIP_CONFIG.referral.refereeDays);
                    initialTier = 'go';
                    expiresAt = expiryDate.toISOString();
                } else {
                    console.warn(`Referral skipped: Referrer ${referredBy} not found`);
                }
            }

            if (isCloud) {
                await client.execute({
                    sql: "INSERT INTO users (user_id, registration_type, subscription_tier, subscription_expires_at, locale, referred_by, created_at) VALUES (?, 'anonymous', ?, ?, ?, ?, ?)",
                    args: [userId, initialTier, expiresAt, preferredLocale, validReferrerId, now]
                });
            } else {
                client.prepare("INSERT INTO users (user_id, registration_type, subscription_tier, subscription_expires_at, locale, referred_by, created_at) VALUES (?, 'anonymous', ?, ?, ?, ?, ?)").run(userId, initialTier, expiresAt, preferredLocale, validReferrerId, now);
            }

            user = {
                user_id: userId,
                subscription_tier: initialTier,
                subscription_expires_at: expiresAt,
                locale: preferredLocale,
                referred_by: validReferrerId,
                is_new_user_flag: true
            };
        } else {
            // ==========================================
            // 已存在用户：更新最后活跃时间 (Last Active)
            // ==========================================
            try {
                const now = new Date().toISOString();
                if (isCloud) {
                    // Fire and forget update (awaiting only to ensure db instance is valid, but ignoring result)
                    await client.execute({
                        sql: "UPDATE users SET last_active_at = ?, locale = ? WHERE user_id = ?",
                        args: [now, preferredLocale, userId]
                    });
                } else {
                    client.prepare("UPDATE users SET last_active_at = ?, locale = ? WHERE user_id = ?").run(now, preferredLocale, userId);
                }
                user = { ...user, locale: preferredLocale };
            } catch (activeErr) {
                // Ignore errors here to not block the main flow
                console.error('Failed to update last_active_at:', activeErr);
            }

            // ==========================================
            // 处理已存在用户的邀请奖励（仅记录关系 + 给被邀请人 Pro）
            // NOTE: 邀请人奖励延迟到 onboarding 完成时发放
            // ==========================================
            const shouldProcessExistingUserReferral =
                MEMBERSHIP_CONFIG.switches.enableReferralReward &&
                referredBy &&
                referredBy !== userId &&
                user.subscription_tier === 'free' &&
                !user.referred_by;

            if (shouldProcessExistingUserReferral) {
                console.log(`Processing referral for existing user: ${userId}, referred by: ${referredBy}`);

                // 1. Security Check: Verify Referrer Exists FIRST
                let referrerExists = false;
                try {
                    if (isCloud) {
                        const res = await client.execute({
                            sql: "SELECT 1 FROM users WHERE user_id = ?",
                            args: [referredBy]
                        });
                        referrerExists = res.rows.length > 0;
                    } else {
                        referrerExists = !!client.prepare("SELECT 1 FROM users WHERE user_id = ?").get(referredBy);
                    }
                } catch (e) {
                    console.error('Failed to verify referrer for existing user:', e);
                }

                if (referrerExists) {
                    // ✅ Referrer verified. Upgrade referee only.
                    // Referrer reward deferred to onboarding completion.
                    const expiryDate = new Date();
                    expiryDate.setDate(expiryDate.getDate() + MEMBERSHIP_CONFIG.referral.refereeDays);
                    const newExpiresAt = expiryDate.toISOString();

                    try {
                        if (isCloud) {
                            await client.execute({
                                sql: "UPDATE users SET subscription_tier = 'go', subscription_expires_at = ?, referred_by = ? WHERE user_id = ?",
                                args: [newExpiresAt, referredBy, userId]
                            });
                        } else {
                            client.prepare("UPDATE users SET subscription_tier = 'go', subscription_expires_at = ?, referred_by = ? WHERE user_id = ?").run(newExpiresAt, referredBy, userId);
                        }

                        user = {
                            ...user,
                            subscription_tier: 'go',
                            subscription_expires_at: newExpiresAt,
                            referred_by: referredBy
                        };
                    } catch (referErr) {
                        console.error('Existing user referral upgrade failed:', referErr);
                    }
                } else {
                    console.warn(`Existing user referral skipped: Referrer ${referredBy} not found`);
                }
            }
        }

        // 2. Sync Watchlist
        if (watchlist && Array.isArray(watchlist) && watchlist.length > 0) {
            try {
                if (isCloud) {
                    const stmts = watchlist.map((symbol: string) => ({
                        sql: "INSERT OR IGNORE INTO user_watchlist (user_id, symbol) VALUES (?, ?)",
                        args: [userId, symbol]
                    }));
                    await client.batch(stmts);
                } else {
                    const insertStmt = client.prepare("INSERT OR IGNORE INTO user_watchlist (user_id, symbol) VALUES (?, ?)");
                    const transaction = client.transaction((items: string[]) => {
                        for (const item of items) insertStmt.run(userId, item);
                    });
                    transaction(watchlist);
                }
            } catch (err) {
                console.error('Watchlist sync error:', err);
            }
        }

        // 3. Process expiry check
        let isExpired = false;
        if (user.subscription_expires_at) {
            const expiry = new Date(user.subscription_expires_at);
            if (expiry < new Date()) {
                isExpired = true;
                // --- Lazy Correction: Update DB immediately ---
                // Only if the DB still says they are PRO/PREMIUM
                if (user.subscription_tier !== 'free') {
                    console.log(`🧹 Lazy correction: Downgrading expired user ${userId} to free`);
                    try {
                        if (isCloud) {
                            // Don't await this, let it run in background to keep API fast
                            client.execute({
                                sql: "UPDATE users SET subscription_tier = 'free' WHERE user_id = ?",
                                args: [userId]
                            }).catch((e: unknown) => console.error('Lazy correction failed:', e));
                        } else {
                            client.prepare("UPDATE users SET subscription_tier = 'free' WHERE user_id = ?").run(userId);
                        }
                    } catch (e) {
                        console.error('Lazy correction error:', e);
                    }
                }
            }
        }

        // 4. Get actual watchlist count
        let watchlistCount = 0;
        try {
            if (isCloud) {
                const countRes = await client.execute({
                    sql: "SELECT COUNT(*) as count FROM user_watchlist WHERE user_id = ?",
                    args: [userId]
                });
                watchlistCount = Number(countRes.rows[0]?.count || 0);
            } else {
                const countRow = client.prepare("SELECT COUNT(*) as count FROM user_watchlist WHERE user_id = ?").get(userId) as { count: number } | undefined;
                watchlistCount = countRow?.count || 0;
            }
        } catch (countErr) {
            console.error('Watchlist count error:', countErr);
        }

        // 5. Get referral stats (invite count + recent earnings)
        let referralCount = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let recentTransactions: any[] = [];
        try {
            if (isCloud) {
                const refCountRes = await client.execute({
                    sql: "SELECT COUNT(*) as count FROM users WHERE referred_by = ? AND has_onboarded = 1",
                    args: [userId]
                });
                referralCount = Number(refCountRes.rows[0]?.count || 0);

                const txRes = await client.execute({
                    sql: "SELECT type, amount, status, created_at, note FROM referral_transactions WHERE referrer_id = ? ORDER BY created_at DESC LIMIT 20",
                    args: [userId]
                });
                recentTransactions = txRes.rows || [];
            } else {
                const refCountRow = client.prepare("SELECT COUNT(*) as count FROM users WHERE referred_by = ? AND has_onboarded = 1").get(userId) as { count: number } | undefined;
                referralCount = refCountRow?.count || 0;
                recentTransactions = client.prepare("SELECT type, amount, status, created_at, note FROM referral_transactions WHERE referrer_id = ? ORDER BY created_at DESC LIMIT 20").all(userId);
            }
        } catch (refErr) {
            console.error('Referral stats error:', refErr);
        }

        const isChannel = user.custom_commission_rate != null;
        let referralAlias = user.referral_alias || null;
        try {
            referralAlias = await ensureUserReferralAlias(client, user.user_id, user.referral_alias);
        } catch (aliasError) {
            console.error(`Failed to ensure referral alias for profile ${user.user_id}:`, aliasError);
        }

        return NextResponse.json({
            userId: user.user_id,
            tier: isExpired ? 'free' : (user.subscription_tier || 'free'),
            expiresAt: user.subscription_expires_at,
            hasOnboarded: Boolean(user.has_onboarded),
            watchlistCount: watchlistCount,
            email: user.email,
            locale: normalizeLocale(user.locale),
            referralBalance: user.referral_balance || 0,
            totalEarned: user.total_earned || 0,
            commissionRate: user.custom_commission_rate ?? undefined,
            hasStripeCustomer: !!user.stripe_customer_id,
            isNewUser: !!user.is_new_user_flag, // We need to set this flag during creation

            // Referral & Channel data
            isChannel,
            referralAlias,
            referralCount,
            recentTransactions,
        });

    } catch (error: unknown) {
        console.error('Profile error:', error);
        return NextResponse.json({ error: (error as Error).message || 'Internal Server Error' }, { status: 500 });
    } finally {
        if (db && typeof db.close === 'function') {
            db.close();
        }
    }
}
