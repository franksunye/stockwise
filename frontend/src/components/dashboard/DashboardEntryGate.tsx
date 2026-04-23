'use client';

import type { ReactNode } from 'react';
import { OnboardingOverlay } from '@/components/onboarding/OnboardingOverlay';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { AppEntryLoading } from '@/components/dashboard/AppEntryLoading';
import { useAppEntryController } from '@/components/dashboard/AppEntryControllerContext';

export function DashboardEntryGate({ children }: { children: ReactNode }) {
    const { profile, loading } = useUserProfile();
    const {
        canOptimisticallyEnter,
        hasOptimisticOnboardingCompletion,
        loadingRoute,
    } = useAppEntryController();

    if (loading || !profile) {
        if (canOptimisticallyEnter) {
            return <>{children}</>;
        }

        return loadingRoute !== 'shell'
            ? <AppEntryLoading route={loadingRoute} />
            : (
                <div data-dashboard-skeleton="true">
                    <DashboardSkeleton />
                </div>
            );
    }

    if (!profile.hasOnboarded && !hasOptimisticOnboardingCompletion) {
        return <OnboardingOverlay />;
    }

    return <>{children}</>;
}
