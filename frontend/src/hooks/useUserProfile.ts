'use client';

import {
    createElement,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import type { ReactNode } from 'react';
import { getCurrentUser } from '@/lib/user';
import { getWatchlist } from '@/lib/storage';

const PROFILE_CACHE_KEY = 'stockwise_user_profile_v1';

export type Tier = 'free' | 'pro';

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
    referralBalance?: number;
    totalEarned?: number;
    commissionRate?: number;
    hasOnboarded?: boolean;
    hasStripeCustomer?: boolean;
    // Referral & Channel
    isChannel?: boolean;
    referralAlias?: string | null;
    referralCount?: number;
    recentTransactions?: ReferralTransaction[];
}

type RefreshProfileOptions = {
    watchlist?: string[];
    force?: boolean;
};

type UserProfileContextValue = {
    profile: UserProfile | null;
    tier: Tier;
    userId: string;
    loading: boolean;
    refreshProfile: (options?: RefreshProfileOptions) => Promise<UserProfile | null>;
};

const UserProfileContext = createContext<UserProfileContextValue | undefined>(undefined);

function useUserProfileStore(): UserProfileContextValue {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const profileRef = useRef<UserProfile | null>(null);

    useEffect(() => {
        profileRef.current = profile;
    }, [profile]);

    // 1. 从缓存初始化
    useEffect(() => {
        const cached = localStorage.getItem(PROFILE_CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed && parsed.userId) {
                    setProfile(parsed);
                    profileRef.current = parsed;
                }
            } catch (e) {
                console.error('Failed to parse profile cache', e);
            }
        }
    }, []);

    // 2. 获取/刷新 Profile
    const refreshProfile = useCallback(async (options?: RefreshProfileOptions) => {
        // 增加频率限制：30秒内不重复请求，除非 force 为 true
        const now = Date.now();
        const lastSync = parseInt(sessionStorage.getItem('last_profile_sync') || '0');
        if (!options?.force && now - lastSync < 30000 && profileRef.current) {
            return profileRef.current;
        }

        setLoading(true);
        try {
            await getCurrentUser();
            const watchlist = options?.watchlist || getWatchlist();
            const referredBy = localStorage.getItem('STOCKWISE_REFERRED_BY');

            const res = await fetch('/api/user/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store',
                body: JSON.stringify({
                    watchlist,
                    referredBy: referredBy
                })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                console.error('Refresh profile failed', data?.error || `status ${res.status}`);
                return null;
            }

            const data = await res.json();
            const newProfile: UserProfile = {
                userId: data.userId,
                tier: data.tier || 'free',
                expiresAt: data.expiresAt,
                watchlistCount: data.watchlistCount,
                email: data.email,
                referralBalance: data.referralBalance,
                totalEarned: data.totalEarned,
                commissionRate: data.commissionRate,
                hasOnboarded: data.hasOnboarded,
                hasStripeCustomer: data.hasStripeCustomer,
                // Referral & Channel
                isChannel: data.isChannel,
                referralAlias: data.referralAlias,
                referralCount: data.referralCount,
                recentTransactions: data.recentTransactions,
            };

            setProfile(newProfile);
            profileRef.current = newProfile;
            localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(newProfile));
            sessionStorage.setItem('last_profile_sync', now.toString());
            return newProfile;
        } catch (e) {
            console.error('Refresh profile failed', e);
        } finally {
            setLoading(false);
        }
        return null;
    }, []);

    // 自动刷新
    useEffect(() => {
        refreshProfile();
    }, [refreshProfile]);

    return {
        profile,
        tier: profile?.tier || 'free',
        userId: profile?.userId || '',
        loading,
        refreshProfile
    };
}

export function UserProfileProvider({ children }: { children: ReactNode }) {
    const value = useUserProfileStore();
    return createElement(UserProfileContext.Provider, { value }, children);
}

export function useUserProfile() {
    const context = useContext(UserProfileContext);
    if (!context) {
        throw new Error('useUserProfile must be used within UserProfileProvider');
    }
    return context;
}
