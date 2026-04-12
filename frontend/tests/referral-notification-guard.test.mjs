import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const COMPLETE_ROUTE_PATH = resolve(ROOT, 'src', 'app', 'api', 'user', 'onboarding', 'complete', 'route.ts');
const INTERNAL_NOTIFY_PATH = resolve(ROOT, 'src', 'app', 'api', 'internal', 'notify', 'route.ts');

describe('referral notification guard', () => {
  it('onboarding completion should localize referral reward notifications for English users', () => {
    const src = readFileSync(COMPLETE_ROUTE_PATH, 'utf-8');

    assert.ok(
      src.includes("function buildReferralRewardNotification(locale: unknown, rewardDays: number)") &&
      src.includes("if (appLocale === 'en')") &&
      src.includes("title: '🎁 Referral Reward Added'") &&
      src.includes('Your invited friend has completed signup.') &&
      src.includes('days of GO access have been added to your account.') &&
      src.includes('你邀请的好友已完成注册') &&
      src.includes('天 GO 会员已发放到你的账户。') &&
      src.includes('SELECT subscription_tier, subscription_expires_at, locale FROM users WHERE user_id = ?'),
      'Referral reward notifications should read the referrer locale and send English copy to English users.',
    );
  });

  it('onboarding completion should send referral notification in both DB branches', () => {
    const src = readFileSync(COMPLETE_ROUTE_PATH, 'utf-8');
    const matches = src.match(/Failed to send referral notification:/g) ?? [];

    assert.equal(
      matches.length,
      2,
      'Referral notification should be triggered in both cloud and local onboarding paths.',
    );
  });

  it('internal notify should still log explicit target notifications without push subscriptions', () => {
    const src = readFileSync(INTERNAL_NOTIFY_PATH, 'utf-8');

    assert.ok(
      src.includes('if (target_user_id) {') && src.includes('successfulUserIds.add(target_user_id);'),
      'Explicit target notifications should be logged even if push delivery has no active subscriptions.',
    );
  });

  it('internal notify should bypass user notification preferences for system referral rewards', () => {
    const src = readFileSync(INTERNAL_NOTIFY_PATH, 'utf-8');

    assert.ok(
      src.includes("const SYSTEM_NOTIFICATION_TAGS = new Set([") &&
      src.includes("'referral_reward'") &&
      src.includes('const shouldBypassUserPreferences = Boolean(tag && SYSTEM_NOTIFICATION_TAGS.has(tag));') &&
      src.includes('if (settingsJson && !shouldBypassUserPreferences) {'),
      'System referral reward notifications should ignore user notification preference filtering.',
    );
  });
});
