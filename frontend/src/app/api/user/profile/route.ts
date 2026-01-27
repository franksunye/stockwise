import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { MEMBERSHIP_CONFIG } from '@/lib/membership-config';

export async function POST(request: Request) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let db: any;
    try {
        const { userId, watchlist, referredBy } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        db = getDbClient();
        const isCloud = 'execute' in db && typeof db.execute === 'function' && !('prepare' in db);

        // 1. Get or Create User
        let user;
        if (isCloud) {
            const res = await db.execute({
                sql: "SELECT * FROM users WHERE user_id = ?",
                args: [userId]
            });
            user = res.rows[0];
        } else {
            user = db.prepare("SELECT * FROM users WHERE user_id = ?").get(userId);
        }

        if (!user) {
            // Create new free user
            const now = new Date().toISOString();
            let initialTier = 'free';
            let expiresAt = null;

            // 只有当邀请奖励开关开启时，才处理邀请奖励
            const shouldProcessReferral = MEMBERSHIP_CONFIG.switches.enableReferralReward && referredBy && referredBy !== userId;

            if (shouldProcessReferral) {
                // 1. Referee Reward (New User) - 使用配置的天数
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + MEMBERSHIP_CONFIG.referral.refereeDays);
                initialTier = 'pro';
                expiresAt = expiryDate.toISOString();

                // 2. Referrer Reward (The person who shared the link)
                try {
                    let referrer;
                    if (isCloud) {
                        const res = await db.execute({
                            sql: "SELECT subscription_tier, subscription_expires_at FROM users WHERE user_id = ?",
                            args: [referredBy]
                        });
                        referrer = res.rows[0];
                    } else {
                        referrer = db.prepare("SELECT subscription_tier, subscription_expires_at FROM users WHERE user_id = ?").get(referredBy);
                    }

                    if (referrer) {
                        const currentExpiry = referrer.subscription_expires_at ? new Date(referrer.subscription_expires_at) : new Date();
                        const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
                        baseDate.setDate(baseDate.getDate() + MEMBERSHIP_CONFIG.referral.referrerDays);
                        const newExpiry = baseDate.toISOString();

                        if (isCloud) {
                            await db.execute({
                                sql: "UPDATE users SET subscription_tier = 'pro', subscription_expires_at = ? WHERE user_id = ?",
                                args: [newExpiry, referredBy]
                            });
                        } else {
                            db.prepare("UPDATE users SET subscription_tier = 'pro', subscription_expires_at = ? WHERE user_id = ?").run(newExpiry, referredBy);
                        }
                    }
                } catch (referErr) {
                    console.error('Referrer reward failed:', referErr);
                }
            }

            if (isCloud) {
                await db.execute({
                    sql: "INSERT INTO users (user_id, registration_type, subscription_tier, subscription_expires_at, referred_by, created_at) VALUES (?, 'anonymous', ?, ?, ?, ?)",
                    args: [userId, initialTier, expiresAt, referredBy || null, now]
                });
            } else {
                db.prepare("INSERT INTO users (user_id, registration_type, subscription_tier, subscription_expires_at, referred_by, created_at) VALUES (?, 'anonymous', ?, ?, ?, ?)").run(userId, initialTier, expiresAt, referredBy || null, now);
            }

            user = {
                user_id: userId,
                subscription_tier: initialTier,
                subscription_expires_at: expiresAt,
                referred_by: referredBy || null
            };
        } else {
            // ==========================================
            // 处理已存在用户的邀请奖励
            // ==========================================
            const shouldProcessExistingUserReferral =
                MEMBERSHIP_CONFIG.switches.enableReferralReward &&
                referredBy &&
                referredBy !== userId &&
                user.subscription_tier === 'free' &&
                !user.referred_by;

            if (shouldProcessExistingUserReferral) {
                console.log(`Processing referral for existing user: ${userId}, referred by: ${referredBy}`);
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + MEMBERSHIP_CONFIG.referral.refereeDays);
                const newExpiresAt = expiryDate.toISOString();

                try {
                    if (isCloud) {
                        await db.execute({
                            sql: "UPDATE users SET subscription_tier = 'pro', subscription_expires_at = ?, referred_by = ? WHERE user_id = ?",
                            args: [newExpiresAt, referredBy, userId]
                        });
                    } else {
                        db.prepare("UPDATE users SET subscription_tier = 'pro', subscription_expires_at = ?, referred_by = ? WHERE user_id = ?").run(newExpiresAt, referredBy, userId);
                    }

                    user = {
                        ...user,
                        subscription_tier: 'pro',
                        subscription_expires_at: newExpiresAt,
                        referred_by: referredBy
                    };

                    let referrer;
                    if (isCloud) {
                        const res = await db.execute({
                            sql: "SELECT subscription_tier, subscription_expires_at FROM users WHERE user_id = ?",
                            args: [referredBy]
                        });
                        referrer = res.rows[0];
                    } else {
                        referrer = db.prepare("SELECT subscription_tier, subscription_expires_at FROM users WHERE user_id = ?").get(referredBy);
                    }

                    if (referrer) {
                        const currentExpiry = referrer.subscription_expires_at ? new Date(referrer.subscription_expires_at) : new Date();
                        const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
                        baseDate.setDate(baseDate.getDate() + MEMBERSHIP_CONFIG.referral.referrerDays);
                        const newExpiry = baseDate.toISOString();

                        if (isCloud) {
                            await db.execute({
                                sql: "UPDATE users SET subscription_tier = 'pro', subscription_expires_at = ? WHERE user_id = ?",
                                args: [newExpiry, referredBy]
                            });
                        } else {
                            db.prepare("UPDATE users SET subscription_tier = 'pro', subscription_expires_at = ? WHERE user_id = ?").run(newExpiry, referredBy);
                        }
                    }
                } catch (referErr) {
                    console.error('Existing user referral reward failed:', referErr);
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
                    await db.batch(stmts);
                } else {
                    const insertStmt = db.prepare("INSERT OR IGNORE INTO user_watchlist (user_id, symbol) VALUES (?, ?)");
                    const transaction = db.transaction((items: string[]) => {
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
            }
        }

        // 4. Get actual watchlist count
        let watchlistCount = 0;
        try {
            if (isCloud) {
                const countRes = await db.execute({
                    sql: "SELECT COUNT(*) as count FROM user_watchlist WHERE user_id = ?",
                    args: [userId]
                });
                watchlistCount = Number(countRes.rows[0]?.count || 0);
            } else {
                const countRow = db.prepare("SELECT COUNT(*) as count FROM user_watchlist WHERE user_id = ?").get(userId) as { count: number } | undefined;
                watchlistCount = countRow?.count || 0;
            }
        } catch (countErr) {
            console.error('Watchlist count error:', countErr);
        }

        return NextResponse.json({
            userId: user.user_id,
            tier: isExpired ? 'free' : (user.subscription_tier || 'free'),
            expiresAt: user.subscription_expires_at,
            hasOnboarded: Boolean(user.has_onboarded),
            watchlistCount: watchlistCount,
            email: user.email,
            referralBalance: user.referral_balance || 0,
            totalEarned: user.total_earned || 0,

            commissionRate: user.custom_commission_rate ?? MEMBERSHIP_CONFIG.referral.defaultCommissionRate,
            hasStripeCustomer: !!user.stripe_customer_id
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
