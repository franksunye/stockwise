import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestSessionClient, waitForServerReady } from './test-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(FRONTEND_DIR, '..');
const LOCAL_DB_PATH = path.join(REPO_ROOT, 'data', 'stockwise.db');
const TEST_PORT = 3316; 
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

async function profileApi(client, label, path, method = 'GET', body = null) {
  const startTime = Date.now();
  const res = await client.request(path, { method, body: body ? JSON.stringify(body) : undefined });
  const endTime = Date.now();
  
  if (!res.ok) {
    console.error(`❌ [${label}] Failed: ${res.status}`);
    return null;
  }
  
  const text = await res.text();
  const data = JSON.parse(text);
  const bytes = Buffer.byteLength(text, 'utf8');
  const kb = (bytes / 1024).toFixed(2);
  
  console.log(`\n📊 [${label}] Profile Result:`);
  console.log(`   - Weight: ${kb} KB (${bytes} bytes)`);
  console.log(`   - Latency: ${endTime - startTime}ms`);
  
  let sample = null;
  if (data.watchlist && data.watchlist.length > 0) sample = data.watchlist[0];
  if (data.stocks && data.stocks.length > 0) sample = data.stocks[0];
  if (data.predictions && data.predictions.length > 0) sample = data.predictions[0];
  if (data.prices && data.prices.length > 0) sample = data.prices[0];
  
  if (sample) {
    console.log(`   - Top Fields:`);
    const fields = Object.entries(sample).map(([k, v]) => {
      const size = Buffer.byteLength(JSON.stringify(v), 'utf8');
      return { k, size };
    }).sort((a, b) => b.size - a.size);
    
    fields.slice(0, 4).forEach(f => {
      console.log(`     * ${f.k.padEnd(20)}: ${f.size} bytes (${((f.size / bytes) * 100).toFixed(1)}% weight)`);
    });
  }
  
  return { label, bytes, kb };
}

async function run() {
  console.log('🚀 Phase 1: Payload Baseline Measurement (Audit Mode)');
  
  const server = spawn('npm run dev -- -p ' + TEST_PORT, {
    cwd: FRONTEND_DIR,
    shell: true,
    env: { ...process.env, NODE_ENV: 'development', DB_STRATEGY: 'local', LOCAL_DB_PATH, USER_SESSION_SECRET: 'prof_secret' }
  });

  try {
    await waitForServerReady(BASE_URL);
    const client = new TestSessionClient(BASE_URL);
    await client.init();

    await profileApi(client, 'Batch (1 symbol)', '/api/stock/batch?symbols=00700');
    await profileApi(client, 'Batch (5 symbols)', '/api/stock/batch?symbols=00700,09988,09618,03690,01810');
    await profileApi(client, 'Predictions (History)', '/api/predictions?symbol=00700&limit=30');
    await profileApi(client, 'Stock Detail (History)', '/api/stock?symbol=00700&history=30');

    console.log('\n✅ Phase 1 Data Captured.');
  } finally {
    server.kill();
  }
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
