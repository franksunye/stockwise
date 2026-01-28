import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { triggerOnDemandSync } from '@/lib/github-actions';

export async function POST(request: Request) {
    try {
        const { userId, selectedStock } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db: any = getDbClient();
        const isCloud = 'execute' in db && typeof db.execute === 'function' && !('prepare' in db);

        // 1. Get current user status
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
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // 2. Grant Trial if applicable
        // Only grant if currently 'free' or expired
        const now = new Date();
        const currentTier = user.subscription_tier || 'free';
        let newTier = currentTier;
        let newExpiresAt = user.subscription_expires_at;

        // Check if currently active pro
        const isActivePro = currentTier !== 'free' && user.subscription_expires_at && new Date(user.subscription_expires_at) > now;

        if (!isActivePro) {
            // Check if already onboarded (Anti-abuse)
            if (user.has_onboarded) {
                console.log(`User ${userId} already onboarded, skipping trial grant.`);
            } else {
                // GRANT TRIAL (First time only)
                const trialDays = 3;
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + trialDays);

                newTier = 'pro';
                newExpiresAt = expiryDate.toISOString();
            }
        }

        // 3. Update User (has_onboarded + Trial)
        if (isCloud) {
            await db.execute({
                sql: "UPDATE users SET has_onboarded = 1, subscription_tier = ?, subscription_expires_at = ? WHERE user_id = ?",
                args: [newTier, newExpiresAt, userId]
            });

            // If user selected a stock, ensure it's in watchlist AND global_stock_pool
            if (selectedStock) {
                // 1. Check if user already has it (to avoid double counting in global_stock_pool)
                const checkRes = await db.execute({
                    sql: "SELECT 1 FROM user_watchlist WHERE user_id = ? AND symbol = ?",
                    args: [userId, selectedStock]
                });
                const isNewForUser = checkRes.rows.length === 0;

                if (isNewForUser) {
                    // Add to user watchlist
                    await db.execute({
                        sql: "INSERT OR IGNORE INTO user_watchlist (user_id, symbol, added_at) VALUES (?, ?, ?)",
                        args: [userId, selectedStock, now.toISOString()]
                    });

                    // Update global_stock_pool watchers_count
                    const existing = await db.execute({
                        sql: 'SELECT watchers_count FROM global_stock_pool WHERE symbol = ?',
                        args: [selectedStock],
                    });

                    if (existing.rows.length > 0) {
                        await db.execute({
                            sql: 'UPDATE global_stock_pool SET watchers_count = watchers_count + 1 WHERE symbol = ?',
                            args: [selectedStock],
                        });
                    } else {
                        const metaRes = await db.execute({
                            sql: "SELECT name FROM stock_meta WHERE symbol = ?",
                            args: [selectedStock]
                        });
                        const stockName = metaRes.rows[0]?.name || `股票 ${selectedStock}`;

                        await db.execute({
                            sql: 'INSERT INTO global_stock_pool (symbol, name, watchers_count, first_watched_at) VALUES (?, ?, 1, ?)',
                            args: [selectedStock, stockName, now.toISOString()],
                        });
                    }

                    // Trigger background sync only if new
                    await triggerOnDemandSync(selectedStock);
                }
            }
        } else {
            db.prepare("UPDATE users SET has_onboarded = 1, subscription_tier = ?, subscription_expires_at = ? WHERE user_id = ?").run(newTier, newExpiresAt, userId);

            if (selectedStock) {
                const alreadyWatched = db.prepare("SELECT 1 FROM user_watchlist WHERE user_id = ? AND symbol = ?").get(userId, selectedStock);

                if (!alreadyWatched) {
                    db.prepare("INSERT OR IGNORE INTO user_watchlist (user_id, symbol, added_at) VALUES (?, ?, ?)").run(userId, selectedStock, now.toISOString());

                    // SQLite logic for global pool
                    const existing = db.prepare('SELECT watchers_count FROM global_stock_pool WHERE symbol = ?').get(selectedStock);

                    if (existing) {
                        db.prepare('UPDATE global_stock_pool SET watchers_count = watchers_count + 1 WHERE symbol = ?').run(selectedStock);
                    } else {
                        const meta = db.prepare("SELECT name FROM stock_meta WHERE symbol = ?").get(selectedStock);
                        const stockName = meta?.name || `股票 ${selectedStock}`;
                        db.prepare('INSERT INTO global_stock_pool (symbol, name, watchers_count, first_watched_at) VALUES (?, ?, 1, ?)').run(selectedStock, stockName, now.toISOString());
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
    }
}
