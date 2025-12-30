import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { MEMBERSHIP_CONFIG } from '@/lib/membership-config';

export async function POST(request: Request) {
    try {
        const { userId, code } = await request.json();

        if (!userId || !code) {
            return NextResponse.json({ error: 'Missing userId or code' }, { status: 400 });
        }

        // 检查激活码兑换开关
        if (!MEMBERSHIP_CONFIG.switches.enableRedemption) {
            return NextResponse.json({ error: '激活码功能已停用' }, { status: 403 });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db: any = getDbClient();
        const now = new Date().toISOString();
        const normalizedCode = code.trim().toUpperCase();

        const isCloud = 'execute' in db && typeof db.execute === 'function' && !('prepare' in db);

        // 1. Verify Code
        let codeRecord;
        if (isCloud) {
            const res = await db.execute({
                sql: "SELECT * FROM invitation_codes WHERE code = ? AND is_used = 0",
                args: [normalizedCode]
            });
            codeRecord = res.rows[0];
        } else {
            codeRecord = db.prepare("SELECT * FROM invitation_codes WHERE code = ? AND is_used = 0").get(normalizedCode);
        }

        if (!codeRecord) {
            return NextResponse.json({ error: '无效或已使用的激活码' }, { status: 400 });
        }

        // 2. Calculate Expiry
        const durationDays = isCloud ? codeRecord.duration_days : codeRecord.duration_days;
        // LibSQL: row is object-like (columns). BetterSQLite3: object.

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + durationDays);
        const expiryStr = expiryDate.toISOString();

        // 3. Execute Updates (Transaction ideally, but simple sequential for now)

        // Update User
        if (isCloud) {
            // Upsert user to ensure they exist, then set tier
            await db.batch([
                {
                    sql: `INSERT INTO users (user_id, subscription_tier, subscription_expires_at, registration_type) 
                      VALUES (?, 'pro', ?, 'anonymous') 
                      ON CONFLICT(user_id) DO UPDATE SET 
                      subscription_tier = 'pro', 
                      subscription_expires_at = ?`,
                    args: [userId, expiryStr, expiryStr]
                },
                {
                    sql: "UPDATE invitation_codes SET is_used = 1, used_by_user_id = ?, used_at = ? WHERE code = ?",
                    args: [userId, now, normalizedCode]
                }
            ]);
        } else {
            const transaction = db.transaction(() => {
                db.prepare(`
                INSERT INTO users (user_id, subscription_tier, subscription_expires_at, registration_type) 
                VALUES (?, 'pro', ?, 'anonymous') 
                ON CONFLICT(user_id) DO UPDATE SET 
                subscription_tier = 'pro', 
                subscription_expires_at = ?
             `).run(userId, expiryStr, expiryStr);

                db.prepare("UPDATE invitation_codes SET is_used = 1, used_by_user_id = ?, used_at = ? WHERE code = ?")
                    .run(userId, now, normalizedCode);
            });
            transaction();
        }

        return NextResponse.json({
            success: true,
            tier: 'pro',
            expiresAt: expiryStr
        });

    } catch (error: unknown) {
        console.error('Redeem error:', error);
        return NextResponse.json({ error: (error as Error).message || 'Internal Server Error' }, { status: 500 });
    }
}
