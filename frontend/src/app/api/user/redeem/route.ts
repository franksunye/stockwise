import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { MEMBERSHIP_CONFIG } from '@/lib/membership-config';

export async function POST(request: Request) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let db: any;
    try {
        const { userId, code } = await request.json();

        if (!userId || !code) {
            return NextResponse.json({ error: 'Missing userId or code' }, { status: 400 });
        }

        // 检查激活码兑换开关
        if (!MEMBERSHIP_CONFIG.switches.enableRedemption) {
            return NextResponse.json({ error: '激活码功能已停用' }, { status: 403 });
        }

        db = getDbClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = db as any;
        const now = new Date().toISOString();
        const normalizedCode = code.trim().toUpperCase();

        const isCloud = db.$type === 'cloud';

        // 1. Verify Code
        let codeRecord;
        if (isCloud) {
            const res = await client.execute({
                sql: "SELECT * FROM invitation_codes WHERE code = ? AND is_used = 0",
                args: [normalizedCode]
            });
            codeRecord = res.rows[0];
        } else {
            codeRecord = client.prepare("SELECT * FROM invitation_codes WHERE code = ? AND is_used = 0").get(normalizedCode);
        }

        if (!codeRecord) {
            return NextResponse.json({ error: '无效或已使用的激活码' }, { status: 400 });
        }

        // 2. Calculate New Expiry
        const durationDays = codeRecord.duration_days;
        let currentExpiresAt: Date | null = null;

        // Fetch current user subscription status to extend instead of overwrite
        let userRecord;
        if (isCloud) {
            const res = await client.execute({
                sql: "SELECT subscription_expires_at FROM users WHERE user_id = ?",
                args: [userId]
            });
            userRecord = res.rows[0];
        } else {
            userRecord = client.prepare("SELECT subscription_expires_at FROM users WHERE user_id = ?").get(userId);
        }

        if (userRecord && userRecord.subscription_expires_at) {
            currentExpiresAt = new Date(userRecord.subscription_expires_at);
        }

        const baseTime = (currentExpiresAt && currentExpiresAt > new Date()) ? currentExpiresAt : new Date();
        baseTime.setDate(baseTime.getDate() + durationDays);
        const newExpiryStr = baseTime.toISOString();

        // 3. Execute Updates with Optimistic Locking
        if (isCloud) {
            // Turso/libSQL Batch Transaction
            // Note: Batch doesn't support returning affected rows from individual statements easily in all client versions,
            // but we can rely on the 'is_used = 0' condition.
            // However, to be strictly safe and detectable, we should execute the UPDATE first and check result.

            const updateRes = await client.execute({
                sql: "UPDATE invitation_codes SET is_used = 1, used_by_user_id = ?, used_at = ? WHERE code = ? AND is_used = 0",
                args: [userId, now, normalizedCode]
            });

            if (updateRes.rowsAffected === 0) {
                return NextResponse.json({ error: '无效或已使用的激活码 (Race Condition)' }, { status: 409 });
            }

            // Only proceed to update user if code update succeeded (Optimistic Lock passed)
            await client.execute({
                sql: `INSERT INTO users (user_id, subscription_tier, subscription_expires_at, registration_type) 
                      VALUES (?, 'pro', ?, 'anonymous') 
                      ON CONFLICT(user_id) DO UPDATE SET 
                      subscription_tier = 'pro', 
                      subscription_expires_at = ?`,
                args: [userId, newExpiryStr, newExpiryStr]
            });

        } else {
            // Local SQLite Transaction
            const transaction = client.transaction(() => {
                const updateRes = client.prepare("UPDATE invitation_codes SET is_used = 1, used_by_user_id = ?, used_at = ? WHERE code = ? AND is_used = 0")
                    .run(userId, now, normalizedCode);

                if (updateRes.changes === 0) {
                    throw new Error('CODE_ALREADY_USED');
                }

                client.prepare(`
                INSERT INTO users (user_id, subscription_tier, subscription_expires_at, registration_type) 
                VALUES (?, 'pro', ?, 'anonymous') 
                ON CONFLICT(user_id) DO UPDATE SET 
                subscription_tier = 'pro', 
                subscription_expires_at = ?
                `).run(userId, newExpiryStr, newExpiryStr);
            });

            try {
                transaction();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (err: any) {
                if (err.message === 'CODE_ALREADY_USED') {
                    return NextResponse.json({ error: '无效或已使用的激活码' }, { status: 409 });
                }
                throw err;
            }
        }

        return NextResponse.json({
            success: true,
            tier: 'pro',
            expiresAt: newExpiryStr
        });

    } catch (error: unknown) {
        console.error('Redeem error:', error);
        return NextResponse.json({ error: (error as Error).message || 'Internal Server Error' }, { status: 500 });
    } finally {
        if (db && typeof db.close === 'function') {
            db.close();
        }
    }
}
