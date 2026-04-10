import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const COMPLETE_ROUTE_PATH = resolve(ROOT, 'src', 'app', 'api', 'user', 'onboarding', 'complete', 'route.ts');
const OVERLAY_PATH = resolve(ROOT, 'src', 'components', 'onboarding', 'OnboardingOverlay.tsx');

describe('onboarding re-grant guard', () => {
  it('completion route should skip onboarding trial re-grants when access history already exists', () => {
    const src = readFileSync(COMPLETE_ROUTE_PATH, 'utf-8');

    assert.ok(
      src.includes("const hasAccessHistory = Boolean(user.subscription_expires_at) || currentTier !== 'free';"),
      'Onboarding completion should detect prior access history.',
    );
    assert.ok(
      src.includes('has prior access history, skipping onboarding trial re-grant.'),
      'Onboarding completion should explicitly skip duplicate trial grants.',
    );
  });

  it('completion route should avoid duplicate referral rewards after onboarding reset', () => {
    const src = readFileSync(COMPLETE_ROUTE_PATH, 'utf-8');

    assert.ok(
      src.includes("SELECT 1 FROM referral_transactions WHERE referred_id = ? AND type = 'reward' LIMIT 1"),
      'Onboarding completion should check existing referral rewards before granting again.',
    );
  });

  it('step 4 should not always advertise a fresh onboarding trial', () => {
    const src = readFileSync(OVERLAY_PATH, 'utf-8');

    assert.ok(
      src.includes('const willGrantOnboardingTrial = Boolean('),
      'Onboarding overlay should distinguish fresh trial grants from replayed onboarding.',
    );
    assert.ok(
      src.includes("t('complete.workspaceTitle')"),
      'Onboarding overlay should support a non-trial completion state.',
    );
  });
});
