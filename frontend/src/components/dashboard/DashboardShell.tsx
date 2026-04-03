'use client';

import type { ReactNode } from 'react';
import { StockProvider } from '@/context/StockContext';
import { UserProfileProvider, useUserProfile, type UserProfileContextValue } from '@/hooks/useUserProfile';
import { LocaleProvider } from '@/context/LocaleContext';
import { DashboardEntryGate } from '@/components/dashboard/DashboardEntryGate';

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
}: {
    children: ReactNode;
    userSession: UserProfileContextValue;
}) {
    return (
        <UserProfileProvider value={userSession}>
            <LocaleGate>
                <StockProvider>
                    <DashboardEntryGate>{children}</DashboardEntryGate>
                </StockProvider>
            </LocaleGate>
        </UserProfileProvider>
    );
}
