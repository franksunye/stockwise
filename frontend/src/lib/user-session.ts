import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

export const USER_SESSION_COOKIE = 'stockwise_user_session';
export const USER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 180; // 180 days

interface UserSessionPayload {
    u: string;
    exp: number;
    n: string;
}

function safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
}

function base64UrlEncode(input: string): string {
    return Buffer.from(input, 'utf8').toString('base64url');
}

function base64UrlDecode(input: string): string {
    return Buffer.from(input, 'base64url').toString('utf8');
}

function signPayload(payloadEncoded: string, secret: string): string {
    return createHmac('sha256', secret).update(payloadEncoded).digest('base64url');
}

export function getUserSessionSigningSecret(): string | null {
    return process.env.USER_SESSION_SECRET?.trim()
        || process.env.ADMIN_SESSION_SECRET?.trim()
        || process.env.ADMIN_API_SECRET?.trim()
        || null;
}

export function getCookieFromRequest(request: Request, name: string): string | null {
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return null;

    const pairs = cookieHeader.split(';');
    for (const pair of pairs) {
        const trimmed = pair.trim();
        const index = trimmed.indexOf('=');
        if (index === -1) continue;
        const key = trimmed.slice(0, index);
        if (key !== name) continue;
        return decodeURIComponent(trimmed.slice(index + 1));
    }

    return null;
}

export function createUserSessionToken(userId: string): string | null {
    const secret = getUserSessionSigningSecret();
    if (!secret || !userId) return null;

    const payload: UserSessionPayload = {
        u: userId,
        exp: Date.now() + USER_SESSION_TTL_SECONDS * 1000,
        n: randomBytes(16).toString('hex')
    };
    const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
    const signature = signPayload(payloadEncoded, secret);
    return `${payloadEncoded}.${signature}`;
}

export function parseUserSessionToken(token: string | null | undefined): { valid: boolean; userId?: string } {
    if (!token) return { valid: false };
    const secret = getUserSessionSigningSecret();
    if (!secret) return { valid: false };

    const parts = token.split('.');
    if (parts.length !== 2) return { valid: false };

    const [payloadEncoded, signature] = parts;
    if (!payloadEncoded || !signature) return { valid: false };

    const expectedSig = signPayload(payloadEncoded, secret);
    if (!safeEqual(signature, expectedSig)) return { valid: false };

    try {
        const payload = JSON.parse(base64UrlDecode(payloadEncoded)) as UserSessionPayload;
        if (!payload?.u || typeof payload.exp !== 'number') return { valid: false };
        if (payload.exp <= Date.now()) return { valid: false };
        return { valid: true, userId: payload.u };
    } catch {
        return { valid: false };
    }
}

export function setUserSessionCookie(
    response: NextResponse,
    token: string
): void {
    response.cookies.set({
        name: USER_SESSION_COOKIE,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: USER_SESSION_TTL_SECONDS
    });
}

export function clearUserSessionCookie(response: NextResponse): void {
    response.cookies.set({
        name: USER_SESSION_COOKIE,
        value: '',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0
    });
}

export function getTrustedUserIdFromRequest(request: Request): string | null {
    const token = getCookieFromRequest(request, USER_SESSION_COOKIE);
    const parsed = parseUserSessionToken(token);
    return parsed.valid && parsed.userId ? parsed.userId : null;
}

export function requireUserSession(request: Request): { userId: string } | { response: NextResponse } {
    const userId = getTrustedUserIdFromRequest(request);
    if (!userId) {
        return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
    return { userId };
}

