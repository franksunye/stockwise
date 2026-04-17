'use client';

import type { ReactNode } from 'react';
import { StockProvider } from '@/context/StockContext';
import { UserProfileProvider, useUserProfile, type UserProfileContextValue } from '@/hooks/useUserProfile';
import { LocaleProvider } from '@/context/LocaleContext';
import { AppEntryControllerProvider, type AppEntryControllerValue } from '@/components/dashboard/AppEntryControllerContext';
import { DashboardEntryGate } from '@/components/dashboard/DashboardEntryGate';
import { InstallGuide } from '@/components/InstallGuide';
import { AnalyticsTracker } from '@/components/analytics/AnalyticsTracker';
import { AppEntryTelemetry } from '@/components/analytics/AppEntryTelemetry';

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
    userSession,
    appEntryController,
    isAuthorized,
}: {
    children: ReactNode;
    userSession: UserProfileContextValue;
    appEntryController: AppEntryControllerValue;
    isAuthorized: boolean | null;
}) {
    return (
        <UserProfileProvider value={userSession}>
            <AppEntryControllerProvider value={appEntryController}>
                <AnalyticsTracker />
                <AppEntryTelemetry isAuthorized={isAuthorized} />
                <LocaleGate>
                    <InstallGuide />
                    <StockProvider>
                        <DashboardEntryGate>{children}</DashboardEntryGate>
                    </StockProvider>
                </LocaleGate>
            </AppEntryControllerProvider>
        </UserProfileProvider>
    );
}
