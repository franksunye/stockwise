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
