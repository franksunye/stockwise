'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getWatchlist } from '@/lib/storage';
import { getCurrentUser } from '@/lib/user';
import { MEMBERSHIP_CONFIG } from '@/lib/membership-config';
import { resolveReferralCode } from '@/lib/referral-resolver';
import { isIOS, isStandalone } from '@/lib/device-utils';
import { mapApiJsonToUserProfile } from '@/lib/map-user-profile';
import {
    getOptimisticDashboardBootstrap as getOptimisticDashboardBootstrapState,
    markDashboardSplashSeen,
    readAuthCache,
    readBrowserBootstrapStorageState,
    writeAuthCache,
    writeProfileCache,
    readProfileCache,
    purgeLegacyUserProfileCache,
    PROFILE_CACHE_KEY,
} from '@/lib/dashboard-bootstrap';
import type {
    Tier,
    UserProfile,
    UserProfileContextValue,
    RefreshProfileOptions,
} from '@/hooks/useUserProfile';

const PROFILE_SYNC_SESSION_KEY = 'last_profile_sync';
const PROFILE_SYNC_IN_FLIGHT_KEY = 'profile_sync_in_flight_v1';
const LOCALE_STORAGE_KEY = 'stockwise_locale';

function getPreferredLocaleForProfileSync(): 'cn' | 'en' {
    if (typeof window === 'undefined') return 'cn';
    const raw = (localStorage.getItem(LOCALE_STORAGE_KEY) || '').trim().toLowerCase();
    if (!raw) {
        const nav = (navigator.language || '').toLowerCase();
        if (nav.startsWith('zh')) return 'cn';
        return 'cn';
    }
    if (raw === 'cn' || raw === 'zh' || raw.startsWith('zh-')) return 'cn';
    return 'en';
}

function coerceTierFromData(data: Record<string, unknown>): Tier {
    const t = String(data.tier || 'free').toLowerCase();
    if (t === 'go' || t === 'plus' || t === 'pro' || t === 'alpha') return t;
    return 'free';
}

