export type BootstrapTier = 'free' | 'pro';

const AUTH_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DASHBOARD_NAV_INTENT_MAX_AGE_MS = 15 * 1000;
const SPLASH_SESSION_TTL_MS = 120 * 1000;

export interface AuthCache {
    tier: BootstrapTier;
    authorized: boolean;
    timestamp: number;
}

export interface ProfileCache {
    userId?: string;
    tier?: string;
    hasOnboarded?: boolean;
    [key: string]: unknown;
}

export interface DashboardNavIntent {
    symbol?: string;
    timestamp: number;
}

export interface DashboardBootstrapStorageState {
    authCacheRaw?: string | null;
    profileCacheRaw?: string | null;
    hasOnboardedRaw?: string | null;
    navIntentRaw?: string | null;
    splashTsRaw?: string | null;
}

export interface SplashRuntimeState {
    hostname: string;
    pathname: string;
    userAgent: string;
    now?: number;
}

function parseJson<T>(raw: string | null | undefined): T | null {
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

export function readAuthCache(
    raw: string | null | undefined,
    now: number = Date.now()
): AuthCache | null {
    const cache = parseJson<AuthCache>(raw);
    if (!cache) return null;
    if (typeof cache.timestamp !== 'number') return null;
    if (now - cache.timestamp > AUTH_CACHE_MAX_AGE_MS) return null;
    if (cache.authorized !== true && cache.authorized !== false) return null;
    if (cache.tier !== 'free' && cache.tier !== 'pro') return null;
    return cache;
}

export function readProfileCache(raw: string | null | undefined): ProfileCache | null {
    const profile = parseJson<ProfileCache>(raw);
    if (!profile || typeof profile !== 'object') return null;
    return profile;
}

export function readDashboardNavIntent(
    raw: string | null | undefined,
    now: number = Date.now()
): DashboardNavIntent | null {
    const intent = parseJson<DashboardNavIntent>(raw);
    if (!intent || typeof intent.timestamp !== 'number') return null;
    if (now - intent.timestamp > DASHBOARD_NAV_INTENT_MAX_AGE_MS) return null;
    return {
        symbol: typeof intent.symbol === 'string' ? intent.symbol : undefined,
        timestamp: intent.timestamp,
    };
}

export function hasOnboardedFlag(raw: string | null | undefined): boolean {
    return raw === 'true';
}

export function shouldMarkDashboardBootReady(
    state: DashboardBootstrapStorageState,
    now: number = Date.now()
): boolean {
    const authCache = readAuthCache(state.authCacheRaw, now);
    const profile = readProfileCache(state.profileCacheRaw);
    const onboarded = hasOnboardedFlag(state.hasOnboardedRaw);

    const hasOnboardedProfile = !!(profile && profile.userId && profile.hasOnboarded !== false);
    const hasAuthorizedIdentity =
        !!(authCache && authCache.authorized === true) ||
        !!(profile && profile.userId);

    return (onboarded || hasOnboardedProfile) && hasAuthorizedIdentity;
}

export function getOptimisticDashboardBootstrap(
    state: DashboardBootstrapStorageState,
    now: number = Date.now()
): { authorized: boolean; tier: BootstrapTier } | null {
    const authCache = readAuthCache(state.authCacheRaw, now);
    if (authCache) {
        return {
            authorized: authCache.authorized,
            tier: authCache.tier,
        };
    }

    const profile = readProfileCache(state.profileCacheRaw);
    const onboarded = hasOnboardedFlag(state.hasOnboardedRaw);
    const hasRecentDashboardIntent = Boolean(readDashboardNavIntent(state.navIntentRaw, now));

    if (profile?.userId && (profile.hasOnboarded !== false || onboarded || hasRecentDashboardIntent)) {
        return {
            authorized: true,
            tier: profile.tier === 'pro' ? 'pro' : 'free',
        };
    }

    return null;
}

export function shouldOptimisticallyEnterDashboard(
    state: DashboardBootstrapStorageState,
    now: number = Date.now()
): boolean {
    const onboarded = hasOnboardedFlag(state.hasOnboardedRaw);
    const profile = readProfileCache(state.profileCacheRaw);
    const hasRecentDashboardIntent = Boolean(readDashboardNavIntent(state.navIntentRaw, now));

    return (
        onboarded ||
        Boolean(profile?.userId && (profile.hasOnboarded !== false || hasRecentDashboardIntent))
    );
}

export function shouldSuppressDashboardSplash(
    state: DashboardBootstrapStorageState,
    runtime: SplashRuntimeState
): boolean {
    const now = runtime.now ?? Date.now();
    const ua = runtime.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    const isMobile = isIOS || isAndroid;

    const host = runtime.hostname;
    const path = runtime.pathname;
    const isAppHost = host === 'app.ziso.cc' || host.indexOf('app.') === 0;
    const isDashboardRoute = path === '/dashboard' || path.indexOf('/dashboard/') === 0;
    const isLocalDev = host === 'localhost' || host === '127.0.0.1';

    const splashTs = parseInt(state.splashTsRaw || '0', 10);
    const isInSession =
        Number.isFinite(splashTs) && splashTs > 0
            ? now - splashTs < SPLASH_SESSION_TTL_MS
            : false;

    const shouldShowSplash =
        !isInSession &&
        isMobile &&
        (isDashboardRoute || (isAppHost && path === '/') || (isLocalDev && isDashboardRoute));

    return !shouldShowSplash;
}

export function readBrowserBootstrapStorageState(): DashboardBootstrapStorageState {
    if (typeof window === 'undefined') {
        return {};
    }

    return {
        authCacheRaw: window.localStorage.getItem('ZISO_AUTH_CACHE_V1'),
        profileCacheRaw: window.localStorage.getItem('stockwise_user_profile_v1'),
        hasOnboardedRaw: window.localStorage.getItem('STOCKWISE_HAS_ONBOARDED'),
        navIntentRaw: window.sessionStorage.getItem('stockwise_dashboard_nav_intent'),
        splashTsRaw: window.localStorage.getItem('stockwise_splash_ts'),
    };
}

export function getDashboardEntryHint(
    state: DashboardBootstrapStorageState,
    now: number = Date.now()
): {
    shouldMarkBootReady: boolean;
    canOptimisticallyEnter: boolean;
    optimisticBootstrap: { authorized: boolean; tier: BootstrapTier } | null;
} {
    return {
        shouldMarkBootReady: shouldMarkDashboardBootReady(state, now),
        canOptimisticallyEnter: shouldOptimisticallyEnterDashboard(state, now),
        optimisticBootstrap: getOptimisticDashboardBootstrap(state, now),
    };
}
