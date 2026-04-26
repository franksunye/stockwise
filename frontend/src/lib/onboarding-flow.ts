export type OnboardingFlowVariant = 'A' | 'B';

export const ONBOARDING_FLOW_VARIANT_KEY = 'stockwise_onboarding_flow_variant';
export const ONBOARDING_REENTRY_KEY = 'stockwise_onboarding_reentry';
export const DEFAULT_ONBOARDING_FLOW_VARIANT: OnboardingFlowVariant = 'B';

export function normalizeOnboardingFlowVariant(value: unknown): OnboardingFlowVariant {
  return value === 'A' ? 'A' : DEFAULT_ONBOARDING_FLOW_VARIANT;
}

export function readOnboardingFlowVariant(): OnboardingFlowVariant {
  if (typeof window === 'undefined') return DEFAULT_ONBOARDING_FLOW_VARIANT;
  return normalizeOnboardingFlowVariant(window.localStorage.getItem(ONBOARDING_FLOW_VARIANT_KEY));
}

export function writeOnboardingFlowVariant(variant: OnboardingFlowVariant): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ONBOARDING_FLOW_VARIANT_KEY, variant);
}
