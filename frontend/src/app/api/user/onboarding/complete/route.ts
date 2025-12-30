import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';

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

            // If user selected a stock, ensure it's in watchlist
            if (selectedStock) {
                await db.execute({
                    sql: "INSERT OR IGNORE INTO user_watchlist (user_id, symbol) VALUES (?, ?)",
                    args: [userId, selectedStock]
                });
            }
        } else {
            db.prepare("UPDATE users SET has_onboarded = 1, subscription_tier = ?, subscription_expires_at = ? WHERE user_id = ?").run(newTier, newExpiresAt, userId);

            if (selectedStock) {
                db.prepare("INSERT OR IGNORE INTO user_watchlist (user_id, symbol) VALUES (?, ?)").run(userId, selectedStock);
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
