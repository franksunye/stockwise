import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readSource(relativePath) {
    return fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
}

test('user-facing prediction routes do not override locale-scoped reasoning with producer outcome payloads', () => {
    const batchRoute = readSource('src/app/api/stock/batch/route.ts');
    const predictionsRoute = readSource('src/app/api/predictions/route.ts');
    const historyRoute = readSource('src/app/api/history/route.ts');

    assert.doesNotMatch(batchRoute, /COALESCE\(NULLIF\(pol\.reasoning_payload,\s*''\),\s*p\.ai_reasoning\)/);
    assert.doesNotMatch(predictionsRoute, /const BASE_REASONING_SQL = `COALESCE\(NULLIF\(pol\.reasoning_payload,\s*''\),\s*p\.ai_reasoning\)`;/);
    assert.doesNotMatch(historyRoute, /const BASE_REASONING_SQL = `COALESCE\(NULLIF\(pol\.reasoning_payload,\s*''\),\s*p\.ai_reasoning\)`;/);
});
