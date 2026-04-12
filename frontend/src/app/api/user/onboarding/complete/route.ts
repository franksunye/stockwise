import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { triggerOnDemandSync } from '@/lib/github-actions';
import { getMarketFromSymbol, getExpectedLatestDataDate } from '@/lib/date-utils';
import { MEMBERSHIP_CONFIG } from '@/lib/membership-config';
import { sendInternalNotification } from '@/lib/server-notify';
import { requireUserSession } from '@/lib/user-session';

function normalizeAppLocale(input: unknown): 'cn' | 'en' {
    const raw = String(input || '').trim().toLowerCase();
    if (raw === 'en') return 'en';
    return 'cn';
}

function buildReferralRewardNotification(locale: unknown, rewardDays: number) {
    const appLocale = normalizeAppLocale(locale);

    if (appLocale === 'en') {
        return {
            title: '🎁 Referral Reward Added',
            body: `Your invited friend has completed signup. ${rewardDays} days of GO access have been added to your account.`,
        };
    }

    return {
        title: '🎁 邀请奖励已到账',
        body: `你邀请的好友已完成注册，${rewardDays} 天 GO 会员已发放到你的账户。`,
    };
}

export async function POST(request: Request) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let db: any;
    try {
        const auth = requireUserSession(request);
        if ('response' in auth) return auth.response;
        const userId = auth.userId;
        const { selectedStock } = await request.json();

        db = getDbClient();
        const isCloud = db.$type === 'cloud';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = db as any;

        // 1. Get current user status
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
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // 2. Grant Trial if applicable
        const now = new Date();
        const currentTier = user.subscription_tier || 'free';
        let newTier = currentTier;
        let newExpiresAt = user.subscription_expires_at;

        const hasAccessHistory = Boolean(user.subscription_expires_at) || currentTier !== 'free';
        const hasActiveAccess = currentTier !== 'free' && user.subscription_expires_at && new Date(user.subscription_expires_at) > now;

        if (!hasActiveAccess) {
            if (user.has_onboarded) {
                console.log(`User ${userId} already onboarded, skipping trial grant.`);
            } else if (hasAccessHistory) {
                console.log(`User ${userId} has prior access history, skipping onboarding trial re-grant.`);
            } else {
                const trialDays = MEMBERSHIP_CONFIG.onboarding.trialDays;
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + trialDays);

                newTier = 'go';
                newExpiresAt = expiryDate.toISOString();
            }
        }

        // 3. Update User (has_onboarded + Trial)
        if (isCloud) {
            await client.execute({
                sql: "UPDATE users SET has_onboarded = 1, subscription_tier = ?, subscription_expires_at = ? WHERE user_id = ?",
                args: [newTier, newExpiresAt, userId]
            });

            // 3.5 Referrer Reward — only on FIRST onboarding completion
            if (!user.has_onboarded && user.referred_by && MEMBERSHIP_CONFIG.switches.enableReferralReward) {
                try {
                    const rewardRes = await client.execute({
                        sql: "SELECT 1 FROM referral_transactions WHERE referred_id = ? AND type = 'reward' LIMIT 1",
                        args: [userId]
                    });
                    if (rewardRes.rows.length > 0) {
                        console.log(`Referrer reward already granted for ${userId}, skipping duplicate reward.`);
                    } else {
                    const referrerId = user.referred_by;
                    const refRes = await client.execute({
                        sql: "SELECT subscription_tier, subscription_expires_at, locale FROM users WHERE user_id = ?",
                        args: [referrerId]
                    });
                    const referrer = refRes.rows[0];

                    if (referrer) {
                        const referralRewardNotification = buildReferralRewardNotification(
                            referrer.locale,
                            MEMBERSHIP_CONFIG.referral.referrerDays
                        );
                        const currentExpiry = referrer.subscription_expires_at ? new Date(referrer.subscription_expires_at) : new Date();
                        const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
                        baseDate.setDate(baseDate.getDate() + MEMBERSHIP_CONFIG.referral.referrerDays);
                        const newExpiry = baseDate.toISOString();

                        await client.execute({
                            sql: "UPDATE users SET subscription_tier = 'pro', subscription_expires_at = ? WHERE user_id = ?",
                            args: [newExpiry, referrerId]
                        });

                        const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                        await client.execute({
                            sql: "INSERT INTO referral_transactions (id, referrer_id, referred_id, type, amount, status, created_at, note) VALUES (?, ?, ?, 'reward', 0, 'completed', ?, ?)",
                            args: [txId, referrerId, userId, now.toISOString(), `+${MEMBERSHIP_CONFIG.referral.referrerDays}天 PRO (邀请奖励 - 被邀请人完成引导)`]
                        });

                        sendInternalNotification({
                            target_user_id: referrerId,
                            title: referralRewardNotification.title,
                            body: referralRewardNotification.body,
                            url: '/dashboard',
                            tag: 'referral_reward'
                        }).catch((e: unknown) => console.error('Failed to send referral notification:', e));

                        console.log(`✅ Referrer ${referrerId} rewarded on onboarding completion of ${userId}`);
                    }
                    }
                } catch (refErr) {
                    console.error('Referrer reward on onboarding failed:', refErr);
                }
            }

            // Only process selectedStock if this is the FIRST time onboarding.
            // This prevents users from abusing this API to bypass watchlist limits.
            if (selectedStock && !user.has_onboarded) {
                const checkRes = await client.execute({
                    sql: "SELECT 1 FROM user_watchlist WHERE user_id = ? AND symbol = ?",
                    args: [userId, selectedStock]
                });
                const isNewForUser = checkRes.rows.length === 0;

                if (isNewForUser) {
                    await client.execute({
                        sql: "INSERT OR IGNORE INTO user_watchlist (user_id, symbol, added_at) VALUES (?, ?, ?)",
                        args: [userId, selectedStock, now.toISOString()]
                    });

                    const existing = await client.execute({
                        sql: 'SELECT watchers_count FROM global_stock_pool WHERE symbol = ?',
                        args: [selectedStock],
                    });

                    if (existing.rows.length > 0) {
                        await client.execute({
                            sql: 'UPDATE global_stock_pool SET watchers_count = watchers_count + 1 WHERE symbol = ?',
                            args: [selectedStock],
                        });
                    } else {
                        const metaRes = await client.execute({
                            sql: "SELECT name FROM stock_meta WHERE symbol = ?",
                            args: [selectedStock]
                        });
                        const stockName = metaRes.rows[0]?.name || `股票 ${selectedStock}`;

                        await client.execute({
                            sql: 'INSERT INTO global_stock_pool (symbol, name, watchers_count, first_watched_at) VALUES (?, ?, 1, ?)',
                            args: [selectedStock, stockName, now.toISOString()],
                        });
                    }

                    // Smart synchronization jugement
                    const market = getMarketFromSymbol(selectedStock);
                    const expectedDate = getExpectedLatestDataDate(market);
                    const priceRes = await client.execute({
                        sql: 'SELECT MAX(date) as last_date FROM daily_prices WHERE symbol = ?',
                        args: [selectedStock]
                    });
                    const actualLatestDate = priceRes.rows[0]?.last_date;

                    if (!actualLatestDate || String(actualLatestDate) < expectedDate) {
                        await triggerOnDemandSync(selectedStock);
                    }
                }
            }
        } else {
            client.prepare("UPDATE users SET has_onboarded = 1, subscription_tier = ?, subscription_expires_at = ? WHERE user_id = ?").run(newTier, newExpiresAt, userId);

            // 3.5 Referrer Reward — only on FIRST onboarding completion (Local)
            if (!user.has_onboarded && user.referred_by && MEMBERSHIP_CONFIG.switches.enableReferralReward) {
                try {
                    const existingReward = client.prepare("SELECT 1 FROM referral_transactions WHERE referred_id = ? AND type = 'reward' LIMIT 1").get(userId);

                    if (existingReward) {
                        console.log(`Referrer reward already granted for ${userId}, skipping duplicate reward.`);
                    } else {
                        const referrerId = user.referred_by;
                        const referrer = client.prepare("SELECT subscription_tier, subscription_expires_at, locale FROM users WHERE user_id = ?").get(referrerId);

                        if (referrer) {
                            const referralRewardNotification = buildReferralRewardNotification(
                                referrer.locale,
                                MEMBERSHIP_CONFIG.referral.referrerDays
                            );
                            const currentExpiry = referrer.subscription_expires_at ? new Date(referrer.subscription_expires_at) : new Date();
                            const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
                            baseDate.setDate(baseDate.getDate() + MEMBERSHIP_CONFIG.referral.referrerDays);
                            const newExpiry = baseDate.toISOString();

                            client.prepare("UPDATE users SET subscription_tier = 'pro', subscription_expires_at = ? WHERE user_id = ?").run(newExpiry, referrerId);

                            const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                            client.prepare("INSERT INTO referral_transactions (id, referrer_id, referred_id, type, amount, status, created_at, note) VALUES (?, ?, ?, 'reward', 0, 'completed', ?, ?)").run(txId, referrerId, userId, now.toISOString(), `+${MEMBERSHIP_CONFIG.referral.referrerDays}天 PRO (邀请奖励 - 被邀请人完成引导)`);

                            sendInternalNotification({
                                target_user_id: referrerId,
                                title: referralRewardNotification.title,
                                body: referralRewardNotification.body,
                                url: '/dashboard',
                                tag: 'referral_reward'
                            }).catch((e: unknown) => console.error('Failed to send referral notification:', e));

                            console.log(`✅ Referrer ${referrerId} rewarded on onboarding completion of ${userId}`);
                        }
                    }
                } catch (refErr) {
                    console.error('Referrer reward on onboarding failed (local):', refErr);
                }
            }

            if (selectedStock && !user.has_onboarded) {
                const alreadyWatched = client.prepare("SELECT 1 FROM user_watchlist WHERE user_id = ? AND symbol = ?").get(userId, selectedStock);

                if (!alreadyWatched) {
                    client.prepare("INSERT OR IGNORE INTO user_watchlist (user_id, symbol, added_at) VALUES (?, ?, ?)").run(userId, selectedStock, now.toISOString());

                    const existing = client.prepare('SELECT watchers_count FROM global_stock_pool WHERE symbol = ?').get(selectedStock);

                    if (existing) {
                        client.prepare('UPDATE global_stock_pool SET watchers_count = watchers_count + 1 WHERE symbol = ?').run(selectedStock);
                    } else {
                        const meta = client.prepare("SELECT name FROM stock_meta WHERE symbol = ?").get(selectedStock);
                        const stockName = meta?.name || `股票 ${selectedStock}`;
                        client.prepare('INSERT INTO global_stock_pool (symbol, name, watchers_count, first_watched_at) VALUES (?, ?, 1, ?)').run(selectedStock, stockName, now.toISOString());
                    }

                    // Smart sync (Local)
                    const market = getMarketFromSymbol(selectedStock);
                    const expectedDate = getExpectedLatestDataDate(market);
                    const row = client.prepare('SELECT MAX(date) as last_date FROM daily_prices WHERE symbol = ?').get(selectedStock);
                    const actualLatestDate = row?.last_date;

                    if (!actualLatestDate || String(actualLatestDate) < expectedDate) {
                        await triggerOnDemandSync(selectedStock);
                    }
                }
            }

        }

        return NextResponse.json({
            success: true,
            tier: newTier,
            expiresAt: newExpiresAt,
            hasOnboarded: true
        });

    } catch (error: unknown) {
        console.error('Onboarding complete error:', error);
        return NextResponse.json({ error: (error as Error).message || 'Internal Server Error' }, { status: 500 });
    } finally {
        if (db && typeof db.close === 'function') {
            db.close();
        }
    }
}
