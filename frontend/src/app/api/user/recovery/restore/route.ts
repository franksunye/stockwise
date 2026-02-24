import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import {
    createUserSessionToken,
    setUserSessionCookie
} from '@/lib/user-session';

function isValidUserId(input: unknown): input is string {
    return typeof input === 'string' && /^user_[A-Za-z0-9_-]{6,64}$/.test(input);
}

/**
 * POST /api/user/recovery/restore
 * 
 * Restore a user identity by switching to a different existing user account.
 * This does NOT rely on the current session – the whole point is to SWITCH identities.
 * 
 * Security: we only verify the target user_id exists in the database.
 * This is acceptable because user IDs are unguessable random tokens,
 * and the user must already know/possess the target ID to attempt recovery.
 */
export async function POST(request: Request) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let db: any;
    try {
        const body = await request.json().catch(() => ({}));
        const targetUserId = body?.targetUserId;

        if (!isValidUserId(targetUserId)) {
            return NextResponse.json(
                { success: false, error: '无效的用户 ID 格式' },
                { status: 400 }
            );
        }

        db = getDbClient();
        const isCloud = db.$type === 'cloud';

        // Verify the target user exists in the database
        let userExists = false;
        if (isCloud) {
            const result = await db.execute({
                sql: 'SELECT user_id FROM users WHERE user_id = ?',
                args: [targetUserId]
            });
            userExists = result.rows?.length > 0;
        } else {
            const row = db.prepare('SELECT user_id FROM users WHERE user_id = ?').get(targetUserId);
            userExists = !!row;
        }

        if (!userExists) {
            return NextResponse.json(
                { success: false, error: '目标账号不存在' },
                { status: 404 }
            );
        }

        // Create a new session token for the target user
        const sessionToken = createUserSessionToken(targetUserId);
        if (!sessionToken) {
            return NextResponse.json(
                { success: false, error: 'Session 服务未配置' },
                { status: 503 }
            );
        }

        // Update last_active_at for the restored user
        const now = new Date().toISOString();
        if (isCloud) {
            await db.execute({
                sql: 'UPDATE users SET last_active_at = ? WHERE user_id = ?',
                args: [now, targetUserId]
            });
        } else {
            db.prepare('UPDATE users SET last_active_at = ? WHERE user_id = ?').run(now, targetUserId);
        }

        const response = NextResponse.json({
            success: true,
            userId: targetUserId,
            message: '身份恢复成功！请刷新页面。'
        });

        // Set the new session cookie → subsequent requests will use the restored identity
        setUserSessionCookie(response, sessionToken);

        // Also set the legacy uid cookie for consistency
        const requestHost = new URL(request.url).hostname;
        const isZisoHost = requestHost === 'ziso.cc' || requestHost.endsWith('.ziso.cc');
        response.cookies.set({
            name: 'stockwise_uid',
            value: targetUserId,
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 365,
            ...(isZisoHost ? { domain: '.ziso.cc' } : {})
        });

        console.log(`[Recovery] Identity restored to ${targetUserId}`);
        return response;

    } catch (error: unknown) {
        console.error('[Recovery] Restore error:', error);
        return NextResponse.json(
            { success: false, error: '恢复过程中出现错误' },
            { status: 500 }
        );
    } finally {
        if (db && typeof db.close === 'function') {
            db.close();
        }
    }
}
