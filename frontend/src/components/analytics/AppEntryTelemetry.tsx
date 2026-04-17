'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAppEntryController } from '@/components/dashboard/AppEntryControllerContext';

function resolveRouteClass(
  isAuthorized: boolean | null,
  profileLoading: boolean,
  hasProfile: boolean,
  hasOnboarded: boolean,
  canOptimisticallyEnter: boolean,
  hasOptimisticOnboardingCompletion: boolean,
  loadingRoute: 'onboarding' | 'shell',
): 'entry_pending' | 'invite-onboarding' | 'authorized-dashboard' | 'invite-wall' {
  if (isAuthorized === false) {
    return 'invite-wall';
  }

  if (isAuthorized === true) {
    if (!profileLoading && hasProfile && !hasOnboarded && !hasOptimisticOnboardingCompletion) {
      return 'invite-onboarding';
    }
    return 'authorized-dashboard';
  }

  if (canOptimisticallyEnter) {
    return 'authorized-dashboard';
  }

  if (loadingRoute === 'onboarding') {
    return 'invite-onboarding';
  }

  return 'entry_pending';
}

export function AppEntryTelemetry({
  isAuthorized,
}: {
  isAuthorized: boolean | null;
}) {
  const { trackEvent } = useAnalytics();
  const { profile, loading } = useUserProfile();
  const {
    canOptimisticallyEnter,
    hasOptimisticOnboardingCompletion,
    loadingRoute,
  } = useAppEntryController();

  const startedAtRef = useRef<number | null>(null);
  const classificationTrackedRef = useRef(false);
  const loadingTrackedRef = useRef<string | null>(null);
  const onboardingPaintTrackedRef = useRef(false);
  const dashboardUsableTrackedRef = useRef(false);

  const routeClass = useMemo(
    () =>
      resolveRouteClass(
        isAuthorized,
        loading,
        Boolean(profile),
        Boolean(profile?.hasOnboarded),
        canOptimisticallyEnter,
        hasOptimisticOnboardingCompletion,
        loadingRoute,
      ),
    [
      isAuthorized,
      loading,
      profile,
      canOptimisticallyEnter,
      hasOptimisticOnboardingCompletion,
      loadingRoute,
    ],
  );

  useEffect(() => {
    if (startedAtRef.current !== null) return;
    startedAtRef.current = performance.now();
    trackEvent('entry_classification_started', {
      has_invite: new URLSearchParams(window.location.search).has('invite'),
      pathname: window.location.pathname,
    });
  }, [trackEvent]);

  useEffect(() => {
    if (routeClass === 'entry_pending') return;
    if (classificationTrackedRef.current) return;

    classificationTrackedRef.current = true;
    trackEvent('entry_classification_resolved', {
      route_class: routeClass,
      duration_ms: Math.round((performance.now() - (startedAtRef.current ?? performance.now())) * 10) / 10,
      has_profile: Boolean(profile),
      has_onboarded: Boolean(profile?.hasOnboarded),
      authorized_state:
        isAuthorized === null ? 'pending' : isAuthorized ? 'authorized' : 'blocked',
    });
  }, [routeClass, trackEvent, profile, isAuthorized]);

  useEffect(() => {
    const loadingKey =
      routeClass === 'entry_pending' ? `pending:${loadingRoute}` : `route:${routeClass}`;
    if (loadingTrackedRef.current === loadingKey) return;

    loadingTrackedRef.current = loadingKey;
    trackEvent('entry_route_loading_shown', {
      route_class: routeClass,
      loading_route: loadingRoute,
    });
  }, [routeClass, loadingRoute, trackEvent]);

  useEffect(() => {
    if (routeClass !== 'invite-onboarding') return;
    if (onboardingPaintTrackedRef.current) return;

    onboardingPaintTrackedRef.current = true;
    trackEvent('onboarding_first_meaningful_paint', {
      duration_ms: Math.round((performance.now() - (startedAtRef.current ?? performance.now())) * 10) / 10,
      loading_route: loadingRoute,
    });
  }, [routeClass, loadingRoute, trackEvent]);

  useEffect(() => {
    if (routeClass !== 'authorized-dashboard') return;
    if (loading) return;
    if (!profile && !canOptimisticallyEnter) return;
    if (dashboardUsableTrackedRef.current) return;

    dashboardUsableTrackedRef.current = true;
    trackEvent('dashboard_first_usable', {
      duration_ms: Math.round((performance.now() - (startedAtRef.current ?? performance.now())) * 10) / 10,
      used_optimistic_entry: canOptimisticallyEnter,
      has_profile: Boolean(profile),
    });
  }, [routeClass, loading, profile, canOptimisticallyEnter, trackEvent]);

  return null;
}
