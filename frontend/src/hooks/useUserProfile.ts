'use client';

import { createElement, createContext, useContext } from 'react';
import type { ReactNode } from 'react';

export type Tier = 'free' | 'go' | 'plus' | 'pro' | 'alpha';

export interface ReferralTransaction {
    type: string;
    amount: number;
    status: string;
    created_at: string;
    note: string | null;
}

export interface UserProfile {
    userId: string;
    tier: Tier;
    expiresAt: string | null;
    watchlistCount?: number;
    email?: string | null;
    locale?: string | null;
    referralBalance?: number;
    totalEarned?: number;
    commissionRate?: number;
    hasOnboarded?: boolean;
    hasStripeCustomer?: boolean;
    isChannel?: boolean;
    referralAlias?: string | null;
    referralCount?: number;
    recentTransactions?: ReferralTransaction[];
}

export type RefreshProfileOptions = {
    watchlist?: string[];
    force?: boolean;
    locale?: 'cn' | 'en';
};

export type UserProfileContextValue = {
    profile: UserProfile | null;
    tier: Tier;
    userId: string;
    loading: boolean;
    refreshProfile: (options?: RefreshProfileOptions) => Promise<UserProfile | null>;
};

const UserProfileContext = createContext<UserProfileContextValue | undefined>(undefined);

/**
 * Dashboard-only: value is owned by `useDashboardAuthorization` (single /api/user/profile source).
 */
export function UserProfileProvider({
    children,
    value,
}: {
    children: ReactNode;
    value: UserProfileContextValue;
}) {
    return createElement(UserProfileContext.Provider, { value }, children);
}

export function useUserProfile() {
    const context = useContext(UserProfileContext);
    if (!context) {
        throw new Error('useUserProfile must be used within UserProfileProvider');
    }
    return context;
}
