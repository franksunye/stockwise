'use client';

import type { ReactNode } from 'react';
import { DashboardAuthProvider } from '@/context/DashboardAuthContext';
import { StockProvider } from '@/context/StockContext';
import { UserProfileProvider, useUserProfile, type Tier } from '@/hooks/useUserProfile';
import { LocaleProvider } from '@/context/LocaleContext';
import { DashboardEntryGate } from '@/components/dashboard/DashboardEntryGate';

/**
 * Bridge component: reads profile locale from UserProfileProvider
 * and passes it down to LocaleProvider. This avoids circular deps
 * between the two providers.
 */
function LocaleGate({ children }: { children: ReactNode }) {
    const { profile } = useUserProfile();
    return (
        <LocaleProvider profileLocale={profile?.locale}>
            {children}
        </LocaleProvider>
    );
}

export function DashboardShell({
    children,
    tier,
}: {
    children: ReactNode;
    tier: Tier;
}) {
    return (
        <DashboardAuthProvider tier={tier}>
            <UserProfileProvider>
                <LocaleGate>
                    <StockProvider>
                        <DashboardEntryGate>{children}</DashboardEntryGate>
                    </StockProvider>
                </LocaleGate>
            </UserProfileProvider>
        </DashboardAuthProvider>
    );
}
