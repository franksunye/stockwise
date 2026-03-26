'use client';

import type { ReactNode } from 'react';
import { DashboardAuthProvider } from '@/context/DashboardAuthContext';
import { StockProvider } from '@/context/StockContext';
import { UserProfileProvider, type Tier } from '@/hooks/useUserProfile';
import { DashboardEntryGate } from '@/components/dashboard/DashboardEntryGate';

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
                <StockProvider>
                    <DashboardEntryGate>{children}</DashboardEntryGate>
                </StockProvider>
            </UserProfileProvider>
        </DashboardAuthProvider>
    );
}
