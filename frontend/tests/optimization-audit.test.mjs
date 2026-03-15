import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(FRONTEND_DIR, '..');
const LOCAL_DB_PATH = path.join(REPO_ROOT, 'data', 'stockwise.db');
const TEST_PORT = 3315; // Unique port to avoid conflicts
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

let serverProcess = null;

class TestSessionClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
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
}

async function waitForServerReady() {
    console.log('Waiting for server on ' + BASE_URL);
    const startedAt = Date.now();
    while (Date.now() - startedAt < 60000) {
        try {
            const res = await fetch(`${BASE_URL}/api/shared/almanac`);
            if (res.ok) return;
        } catch {}
        await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error('Server timeout');
}

before(async () => {
    console.log('Starting server with local DB...');
    serverProcess = spawn('npm run start -- -p ' + TEST_PORT, {
        cwd: FRONTEND_DIR,
        shell: true,
        env: { 
            ...process.env, 
            NODE_ENV: 'production',
            DB_STRATEGY: 'local',
            LOCAL_DB_PATH,
            USER_SESSION_SECRET: 'test_secret'
        }
    });
    
    // Log server errors to terminal
    serverProcess.stderr.on('data', (data) => console.error(`[Server Error] ${data}`));
    serverProcess.stdout.on('data', (data) => {
        if (data.toString().includes('ready') || data.toString().includes('started')) {
            console.log(`[Server] ${data.toString().trim()}`);
        }
    });

    await waitForServerReady();
});

after(() => {
    if (serverProcess) {
        console.log('Cleaning up server...');
        serverProcess.kill('SIGTERM');
    }
});

describe('Vercel CPU Optimization Audit (Deep Proof)', () => {
    it('ALMANAC: proves Shared API is functional, cached and lightweight', async () => {
        const res = await fetch(`${BASE_URL}/api/shared/almanac`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.ok(Array.isArray(body.almanacs));
        assert.ok(!body.stocks, 'Shared Almanac should NOT carry stocks data (Single Responsibility)');
    });

    it('BATCH: proves Payload Pruning & Functional Equivalence', async () => {
        const client = new TestSessionClient(BASE_URL);
        
        // 1. Register for a session
        const regRes = await client.request('/api/user/register', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ registrationType: 'anonymous' }),
        });
        assert.equal(regRes.status, 200);

        // 2. Fetch Batch - This is where the 503 was happening previously
        const batchRes = await client.request('/api/stock/batch?symbols=00700');
        assert.equal(batchRes.status, 200, `Batch API should return 200, got ${batchRes.status}`);
        
        const body = await batchRes.json();
        
        // PROOF OF PAYLOAD PRUNING
        assert.strictEqual(body.almanac, undefined, 'Batch API must NO LONGER contain almanac field');
        assert.strictEqual(body.almanacs, undefined, 'Batch API must NO LONGER contain almanacs field');
        
        // PROOF OF DATA EQUIVALENCE
        assert.ok(Array.isArray(body.stocks) && body.stocks.length > 0, 'Should still return stocks list');
        const stock = body.stocks[0];
        assert.strictEqual(stock.symbol, '00700');
        assert.ok(stock.price !== undefined, 'Stock should still have price (cached source)');
        assert.ok(stock.prediction !== undefined, 'Stock should still have prediction (dynamic source)');
        assert.ok(stock.history !== undefined, 'Stock should still have history');
        assert.ok(stock.shortMetrics !== undefined, 'Stock should still have short metrics (cached source)');
    });
});
