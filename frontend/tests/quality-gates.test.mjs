import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, describe, it } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(FRONTEND_DIR, '..');
const LOCAL_DB_PATH = path.join(REPO_ROOT, 'data', 'stockwise.db');

const TEST_PORT = Number(process.env.TEST_PORT || '3310');
const BASE_URL = process.env.TEST_BASE_URL || `http://127.0.0.1:${TEST_PORT}`;
const SHOULD_START_SERVER = !process.env.TEST_BASE_URL;

const ROUTE_TIMEOUT_MS = 20_000;
const BOOT_TIMEOUT_MS = 180_000;

let serverProcess = null;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, timeoutMs, message) {
    const timer = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(message)), timeoutMs);
    });
    return Promise.race([promise, timer]);
}

async function waitForServerReady() {
    const startedAt = Date.now();

    while (Date.now() - startedAt < BOOT_TIMEOUT_MS) {
        let timeout;
        try {
            const controller = new AbortController();
            timeout = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`${BASE_URL}/`, {
                redirect: 'manual',
                signal: controller.signal,
            });
            if (res.status >= 200 && res.status < 500) {
                return;
            }
        } catch {
            // keep retrying until timeout
        } finally {
            if (timeout) clearTimeout(timeout);
        }
        await sleep(1000);
    }

    throw new Error(`Server did not become ready within ${BOOT_TIMEOUT_MS}ms`);
}

async function startServer() {
    const env = {
        ...process.env,
        NODE_ENV: 'production',
        DB_STRATEGY: 'local',
        LOCAL_DB_PATH,
        USER_SESSION_SECRET: process.env.USER_SESSION_SECRET || 'test_user_session_secret_for_quality_gate_only',
        ALLOW_LEGACY_USERID_BOOTSTRAP: 'false',
    };

    serverProcess = spawn(
        `npm run start -- -p ${TEST_PORT} --hostname 127.0.0.1`,
        {
            cwd: FRONTEND_DIR,
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: true,
        }
    );

    let bootstrapLogs = '';
    const appendLog = (chunk) => {
        bootstrapLogs += chunk.toString();
        if (bootstrapLogs.length > 4000) {
            bootstrapLogs = bootstrapLogs.slice(-4000);
        }
    };

    serverProcess.stdout?.on('data', appendLog);
    serverProcess.stderr?.on('data', appendLog);

    await new Promise((resolve, reject) => {
        const onExit = (code) => {
            reject(new Error(`next start exited early with code ${code}\n${bootstrapLogs}`));
        };
        serverProcess.once('exit', onExit);
        waitForServerReady()
            .then(() => {
                serverProcess?.removeListener('exit', onExit);
                resolve();
            })
            .catch((err) => {
                serverProcess?.removeListener('exit', onExit);
                reject(new Error(`${err.message}\n${bootstrapLogs}`));
            });
    });
}

async function stopServer() {
    if (!serverProcess) return;

    await new Promise((resolve) => {
        const proc = serverProcess;
        serverProcess = null;
        proc.once('exit', () => resolve());
        proc.kill('SIGTERM');
        setTimeout(() => {
            if (proc.exitCode === null) {
                proc.kill('SIGKILL');
            }
        }, 5000);
    });
}

function normalizeSetCookies(headers) {
    if (typeof headers.getSetCookie === 'function') {
        return headers.getSetCookie();
    }
    const single = headers.get('set-cookie');
    return single ? [single] : [];
}

class SessionClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.cookieJar = new Map();
    }

    get cookieHeader() {
        return Array.from(this.cookieJar.entries())
            .map(([key, value]) => `${key}=${value}`)
            .join('; ');
    }

    mergeSetCookie(headers) {
        const setCookies = normalizeSetCookies(headers);
        for (const raw of setCookies) {
            const firstSegment = raw.split(';')[0];
            const separator = firstSegment.indexOf('=');
            if (separator <= 0) continue;
            const name = firstSegment.slice(0, separator).trim();
            const value = firstSegment.slice(separator + 1).trim();
            if (!name) continue;
            this.cookieJar.set(name, value);
        }
    }

    async request(pathname, init = {}) {
        const headers = new Headers(init.headers || {});
        if (this.cookieJar.size > 0) {
            headers.set('cookie', this.cookieHeader);
        }

        const response = await withTimeout(
            fetch(`${this.baseUrl}${pathname}`, {
                ...init,
                headers,
                redirect: 'manual',
            }),
            ROUTE_TIMEOUT_MS,
            `Request timeout: ${pathname}`
        );

        this.mergeSetCookie(response.headers);
        return response;
    }
}

async function json(response) {
    const text = await response.text();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`Expected JSON response, got: ${text.slice(0, 200)}`);
    }
}

