import { NextResponse } from 'next/server';
import {
    ADMIN_SESSION_COOKIE,
    getAdminSessionSigningSecret,
    getCookieFromRequest,
    safeEqualText,
    verifyAdminSessionToken
} from '@/lib/admin-session';

/**
 * Enforce admin auth for /api/admin/* routes.
 *
 * Accepted auth methods:
 * - Signed admin session cookie (preferred for browser)
 * Accepted headers:
 * - Authorization: Bearer <ADMIN_API_SECRET>
 * - x-admin-secret: <ADMIN_API_SECRET>
 */
export function requireAdminAuth(request: Request): NextResponse | null {
    const sessionToken = getCookieFromRequest(request, ADMIN_SESSION_COOKIE);
    if (verifyAdminSessionToken(sessionToken)) {
        return null;
    }

    const authHeader = request.headers.get('authorization');
    const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
    const bearerToken = bearerMatch?.[1]?.trim() || null;
    const headerToken = request.headers.get('x-admin-secret')?.trim() ?? null;
    const token = bearerToken || headerToken;
    const secret = process.env.ADMIN_API_SECRET?.trim();
    const sessionSecret = getAdminSessionSigningSecret();

    if (secret && token && safeEqualText(token, secret)) {
        return null;
    }

    if (!secret && !sessionSecret) {
        console.error('[admin-auth] no admin auth mechanism is configured');
        return NextResponse.json({ error: 'Admin API not configured' }, { status: 503 });
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
