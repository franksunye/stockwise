'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getWatchlist } from '@/lib/storage';
import { getCurrentUser } from '@/lib/user';
import { MEMBERSHIP_CONFIG } from '@/lib/membership-config';
import { resolveReferralCode } from '@/lib/referral-resolver';
import { isIOS, isStandalone } from '@/lib/device-utils';
import {
    getOptimisticDashboardBootstrap as getOptimisticDashboardBootstrapState,
    markDashboardSplashSeen,
    readAuthCache,
    readBrowserBootstrapStorageState,
    writeAuthCache,
    writeProfileCache,
} from '@/lib/dashboard-bootstrap';
import type { Tier } from '@/hooks/useUserProfile';

const PROFILE_SYNC_SESSION_KEY = 'last_profile_sync';
const PROFILE_SYNC_IN_FLIGHT_KEY = 'profile_sync_in_flight_v1';

interface ProfileApiData {
    userId?: string;
    tier?: string;
    expiresAt?: string | null;
    watchlistCount?: number;
    email?: string | null;
    referralBalance?: number;
    totalEarned?: number;
    commissionRate?: number;
    hasOnboarded?: boolean;
    hasStripeCustomer?: boolean;
    isChannel?: boolean;
    referralAlias?: string | null;
    referralCount?: number;
    recentTransactions?: unknown[];
}

function populateUserProfileCache(apiData: ProfileApiData): void {
    if (!apiData.userId) return;

    try {
        writeProfileCache({
            userId: apiData.userId,
            tier: apiData.tier || 'free',
            expiresAt: apiData.expiresAt ?? null,
            watchlistCount: apiData.watchlistCount,
            email: apiData.email,
            referralBalance: apiData.referralBalance,
            totalEarned: apiData.totalEarned,
            commissionRate: apiData.commissionRate,
            hasOnboarded: apiData.hasOnboarded,
            hasStripeCustomer: apiData.hasStripeCustomer,
            isChannel: apiData.isChannel,
            referralAlias: apiData.referralAlias,
            referralCount: apiData.referralCount,
            recentTransactions: apiData.recentTransactions,
        });
        sessionStorage.setItem(PROFILE_SYNC_SESSION_KEY, String(Date.now()));
    } catch {
        // non-critical
    }
}

export function useDashboardAuthorization() {
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
    const [tier, setTier] = useState<Tier>('free');
    const canSkipTransition = useRef(false);

    useLayoutEffect(() => {
        canSkipTransition.current = document.documentElement.classList.contains('dashboard-boot-ready');

        const optimisticBootstrap = getOptimisticDashboardBootstrapState(
            readBrowserBootstrapStorageState()
        );
        if (optimisticBootstrap) {
            setIsAuthorized(optimisticBootstrap.authorized);
            setTier(optimisticBootstrap.tier);
        }
    }, []);

    useEffect(() => {
        const cachedAuth = readAuthCache(readBrowserBootstrapStorageState().authCacheRaw);

        const checkAuth = async () => {
            const { switches } = MEMBERSHIP_CONFIG;
            const isReturningUser = !!cachedAuth?.authorized;

            let uid = '';
            if (isReturningUser) {
                uid = localStorage.getItem('STOCKWISE_USER_ID') || '';
                getCurrentUser().catch(e => console.warn('Background user sync:', e));
            } else {
                const currentUser = await getCurrentUser({ waitForSessionSync: false });
                uid = currentUser.userId;
            }

            if (!switches.requireInvite) {
                setIsAuthorized(true);
                writeAuthCache('free', true);
                try {
                    try {
                        sessionStorage.setItem(PROFILE_SYNC_IN_FLIGHT_KEY, '1');
                    } catch {
                        // ignore
                    }
                    let res = await fetch('/api/user/profile', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ watchlist: getWatchlist() }),
                    });
                    if (res.status === 401) {
                        await getCurrentUser({ forceSessionSync: true });
                        res = await fetch('/api/user/profile', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ watchlist: getWatchlist() }),
                        });
                    }
                    if (res.ok) {
                        const data = await res.json() as ProfileApiData;
                        const newTier = (data.tier || 'free') as Tier;
                        populateUserProfileCache(data);
                        setTier(newTier);
                        writeAuthCache(newTier, true);
                    }
                } catch (e) {
                    console.warn('Tier warmup failed (invite disabled mode):', e);
                } finally {
                    try {
                        sessionStorage.removeItem(PROFILE_SYNC_IN_FLIGHT_KEY);
                    } catch {
                        // ignore
                    }
                }
                return;
            }

            const hasOptimisticAuth = cachedAuth?.authorized === true;
            let referredBy: string | null = null;

            if (switches.enableReferralReward) {
                const urlParams = new URLSearchParams(window.location.search);
                let inviteCode = urlParams.get('invite');

                if (inviteCode) {
                    if (!inviteCode.startsWith('user_')) {
                        const resolveData = await resolveReferralCode(inviteCode);
                        if (resolveData?.success && resolveData.userId) {
                            inviteCode = resolveData.userId;
                        } else {
                            inviteCode = null;
                        }
                    }

                    if (inviteCode && inviteCode !== uid && inviteCode.startsWith('user_')) {
                        referredBy = inviteCode;
                        localStorage.setItem('STOCKWISE_REFERRED_BY', inviteCode);
                        if (!isIOS() || isStandalone()) {
                            window.history.replaceState({}, '', window.location.pathname);
                        }
                    }
                }

                if (!referredBy) {
                    referredBy = localStorage.getItem('STOCKWISE_REFERRED_BY');
                }
            }

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 20000);

                try {
                    sessionStorage.setItem(PROFILE_SYNC_IN_FLIGHT_KEY, '1');
                } catch {
                    // ignore
                }

                let res = await fetch('/api/user/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ watchlist: getWatchlist(), referredBy }),
                    signal: controller.signal,
                });
                if (res.status === 401) {
                    await getCurrentUser({ forceSessionSync: true });
                    res = await fetch('/api/user/profile', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ watchlist: getWatchlist(), referredBy }),
                        signal: controller.signal,
                    });
                }
                clearTimeout(timeoutId);
                const data = await res.json() as ProfileApiData;
                const newTier = (data.tier || 'free') as Tier;

                if (res.ok && data.userId) {
                    populateUserProfileCache(data);
                }
                setTier(newTier);

                const isUnauthorizedFreeUser = data.tier === 'free' && !data.hasOnboarded;
                if (!isUnauthorizedFreeUser) {
                    setIsAuthorized(true);
                    writeAuthCache(newTier, true);
                    localStorage.removeItem('STOCKWISE_REFERRED_BY');
                } else {
                    setIsAuthorized(false);
                    writeAuthCache(newTier, false);
                }
            } catch (e) {
                console.error('Auth verification failed or timed out', e);
                if (!hasOptimisticAuth) {
                    setIsAuthorized(false);
                }
            } finally {
                try {
                    sessionStorage.removeItem(PROFILE_SYNC_IN_FLIGHT_KEY);
                } catch {
                    // ignore
                }
            }
        };

        checkAuth();
    }, []);

    useEffect(() => {
        if (isAuthorized !== null) {
            const splash = document.getElementById('app-splash');
            if (splash) {
                splash.style.opacity = '0';
                splash.style.pointerEvents = 'none';
            }
            try {
                markDashboardSplashSeen();
            } catch {
                // non-critical
            }
        }
    }, [isAuthorized]);

    return {
        isAuthorized,
        setIsAuthorized,
        tier,
        setTier,
        canSkipTransition,
    };
}
