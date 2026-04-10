import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const API_PATH = resolve(ROOT, 'src', 'app', 'api', 'user', 'onboarding', 'stocks', 'route.ts');
const OVERLAY_PATH = resolve(ROOT, 'src', 'components', 'onboarding', 'OnboardingOverlay.tsx');

describe('onboarding market awareness', () => {
  it('overlay should request localized onboarding stock recommendations', () => {
    const src = readFileSync(OVERLAY_PATH, 'utf-8');

    assert.ok(
      src.includes("fetch(`/api/user/onboarding/stocks?locale=${locale}`)"),
      'Onboarding overlay should pass locale to onboarding stock recommendations API.',
    );
  });

  it('API should prioritize US and HK markets for English users', () => {
    const src = readFileSync(API_PATH, 'utf-8');

    assert.ok(
      src.includes("{ market: 'US', target: 2 }"),
      'English onboarding recommendations should reserve US slots.',
    );
    assert.ok(
      src.includes("{ market: 'HK', target: 1 }"),
      'English onboarding recommendations should still reserve an HK slot.',
    );
    assert.ok(
      src.includes('const ONBOARDING_STOCK_LIMIT = 3;'),
      'Onboarding recommendations should be capped at three items.',
    );
    assert.ok(
      src.includes("{ symbol: 'AAPL', name: 'Apple', name_en: 'Apple Inc.', market: 'US' }"),
      'English fallback recommendations should include US names.',
    );
  });
});
