import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { randomBytes } from 'crypto';
import {
    createUserSessionToken,
    getCookieFromRequest,
    getTrustedUserIdFromRequest,
    setUserSessionCookie
} from '@/lib/user-session';
import { ensureUserReferralAlias } from '@/lib/referral-alias';

function generateUserId(): string {
    return `user_${randomBytes(6).toString('base64url')}`;
}

function isValidUserId(input: unknown): input is string {
    return typeof input === 'string' && /^user_[A-Za-z0-9_-]{6,64}$/.test(input);
}

interface RegisterBody {
    registrationType?: 'anonymous' | 'explicit';
    userId?: string;
}

/**
 * POST /api/user/register
 * 用户注册 (隐式注册)
 */
export async function POST(request: Request) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let client: any;
    try {
        const body = (await request.json().catch(() => ({}))) as RegisterBody;
        const registrationType = body.registrationType === 'explicit' ? 'explicit' : 'anonymous';
        const sessionUserId = getTrustedUserIdFromRequest(request);
        const legacyCookieUserId = getCookieFromRequest(request, 'stockwise_uid');
        const allowLegacyBootstrap = process.env.ALLOW_LEGACY_USERID_BOOTSTRAP !== 'false';

        let userId = sessionUserId;
        let legacyBootstrapUsed = false;
        let bootstrapSource: 'session' | 'body' | 'cookie' | 'generated' = 'session';

        if (!userId) {
            if (allowLegacyBootstrap && isValidUserId(body.userId)) {
                // Transitional path for existing clients: bind first session to existing local user ID.
                userId = body.userId;
                legacyBootstrapUsed = true;
                bootstrapSource = 'body';
            } else if (allowLegacyBootstrap && isValidUserId(legacyCookieUserId)) {
                // iOS A2HS fallback: recover from JS cookie when local/session storage is isolated.
                userId = legacyCookieUserId;
                legacyBootstrapUsed = true;
                bootstrapSource = 'cookie';
            } else {
                userId = generateUserId();
                bootstrapSource = 'generated';
            }
        }

        client = getDbClient();
        const now = new Date().toISOString();

        if (client.$type === 'cloud') {
            // Turso
            await client.execute({
                sql: `INSERT OR IGNORE INTO users (user_id, registration_type, created_at, last_active_at)
                        VALUES (?, ?, ?, ?)`,
                args: [userId, registrationType, now, now],
            });
        } else {
            // SQLite
            client
                .prepare(
                    `INSERT OR IGNORE INTO users (user_id, registration_type, created_at, last_active_at)
                        VALUES (?, ?, ?, ?)`
                )
                .run(userId, registrationType, now, now);
        }

        const referralAlias = await ensureUserReferralAlias(client, userId);

        const sessionToken = createUserSessionToken(userId);
        if (!sessionToken) {
            console.error('[user-session] USER_SESSION_SECRET is not configured');
            return NextResponse.json({ error: 'User session not configured' }, { status: 503 });
        }

        const response = NextResponse.json({
            success: true,
            userId,
            referralAlias,
            sessionBound: true,
            legacyBootstrapUsed,
            bootstrapSource
        });
        setUserSessionCookie(response, sessionToken);
        const requestHost = new URL(request.url).hostname;
        const isZisoHost = requestHost === 'ziso.cc' || requestHost.endsWith('.ziso.cc');
        response.cookies.set({
            name: 'stockwise_uid',
            value: userId,
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 365,
            ...(isZisoHost ? { domain: '.ziso.cc' } : {})
        });
        return response;
    } catch (error) {
        console.error('User registration error:', error);
        return NextResponse.json(
            { error: 'Registration failed' },
            { status: 500 }
        );
    } finally {
        if (client && typeof client.close === 'function') {
            client.close();
        }
    }
}
