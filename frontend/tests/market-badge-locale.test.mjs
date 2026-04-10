import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const MARKET_BADGE_PATH = resolve(ROOT, 'src', 'lib', 'market-badge.ts');
const ONBOARDING_PATH = resolve(ROOT, 'src', 'components', 'onboarding', 'OnboardingOverlay.tsx');

describe('market badge locale regression', () => {
  it('market badge helper must define English labels for HK and CN markets', () => {
    const src = readFileSync(MARKET_BADGE_PATH, 'utf-8');

    assert.ok(
      src.includes("locale: AppLocale = 'cn'"),
      'market-badge.ts should accept a locale parameter.',
    );
    assert.ok(
      src.includes("label: isEnglish ? 'HK'"),
      'HK badge should render an English label in en locale.',
    );
    assert.ok(
      src.includes("label: isEnglish ? (variant === 'full' ? 'A-Share' : 'A')"),
      'CN badge should render an English label in en locale.',
    );
  });

  it('onboarding overlay must pass locale into market badge resolution', () => {
    const src = readFileSync(ONBOARDING_PATH, 'utf-8');

    assert.ok(
      src.includes("getMarketBadge(item.market, 'full', locale)"),
      'OnboardingOverlay should pass locale to getMarketBadge so English users do not see Chinese labels.',
    );
  });
});
