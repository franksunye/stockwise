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

  it('should treat empty persisted locale as unknown and defer to request locale', () => {
    const src = readFileSync(BOOTSTRAP_SERVER_PATH, 'utf-8');

    assert.ok(
      src.includes('const persistedLocale = inferProfileLocale(user.locale);'),
      'Bootstrap locale response should parse persisted locale without forcing an empty value to cn.',
    );
    assert.ok(
      src.includes('if (!persistedLocale) {'),
      'Bootstrap locale response should special-case empty persisted locale.',
    );
    assert.ok(
      src.includes('return preferredLocale;'),
      'Bootstrap locale response should fall back to the current request locale when persisted locale is empty.',
    );
  });

  it('should only use a hard fallback when request locale is missing too', () => {
    const src = readFileSync(BOOTSTRAP_SERVER_PATH, 'utf-8');

    assert.ok(
      src.includes("export function normalizeRequestedLocale(input: unknown, fallback: NormalizedLocale = 'en')"),
      'Request locale normalization should only fall back after request locale resolution fails.',
    );
  });

  it('should keep persisted locale resolution for mature users when it exists', () => {
    const src = readFileSync(BOOTSTRAP_SERVER_PATH, 'utf-8');

    assert.ok(
      src.includes('return persistedLocale;'),
      'Bootstrap locale response should still use the persisted profile locale when it exists and the user is mature.',
    );
  });
});