async function requestWithForwardedHost(pathname, forwardedHost, init = {}) {
    const headers = new Headers(init.headers || {});
    headers.set('x-forwarded-host', forwardedHost);
    return withTimeout(
        fetch(`${BASE_URL}${pathname}`, {
            ...init,
            headers,
            redirect: 'manual',
        }),
        ROUTE_TIMEOUT_MS,
        `Request timeout: ${pathname} [host=${forwardedHost}]`
    );
}

before(async () => {
    if (SHOULD_START_SERVER) {
        await startServer();
    }
});

after(async () => {
    if (SHOULD_START_SERVER) {
        await stopServer();
    }
});

describe('Auth Contract Gate', () => {
    const protectedCases = [
        { method: 'GET', path: '/api/brief?date=2026-02-01', expect: 401 },
        { method: 'GET', path: '/api/history?symbol=00700&offset=0&limit=3', expect: 401 },
        { method: 'GET', path: '/api/predictions?symbol=00700&limit=3', expect: 401 },
        { method: 'GET', path: '/api/stock/batch?symbols=00700,09988&historyLimit=3', expect: 401 },
        { method: 'GET', path: '/api/dashboard', expect: 401 },
        { method: 'POST', path: '/api/user/pay-success', body: { amount: 10, planId: 'monthly' }, expect: 401 },
    ];

    for (const testCase of protectedCases) {
        it(`rejects unauthenticated access: ${testCase.method} ${testCase.path}`, async () => {
            const init = { method: testCase.method };
            if (testCase.body) {
                init.headers = { 'content-type': 'application/json' };
                init.body = JSON.stringify(testCase.body);
            }
            const response = await withTimeout(
                fetch(`${BASE_URL}${testCase.path}`, init),
                ROUTE_TIMEOUT_MS,
                `Request timeout: ${testCase.path}`
            );
            assert.equal(response.status, testCase.expect);
        });
    }

    it('accepts authenticated session and serves protected routes', async () => {
        const client = new SessionClient(BASE_URL);

        const registerRes = await client.request('/api/user/register', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ registrationType: 'anonymous' }),
        });
        assert.equal(registerRes.status, 200);

        const registerBody = await json(registerRes);
        assert.equal(registerBody.success, true);
        assert.equal(typeof registerBody.userId, 'string');
        assert.ok(registerBody.userId.startsWith('user_'));
        assert.ok(client.cookieJar.has('stockwise_user_session'));

        const profileRes = await client.request('/api/user/profile', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ watchlist: ['00700', '09988'] }),
        });
        assert.equal(profileRes.status, 200);
        const profileBody = await json(profileRes);
        assert.equal(profileBody.userId, registerBody.userId);

        const authenticatedCases = [
            { method: 'GET', path: '/api/brief?date=2026-02-01', expect: 200 },
            { method: 'GET', path: '/api/history?symbol=00700&offset=0&limit=3', expect: 200 },
            { method: 'GET', path: '/api/predictions?symbol=00700&limit=3', expect: 200 },
            { method: 'GET', path: '/api/stock/batch?symbols=00700,09988&historyLimit=3', expect: 200 },
            { method: 'GET', path: '/api/dashboard', expect: 200 },
            { method: 'POST', path: '/api/user/pay-success', body: {}, expect: 400 },
        ];

        for (const testCase of authenticatedCases) {
            const init = { method: testCase.method };
            if (testCase.body !== undefined) {
                init.headers = { 'content-type': 'application/json' };
                init.body = JSON.stringify(testCase.body);
            }
            const response = await client.request(testCase.path, init);
            assert.equal(response.status, testCase.expect, `${testCase.method} ${testCase.path}`);
        }
    });
});

describe('Frontend Smoke Gate', () => {
    it('serves key pages without server errors', async () => {
        const client = new SessionClient(BASE_URL);
        await client.request('/api/user/register', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ registrationType: 'anonymous' }),
        });

        const pages = ['/', '/dashboard', '/dashboard/brief', '/pricing'];
        for (const page of pages) {
            const response = await client.request(page);
            assert.equal(response.status, 200, page);
            const contentType = response.headers.get('content-type') || '';
            assert.ok(contentType.includes('text/html'), `Expected HTML for ${page}`);
        }
    });
});

