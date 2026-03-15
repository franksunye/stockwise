export class TestSessionClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.cookieJar = new Map();
    }
    get cookieHeader() {
        return Array.from(this.cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
    }
    mergeCookies(headers) {
        const setCookies = headers.getSetCookie ? headers.getSetCookie() : [headers.get('set-cookie')].filter(Boolean);
        for (const raw of setCookies) {
            const part = raw.split(';')[0];
            const eq = part.indexOf('=');
            if (eq > 0) this.cookieJar.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
        }
    }
    async request(patch, init = {}) {
        const headers = new Headers(init.headers || {});
        if (this.cookieJar.size > 0) headers.set('cookie', this.cookieHeader);
        const res = await fetch(`${this.baseUrl}${patch}`, { ...init, headers });
        this.mergeCookies(res.headers);
        return res;
    }
    async init() {
        // Simple registration to establish session
        const regRes = await this.request('/api/user/register', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ registrationType: 'anonymous' }),
        });
        if (!regRes.ok) throw new Error(`Init failed: ${regRes.status}`);
    }
}

export async function waitForServerReady(baseUrl) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 60000) {
        try {
            const res = await fetch(`${baseUrl}/api/shared/almanac`);
            if (res.ok) return;
        } catch {}
        await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error('Server timeout');
}
