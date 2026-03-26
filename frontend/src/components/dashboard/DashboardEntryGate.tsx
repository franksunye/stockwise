'use client';

import { useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { OnboardingOverlay } from '@/components/onboarding/OnboardingOverlay';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import {
    getDashboardEntryHint,
    readBrowserBootstrapStorageState,
} from '@/lib/dashboard-bootstrap';

export function DashboardEntryGate({ children }: { children: ReactNode }) {
    const { profile, loading } = useUserProfile();
    const [canOptimisticallyEnter, setCanOptimisticallyEnter] = useState(false);

    useLayoutEffect(() => {
        setCanOptimisticallyEnter(
            getDashboardEntryHint(readBrowserBootstrapStorageState()).canOptimisticallyEnter
        );
    }, []);

    if (loading || !profile) {
        if (canOptimisticallyEnter) {
            return <>{children}</>;
        }

        return (
            <div data-dashboard-skeleton="true">
                <DashboardSkeleton />
            </div>
        );
    }

    if (!profile.hasOnboarded) {
        return <OnboardingOverlay />;
    }

    return <>{children}</>;
}
