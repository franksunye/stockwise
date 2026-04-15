const EN_V1_SUPPORT_SLUGS = [
  'deep-linking-usage',
  'four-states-semantics',
  'identity-restore-flow',
  'interaction-first',
  'nav-map-logic',
  'notification-preference',
  'onboarding-trial-rules',
  'push-debug',
  'privacy-pledge',
  'redeem-code-usage',
  'referral-rewards',
  'signal-flip-push',
  'smart-search',
  'stock-quota-limits',
  'tactical-brief-guide',
  'time-machine-feed',
  'tiers-explained',
  'value-of-failure',
  'verification-states',
  'web-push-setup',
] as const;

export function getV1SupportAllowlist(locale: string): readonly string[] | null {
  // International v1 currently serves a curated English support set only.
  if (locale === 'en') return EN_V1_SUPPORT_SLUGS;
  return null;
}

export function isSupportSlugAllowedForLocale(locale: string, slug: string): boolean {
  const allowlist = getV1SupportAllowlist(locale);
  if (!allowlist) return true;
  return allowlist.includes(slug as (typeof EN_V1_SUPPORT_SLUGS)[number]);
}