describe('Public i18n/SEO Gate', () => {
    it('keeps app subdomain protected from locale-prefixed public routes', async () => {
        const appRootRes = await requestWithForwardedHost('/?__mwdebug=1', 'app.ziso.cc');
        assert.equal(appRootRes.headers.get('x-ziso-mw-branch'), 'app-root-rewrite-dashboard');

        const appLocaleRes = await requestWithForwardedHost('/en?__mwdebug=1', 'app.ziso.cc');
        assert.equal(appLocaleRes.status, 307);
        assert.equal(appLocaleRes.headers.get('x-ziso-mw-branch'), 'app-strip-locale-prefix');
        assert.ok(appLocaleRes.headers.get('location')?.endsWith('/?__mwdebug=1'));
    });

    it('serves english public pages on the main domain root', async () => {
        const rootRes = await requestWithForwardedHost('/?__mwdebug=1', 'ziso.cc');
        assert.equal(rootRes.status, 200);
        assert.equal(rootRes.headers.get('x-ziso-mw-branch'), 'main-public-default-locale');
        const html = await rootRes.text();
        assert.ok(html.includes('AI does the research.'));
    });

    it('redirects marketing host /dashboard to app.ziso.cc (production split)', async () => {
        const res = await requestWithForwardedHost('/dashboard?keep=1', 'ziso.cc');
        assert.equal(res.status, 307);
        assert.equal(res.headers.get('x-ziso-mw-branch'), 'main-dashboard-redirect-app');
        const loc = res.headers.get('location');
        assert.ok(loc?.startsWith('https://app.ziso.cc/'), loc);
        assert.ok(loc?.includes('keep=1'), loc);
    });

    it('redirects old english prefix routes to root for SEO', async () => {
        const enAboutRes = await requestWithForwardedHost('/en/about?__mwdebug=1', 'ziso.cc');
        assert.equal(enAboutRes.status, 301);
        assert.equal(enAboutRes.headers.get('x-ziso-mw-branch'), 'main-redirect-en-to-root');
        assert.ok(enAboutRes.headers.get('location')?.endsWith('/about?__mwdebug=1'));
    });
    it('redirects old english content routes to the root english content', async () => {
        const res = await requestWithForwardedHost('/en/learn/101-64_eod_vs_intraday', 'ziso.cc');
        assert.equal(res.status, 308);
        assert.ok(res.headers.get('location')?.includes('/learn/101-64_eod_vs_intraday'));

        const supportRes = await requestWithForwardedHost('/en/support/tactical-brief-guide', 'ziso.cc');
        assert.equal(supportRes.status, 308);
        assert.ok(supportRes.headers.get('location')?.includes('/support/tactical-brief-guide'));
    });

    it('publishes only formal english static pages in the official sitemap', async () => {
        const sitemapRes = await withTimeout(
            fetch(`${BASE_URL}/sitemap.xml`),
            ROUTE_TIMEOUT_MS,
            'Request timeout: /sitemap.xml'
        );
        assert.equal(sitemapRes.status, 200);
        const body = await sitemapRes.text();
        assert.ok(body.includes('https://ziso.cc/'));
        assert.ok(body.includes('https://ziso.cc/about'));
        assert.ok(!body.includes('https://ziso.cc/en/'));
        assert.ok(body.includes('https://ziso.cc/learn'));
        assert.ok(!body.includes('https://ziso.cc/en/learn'));
        assert.ok(!body.includes('https://ziso.cc/en/support'));
        assert.ok(!body.includes('https://ziso.cc/status'));
    });
});

describe('Investment Mode Gate', () => {
    it('enforces free-tier default mode and summary boundary', async () => {
        const client = new SessionClient(BASE_URL);

        const registerRes = await client.request('/api/user/register', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ registrationType: 'anonymous' }),
        });
        assert.equal(registerRes.status, 200);

        const modeRes = await client.request('/api/user/mode');
        assert.equal(modeRes.status, 200);
        const modeBody = await json(modeRes);
        assert.equal(modeBody.mode_id, 'balanced_v1');
        assert.equal(modeBody.tier, 'free');
        assert.ok(Array.isArray(modeBody.allowed_modes));
        assert.equal(modeBody.allowed_modes.filter((item) => item.is_locked).length >= 1, true);

        const summaryRes = await client.request('/api/modes/performance?scope=universal&horizon=30d');
        assert.equal(summaryRes.status, 200);

        const forbiddenSummaryRes = await client.request('/api/modes/performance?scope=pool&horizon=30d');
        assert.equal(forbiddenSummaryRes.status, 403);

        const forbiddenSwitchRes = await client.request('/api/user/mode', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ mode_id: 'steady_v1' }),
        });
        assert.equal(forbiddenSwitchRes.status, 403);
    });
});

describe('PWA Baseline Gate', () => {
    it('serves manifest and service worker assets', async () => {
        const manifestRes = await withTimeout(
            fetch(`${BASE_URL}/manifest.json`),
            ROUTE_TIMEOUT_MS,
            'Request timeout: /manifest.json'
        );
        assert.equal(manifestRes.status, 200);
        const manifest = await manifestRes.json();
        assert.equal(typeof manifest.name, 'string');
        assert.equal(typeof manifest.short_name, 'string');
        assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);

        const swRes = await withTimeout(
            fetch(`${BASE_URL}/sw.js`),
            ROUTE_TIMEOUT_MS,
            'Request timeout: /sw.js'
        );
        assert.equal(swRes.status, 200);
        const swBody = await swRes.text();
        assert.ok(swBody.includes('self.addEventListener'));

        const offlineRes = await withTimeout(
            fetch(`${BASE_URL}/offline.html`),
            ROUTE_TIMEOUT_MS,
            'Request timeout: /offline.html'
        );
        assert.equal(offlineRes.status, 200);
    });
});
