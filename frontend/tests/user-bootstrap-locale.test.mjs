import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BOOTSTRAP_SERVER_PATH = resolve(ROOT, 'src', 'lib', 'user-bootstrap-server.ts');

describe('user bootstrap locale boundary', () => {
  it('should honor request locale for free users who have not onboarded yet', () => {
    const src = readFileSync(BOOTSTRAP_SERVER_PATH, 'utf-8');

    assert.ok(
      src.includes("if (!Boolean(user.has_onboarded) && tier === 'free')"),
      'Bootstrap locale response should special-case free users who have not onboarded yet.',
    );
    assert.ok(
      src.includes('return preferredLocale;'),
      'Bootstrap locale response should use the current request locale before onboarding completes.',
    );
  });

  it('should keep persisted locale resolution for mature users', () => {
    const src = readFileSync(BOOTSTRAP_SERVER_PATH, 'utf-8');

    assert.ok(
      src.includes('return normalizeProfileLocale(user.locale);'),
      'Bootstrap locale response should still fall back to the persisted profile locale outside the onboarding boundary.',
    );
  });
});
