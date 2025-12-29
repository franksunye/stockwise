import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { userId, watchlist } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const db = getDbClient();
        const isCloud = 'execute' in db && typeof db.execute === 'function' && !('prepare' in db);

        // 1. Get or Create User
        let user;
        if (isCloud) {
            const res = await (db as any).execute({
                sql: "SELECT * FROM users WHERE user_id = ?",
                args: [userId]
            });
            user = res.rows[0];
        } else {
            user = (db as any).prepare("SELECT * FROM users WHERE user_id = ?").get(userId);
        }

        if (!user) {
            // Create new free user
            const now = new Date().toISOString();
            if (isCloud) {
                await (db as any).execute({
                    sql: "INSERT INTO users (user_id, registration_type, subscription_tier, created_at) VALUES (?, 'anonymous', 'free', ?)",
                    args: [userId, now]
                });
            } else {
                (db as any).prepare("INSERT INTO users (user_id, registration_type, subscription_tier, created_at) VALUES (?, 'anonymous', 'free', ?)").run(userId, now);
            }

            user = {
                user_id: userId,
                subscription_tier: 'free',
                subscription_expires_at: null
            };
        }

        // 2. Sync Watchlist (Local -> Cloud)
        // We strictly add local items to cloud. We do not delete cloud items.
        if (watchlist && Array.isArray(watchlist) && watchlist.length > 0) {
            try {
                if (isCloud) {
                    const stmts = watchlist.map((symbol: string) => ({
                        sql: "INSERT OR IGNORE INTO user_watchlist (user_id, symbol) VALUES (?, ?)",
                        args: [userId, symbol]
                    }));
                    await (db as any).batch(stmts);
                } else {
                    const insertStmt = (db as any).prepare("INSERT OR IGNORE INTO user_watchlist (user_id, symbol) VALUES (?, ?)");
                    const transaction = (db as any).transaction((items: string[]) => {
                        for (const item of items) insertStmt.run(userId, item);
                    });
                    transaction(watchlist);
                }
            } catch (err) {
                console.error('Watchlist sync error:', err);
                // Non-blocking error
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

        return NextResponse.json({
            userId: user.user_id,
            tier: isExpired ? 'free' : (user.subscription_tier || 'free'),
            expiresAt: user.subscription_expires_at
        });

    } catch (error: any) {
        console.error('Profile error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
