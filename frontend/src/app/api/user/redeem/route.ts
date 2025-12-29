import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { userId, code } = await request.json();

        if (!userId || !code) {
            return NextResponse.json({ error: 'Missing userId or code' }, { status: 400 });
        }

        const db = getDbClient();
        const now = new Date().toISOString();
        const normalizedCode = code.trim().toUpperCase();

        // 1. Check if user exists (create if not, though Profile API should handle this)
        // For safety, ensure user exists regarding the new columns
        // Use SQL based on client type (LibSQL vs Better-SQLite3)
        // Luckily getDbClient returns either. But their APIs are slightly different (`execute` vs `prepare().run()`).
        // This is a pain point. I should verify how getDbClient is used elsewhere.
        // Based on step 168 (db logic refactoring), maybe I should wrap this. 
        // BUT for now, let's assume I need to handle both or db.ts abstracts it? No, db.ts returns the raw client instance.

        // Check usage in `src/lib/db.ts`... it returns `createClient` result OR `new Database()`.
        // LibSQL: `await client.execute({sql, args})`
        // BetterSQLite3: `db.prepare(sql).run(args)` or `get(args)`

        // I need a helper to unify this or explicit check.
        const isCloud = 'execute' in db && typeof db.execute === 'function' && !('prepare' in db);

        // 1. Verify Code
        let codeRecord;
        if (isCloud) {
            const res = await (db as any).execute({
                sql: "SELECT * FROM invitation_codes WHERE code = ? AND is_used = 0",
                args: [normalizedCode]
            });
            codeRecord = res.rows[0];
        } else {
            codeRecord = (db as any).prepare("SELECT * FROM invitation_codes WHERE code = ? AND is_used = 0").get(normalizedCode);
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
            await (db as any).batch([
                {
                    sql: `INSERT INTO users (user_id, subscription_tier, subscription_expires_at) 
                      VALUES (?, 'pro', ?) 
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
            const transaction = (db as any).transaction(() => {
                (db as any).prepare(`
                INSERT INTO users (user_id, subscription_tier, subscription_expires_at, registration_type) 
                VALUES (?, 'pro', ?, 'anonymous') 
                ON CONFLICT(user_id) DO UPDATE SET 
                subscription_tier = 'pro', 
                subscription_expires_at = ?
             `).run(userId, expiryStr, expiryStr);

                (db as any).prepare("UPDATE invitation_codes SET is_used = 1, used_by_user_id = ?, used_at = ? WHERE code = ?")
                    .run(userId, now, normalizedCode);
            });
            transaction();
        }

        return NextResponse.json({
            success: true,
            tier: 'pro',
            expiresAt: expiryStr
        });

    } catch (error: any) {
        console.error('Redeem error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
