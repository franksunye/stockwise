'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getWatchlist } from '@/lib/storage';
import { getCurrentUser } from '@/lib/user';
import { MEMBERSHIP_CONFIG } from '@/lib/membership-config';
import { resolveReferralCode } from '@/lib/referral-resolver';
import { isIOS, isStandalone } from '@/lib/device-utils';
import { mapApiJsonToUserProfile } from '@/lib/map-user-profile';
import { LOCALE_COOKIE_KEY, resolveLocaleFromBrowserLanguage, inferLocaleFromToken } from '@/lib/i18n';
import {
    getOptimisticDashboardBootstrap as getOptimisticDashboardBootstrapState,
    markDashboardSplashSeen,
    readAuthCache,
    readBrowserBootstrapStorageState,
    writeAuthCache,
    writeProfileCache,
    readProfileCache,
    purgeLegacyUserProfileCache,
    getScopedProfileCacheKey,
    getStoredUserId,
} from '@/lib/dashboard-bootstrap';
import { writeCachedWatchlist } from '@/lib/watchlist-cache';
import type {
    Tier,
    UserProfile,
    UserProfileContextValue,
    RefreshProfileOptions,
} from '@/hooks/useUserProfile';

const PROFILE_SYNC_SESSION_KEY = 'last_profile_sync';
const PROFILE_SYNC_IN_FLIGHT_KEY = 'profile_sync_in_flight_v1';
const LOCALE_STORAGE_KEY = 'stockwise_locale';

function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() ?? null;
    return null;
}

function getExplicitLocaleFromUrl(): 'cn' | 'en' | null {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return inferLocaleFromToken(params.get('locale'));
}

function getPreferredLocaleForProfileSync(): 'cn' | 'en' {
    if (typeof window === 'undefined') return 'en';

    const explicitLocale = getExplicitLocaleFromUrl();
    if (explicitLocale) return explicitLocale;

    const stored = inferLocaleFromToken(localStorage.getItem(LOCALE_STORAGE_KEY));
    if (stored) return stored;

    const cookieLocale = inferLocaleFromToken(getCookie(LOCALE_COOKIE_KEY));
    if (cookieLocale) return cookieLocale;

    return resolveLocaleFromBrowserLanguage(navigator.language);
}

function coerceTierFromData(data: Record<string, unknown>): Tier {
    const t = String(data.tier || 'free').toLowerCase();
    if (t === 'go' || t === 'plus' || t === 'pro' || t === 'alpha') return t;
    return 'free';
}

function normalizeBootstrapWatchlist(data: Record<string, unknown>): Array<{
    symbol: string;
    name: string;
    name_en: string | null;
    addedAt: number;
}> {
    if (!Array.isArray(data.watchlist)) return [];

    return data.watchlist
        .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const row = item as Record<string, unknown>;
            const symbol = typeof row.symbol === 'string' ? row.symbol.trim() : '';
            if (!symbol) return null;
            const addedAt =
                typeof row.addedAt === 'string' || typeof row.addedAt === 'number'
                    ? new Date(row.addedAt).getTime()
                    : Date.now();
            return {
                symbol,
                name: typeof row.name === 'string' && row.name.trim() ? row.name : symbol,
                name_en: typeof row.name_en === 'string' ? row.name_en : null,
                addedAt: Number.isFinite(addedAt) ? addedAt : Date.now(),
            };
        })
        .filter((item): item is {
            symbol: string;
            name: string;
            name_en: string | null;
            addedAt: number;
        } => item !== null);
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
        const storedUserId = getStoredUserId();
        const cached = readProfileCache<UserProfile>(
            localStorage.getItem(getScopedProfileCacheKey(storedUserId)),
            storedUserId,
        );
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

    const fetchBootstrap = useCallback(async (
        body: {
            watchlist: string[];
            referredBy?: string | null;
            locale: 'cn' | 'en';
            explicitLocale: boolean;
        },
        init?: RequestInit,
    ) => {
        return fetch('/api/user/bootstrap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify(body),
            ...init,
        });
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

            const explicitLocaleFromUrl = getExplicitLocaleFromUrl();
            const locale = options?.locale ?? explicitLocaleFromUrl ?? getPreferredLocaleForProfileSync();
            const res = await fetch('/api/user/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store',
                body: JSON.stringify({
                    watchlist,
                    referredBy,
                    locale,
                    explicitLocale: Boolean(options?.locale) || Boolean(explicitLocaleFromUrl),
                }),
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
                    const watchlist = getWatchlist();
                    let res = await fetchBootstrap({
                        watchlist,
                        locale,
                        explicitLocale: false,
                    });
                    if (res.status === 401) {
                        await getCurrentUser({ forceSessionSync: true });
                        res = await fetchBootstrap({
                            watchlist,
                            locale,
                            explicitLocale: false,
                        });
                    }
                    if (res.ok) {
                        const data = (await res.json()) as Record<string, unknown>;
                        applyServerProfilePayload(data, true);
                        const watchlistItems = normalizeBootstrapWatchlist(data);
                        if (watchlistItems.length > 0 || Number(data.watchlistCount || 0) === 0) {
                            writeCachedWatchlist(watchlistItems);
                        }
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

                const explicitLocaleFromUrl = getExplicitLocaleFromUrl();
                const locale = explicitLocaleFromUrl ?? getPreferredLocaleForProfileSync();
                const watchlist = getWatchlist();
                let res = await fetchBootstrap({
                    watchlist,
                    referredBy,
                    locale,
                    explicitLocale: Boolean(explicitLocaleFromUrl),
                }, {
                    signal: controller.signal,
                });
                if (res.status === 401) {
                    await getCurrentUser({ forceSessionSync: true });
                    res = await fetchBootstrap({
                        watchlist,
                        referredBy,
                        locale,
                        explicitLocale: Boolean(explicitLocaleFromUrl),
                    }, {
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
                    writeCachedWatchlist(normalizeBootstrapWatchlist(data));
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
    }, [applyServerProfilePayload, fetchBootstrap]);

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
