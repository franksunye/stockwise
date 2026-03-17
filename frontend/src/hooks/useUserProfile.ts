'use client';

import {
    createElement,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import type { ReactNode } from 'react';
import { getCurrentUser } from '@/lib/user';
import { getWatchlist } from '@/lib/storage';

const PROFILE_CACHE_KEY = 'stockwise_user_profile_v1';
const PROFILE_SYNC_SESSION_KEY = 'last_profile_sync';
const PROFILE_SYNC_IN_FLIGHT_KEY = 'profile_sync_in_flight_v1';

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

    // 1. 从缓存初始化 — 关键：命中缓存时立即标记 loading=false
    //    这使得 DashboardEntryGate 不会再显示第二层骨架屏
    useLayoutEffect(() => {
        const cached = localStorage.getItem(PROFILE_CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed && parsed.userId) {
                    setProfile(parsed);
                    profileRef.current = parsed;
                    setLoading(false); // P0 核心修复：缓存命中 → 立即可渲染
                }
            } catch (e) {
                console.error('Failed to parse profile cache', e);
            }
        }
    }, []);

    // 2. 获取/刷新 Profile
    const refreshProfile = useCallback(async (options?: RefreshProfileOptions) => {
        // 如果 Layout 正在进行首轮 profile 同步，Provider 让位，避免重复请求
        if (!options?.force) {
            try {
                const inFlight = sessionStorage.getItem(PROFILE_SYNC_IN_FLIGHT_KEY);
                if (inFlight === '1') {
                    setLoading(false);
                    return profileRef.current ?? null;
                }
            } catch {
                // 非关键路径，忽略存储异常
            }
        }

        // 增加频率限制：30秒内不重复请求，除非 force 为 true
        const now = Date.now();
        const lastSync = parseInt(sessionStorage.getItem(PROFILE_SYNC_SESSION_KEY) || '0');
        if (!options?.force && now - lastSync < 30000 && profileRef.current) {
            setLoading(false); // 确保防抖跳过时也标记已完成
            return profileRef.current;
        }

        // P0 核心修复：只有在没有任何缓存数据时才显示 loading
        // 有缓存时做“静默刷新”，用户看到的始终是已有内容
        if (!profileRef.current) {
            setLoading(true);
        }
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
            sessionStorage.setItem(PROFILE_SYNC_SESSION_KEY, now.toString());
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
