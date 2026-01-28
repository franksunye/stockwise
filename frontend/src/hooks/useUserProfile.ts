'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCurrentUser } from '@/lib/user';
import { getWatchlist } from '@/lib/storage';

const PROFILE_CACHE_KEY = 'stockwise_user_profile_v1';

export type Tier = 'free' | 'pro';

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
}

export function useUserProfile() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // 1. 从缓存初始化
    useEffect(() => {
        const cached = localStorage.getItem(PROFILE_CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed && parsed.userId) {
                    setProfile(parsed);
                }
            } catch (e) {
                console.error('Failed to parse profile cache', e);
            }
        }
    }, []);

    // 2. 获取/刷新 Profile
    const refreshProfile = useCallback(async (options?: { watchlist?: string[], force?: boolean }) => {
        // 增加频率限制：30秒内不重复请求，除非 force 为 true
        const now = Date.now();
        const lastSync = parseInt(sessionStorage.getItem('last_profile_sync') || '0');
        if (!options?.force && now - lastSync < 30000 && profile) {
            return profile;
        }

        try {
            const user = await getCurrentUser();
            const watchlist = options?.watchlist || getWatchlist();
            const referredBy = localStorage.getItem('STOCKWISE_REFERRED_BY');

            const res = await fetch('/api/user/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.userId,
                    watchlist,
                    referredBy: referredBy
                })
            });

            if (res.ok) {
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
                    hasOnboarded: data.hasOnboarded
                };

                setProfile(newProfile);
                localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(newProfile));
                sessionStorage.setItem('last_profile_sync', now.toString());
                return newProfile;
            }
        } catch (e) {
            console.error('Refresh profile failed', e);
        } finally {
            setLoading(false);
        }
        return null;
    }, [profile]);

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