export function useDashboardAuthorization() {
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    /** Optimistic tier from auth cache when profile row not yet loaded. */
    const [bootstrapTier, setBootstrapTier] = useState<Tier>('free');
    const [profileLoading, setProfileLoading] = useState(true);

    const profileRef = useRef<UserProfile | null>(null);
    const canSkipTransition = useRef(false);

    useEffect(() => {
        profileRef.current = profile;
    }, [profile]);

    const applyServerProfilePayload = useCallback((data: Record<string, unknown> | null | undefined, resOk: boolean) => {
        if (!data) return;
        const mapped = mapApiJsonToUserProfile(data);
        setBootstrapTier(coerceTierFromData(data));
        if (resOk && mapped) {
            writeProfileCache(mapped);
            sessionStorage.setItem(PROFILE_SYNC_SESSION_KEY, String(Date.now()));
            setProfile(mapped);
        }
    }, []);

    useLayoutEffect(() => {
        canSkipTransition.current = document.documentElement.classList.contains('dashboard-boot-ready');

        purgeLegacyUserProfileCache();
        const cached = readProfileCache<UserProfile>(localStorage.getItem(PROFILE_CACHE_KEY));
        if (cached?.userId) {
            setProfile(cached);
            profileRef.current = cached;
            setBootstrapTier(cached.tier);
            setProfileLoading(false);
        }

        const optimisticBootstrap = getOptimisticDashboardBootstrapState(readBrowserBootstrapStorageState());
        if (optimisticBootstrap) {
            setIsAuthorized(optimisticBootstrap.authorized);
            setBootstrapTier(optimisticBootstrap.tier);
            if (cached?.userId && cached.tier !== optimisticBootstrap.tier) {
                const aligned = { ...cached, tier: optimisticBootstrap.tier };
                setProfile(aligned);
                profileRef.current = aligned;
                writeProfileCache(aligned);
            }
        }
    }, []);

    const refreshProfile = useCallback(async (options?: RefreshProfileOptions) => {
        const now = Date.now();
        const lastSync = parseInt(sessionStorage.getItem(PROFILE_SYNC_SESSION_KEY) || '0', 10);
        if (!options?.force && now - lastSync < 30000 && profileRef.current) {
            setProfileLoading(false);
            return profileRef.current;
        }

        if (!options?.force) {
            try {
                if (sessionStorage.getItem(PROFILE_SYNC_IN_FLIGHT_KEY) === '1') {
                    setProfileLoading(false);
                    return profileRef.current ?? null;
                }
            } catch {
                // ignore
            }
        }

        if (!profileRef.current) {
            setProfileLoading(true);
        }

        try {
            await getCurrentUser();
            const watchlist = options?.watchlist || getWatchlist();
            const referredBy = localStorage.getItem('STOCKWISE_REFERRED_BY');

            const locale = getPreferredLocaleForProfileSync();
            const res = await fetch('/api/user/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store',
                body: JSON.stringify({ watchlist, referredBy, locale }),
            });

            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                console.error('refreshProfile failed', errBody?.error || `status ${res.status}`);
                return null;
            }

            const data = (await res.json()) as Record<string, unknown>;
            applyServerProfilePayload(data, true);
            return mapApiJsonToUserProfile(data);
        } catch (e) {
            console.error('refreshProfile failed', e);
            return null;
        } finally {
            setProfileLoading(false);
        }
    }, [applyServerProfilePayload]);

    useEffect(() => {
        const cachedAuth = readAuthCache(readBrowserBootstrapStorageState().authCacheRaw);

        const checkAuth = async () => {
            const { switches } = MEMBERSHIP_CONFIG;
            const isReturningUser = !!cachedAuth?.authorized;

            let uid = '';
            if (isReturningUser) {
                uid = localStorage.getItem('STOCKWISE_USER_ID') || '';
                getCurrentUser().catch((e) => console.warn('Background user sync:', e));
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
                    const locale = getPreferredLocaleForProfileSync();
                    let res = await fetch('/api/user/profile', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ watchlist: getWatchlist(), locale }),
                    });
                    if (res.status === 401) {
                        await getCurrentUser({ forceSessionSync: true });
                        res = await fetch('/api/user/profile', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ watchlist: getWatchlist(), locale }),
                        });
                    }
                    if (res.ok) {
                        const data = (await res.json()) as Record<string, unknown>;
                        applyServerProfilePayload(data, true);
                        const mapped = mapApiJsonToUserProfile(data);
                        if (mapped) {
                            writeAuthCache(mapped.tier, true);
                        }
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
                setProfileLoading(false);
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

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);
            try {
                try {
                    sessionStorage.setItem(PROFILE_SYNC_IN_FLIGHT_KEY, '1');
                } catch {
                    // ignore
                }

                const locale = getPreferredLocaleForProfileSync();
                let res = await fetch('/api/user/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ watchlist: getWatchlist(), referredBy, locale }),
                    signal: controller.signal,
                });
                if (res.status === 401) {
                    await getCurrentUser({ forceSessionSync: true });
                    res = await fetch('/api/user/profile', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ watchlist: getWatchlist(), referredBy, locale }),
                        signal: controller.signal,
                    });
                }

                let data: Record<string, unknown> = {};
                try {
                    data = (await res.json()) as Record<string, unknown>;
                } catch {
                    /* ignore malformed body */
                }

                const newTier = coerceTierFromData(data);
                if (res.ok && data.userId) {
                    applyServerProfilePayload(data, true);
                } else {
                    applyServerProfilePayload(data, false);
                }

                const isUnauthorizedFreeUser = newTier === 'free' && data.hasOnboarded === false;
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
                clearTimeout(timeoutId);
                try {
                    sessionStorage.removeItem(PROFILE_SYNC_IN_FLIGHT_KEY);
                } catch {
                    // ignore
                }
                setProfileLoading(false);
            }
        };

        checkAuth();
    }, [applyServerProfilePayload]);

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

    const tier: Tier = profile?.tier ?? bootstrapTier;

    const userSession: UserProfileContextValue = useMemo(
        () => ({
            profile,
            tier,
            userId: profile?.userId ?? '',
            loading: profileLoading,
            refreshProfile,
        }),
        [profile, tier, profileLoading, refreshProfile],
    );

    return {
        isAuthorized,
        setIsAuthorized,
        refreshProfile,
        userSession,
        canSkipTransition,
    };
}
