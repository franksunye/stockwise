import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export const ADMIN_SESSION_COOKIE = 'stockwise_admin_session';
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

interface AdminSessionPayload {
    u: string;
    exp: number;
    n: string;
}

function base64UrlEncode(input: string): string {
    return Buffer.from(input, 'utf8').toString('base64url');
}

function base64UrlDecode(input: string): string {
    return Buffer.from(input, 'base64url').toString('utf8');
}

function safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
}

export function getAdminSessionSigningSecret(): string | null {
    return process.env.ADMIN_SESSION_SECRET?.trim() || process.env.ADMIN_API_SECRET?.trim() || null;
}

function signPayload(payloadEncoded: string, secret: string): string {
    return createHmac('sha256', secret).update(payloadEncoded).digest('base64url');
}

export function createAdminSessionToken(username: string): string | null {
    const secret = getAdminSessionSigningSecret();
    if (!secret) return null;

    const payload: AdminSessionPayload = {
        u: username,
        exp: Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000,
        n: randomBytes(16).toString('hex')
    };

    const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
    const signature = signPayload(payloadEncoded, secret);
    return `${payloadEncoded}.${signature}`;
}

export function verifyAdminSessionToken(token: string | null | undefined): boolean {
    if (!token) return false;

    const secret = getAdminSessionSigningSecret();
    if (!secret) return false;

    const parts = token.split('.');
    if (parts.length !== 2) return false;

    const [payloadEncoded, signature] = parts;
    if (!payloadEncoded || !signature) return false;

    const expectedSig = signPayload(payloadEncoded, secret);
    if (!safeEqual(signature, expectedSig)) return false;

    try {
        const payload = JSON.parse(base64UrlDecode(payloadEncoded)) as AdminSessionPayload;
        if (!payload?.u || typeof payload.exp !== 'number') return false;
        const expectedUsername = process.env.ADMIN_USERNAME?.trim();
        if (expectedUsername && payload.u !== expectedUsername) return false;
        if (payload.exp <= Date.now()) return false;
        return true;
    } catch {
        return false;
    }
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
        const value = trimmed.slice(index + 1);
        return decodeURIComponent(value);
    }

    return null;
}

export function clearAdminSessionCookie(response: { cookies: { set: (options: { name: string; value: string; httpOnly: boolean; secure: boolean; sameSite: 'lax'; path: string; maxAge: number; }) => void; }; }): void {
    response.cookies.set({
        name: ADMIN_SESSION_COOKIE,
        value: '',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0
    });
}

export function setAdminSessionCookie(
    response: { cookies: { set: (options: { name: string; value: string; httpOnly: boolean; secure: boolean; sameSite: 'lax'; path: string; maxAge: number; }) => void; }; },
    token: string
): void {
    response.cookies.set({
        name: ADMIN_SESSION_COOKIE,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: ADMIN_SESSION_TTL_SECONDS
    });
}

export function safeEqualText(a: string, b: string): boolean {
    return safeEqual(a, b);
}
