import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/lib/brief-dates.ts')).href;
const { getBriefDateCandidates } = await import(moduleUrl);

describe('brief date helpers', () => {
    it('returns both today and last trading day when they differ', () => {
        const candidates = getBriefDateCandidates(
            new Date('2026-03-30T08:00:00.000Z'),
            new Date('2026-03-27T08:00:00.000Z')
        );

        assert.deepEqual(candidates, ['2026-03-30', '2026-03-27']);
    });

    it('deduplicates the fallback date when today is already the last trading day', () => {
        const candidates = getBriefDateCandidates(
            new Date('2026-03-27T08:00:00.000Z'),
            new Date('2026-03-27T08:00:00.000Z')
        );

        assert.deepEqual(candidates, ['2026-03-27']);
    });
});
