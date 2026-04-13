export type BootstrapTier = 'free' | 'go' | 'plus' | 'pro' | 'alpha';

function normalizeBootstrapTier(raw: unknown): BootstrapTier {
    const tier = String(raw || 'free').toLowerCase();
    if (tier === 'go' || tier === 'plus' || tier === 'pro' || tier === 'alpha') return tier;
    return 'free';
}

export const AUTH_CACHE_KEY = 'ZISO_AUTH_CACHE_V1';
/** Bump when tier semantics change so stale localStorage cannot flash wrong entitlements (e.g. invite → go vs legacy pro cache). */
export const PROFILE_CACHE_KEY = 'stockwise_user_profile_v2';
export const DASHBOARD_CACHE_KEY = 'stockwise_dashboard_cache_v2';
/** Older key — never read by current code; removed on load/write so DevTools won’t show a “ghost” duplicate. */
export const LEGACY_PROFILE_CACHE_KEY = 'stockwise_user_profile_v1';
export const LEGACY_DASHBOARD_CACHE_PREFIX = 'stockwise_dashboard_cache_v1';
const USER_ID_STORAGE_KEY = 'STOCKWISE_USER_ID';

/** Remove deprecated profile key (stale tier / duplicate row in Application → Local Storage). */
export function purgeLegacyUserProfileCache(): void {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        window.localStorage.removeItem(LEGACY_PROFILE_CACHE_KEY);
    } catch {
        // ignore
    }
}

const LEGACY_PROFILE_WRITE_GUARD = '__stockwiseLegacyProfileV1SetItemGuard';

/**
 * Blocks any runtime `localStorage.setItem('stockwise_user_profile_v1', ...)`.
 * Current app only writes {@link PROFILE_CACHE_KEY}; v1 reappearing is almost always a stale chunk / other tab.
 * In development, logs a stack trace to locate the caller.
 */
export function installLegacyProfileCacheWriteGuard(): void {
    if (typeof window === 'undefined') {
        return;
    }
    const w = window as unknown as Window & Record<string, boolean>;
    if (w[LEGACY_PROFILE_WRITE_GUARD]) {
        return;
    }
    w[LEGACY_PROFILE_WRITE_GUARD] = true;

    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItemGuard(this: Storage, key: string, value: string) {
        if (key === LEGACY_PROFILE_CACHE_KEY) {
            if (process.env.NODE_ENV === 'development') {
                console.warn(
                    '[StockWise] Blocked write to deprecated',
                    LEGACY_PROFILE_CACHE_KEY,
                    '— app only uses',
                    PROFILE_CACHE_KEY + '.',
                    'Capture stack if debugging stale JS.',
                    new Error().stack,
                );
            }
            return;
        }
        if (typeof original === 'function') {
            return original.call(this, key, value);
        }
        return undefined;
    };
}
export const HAS_ONBOARDED_KEY = 'STOCKWISE_HAS_ONBOARDED';
export const DASHBOARD_NAV_INTENT_KEY = 'stockwise_dashboard_nav_intent';
export const SPLASH_TS_KEY = 'stockwise_splash_ts';

export const AUTH_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const DASHBOARD_NAV_INTENT_MAX_AGE_MS = 15 * 1000;
export const SPLASH_SESSION_TTL_MS = 120 * 1000;

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

export function getStoredUserId(): string | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const raw = window.localStorage.getItem(USER_ID_STORAGE_KEY);
    return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

export function getScopedProfileCacheKey(userId?: string | null): string {
    const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
    return normalizedUserId ? `${PROFILE_CACHE_KEY}_${normalizedUserId}` : PROFILE_CACHE_KEY;
}

export function getDashboardCacheStorageKey(
    userId: string | null | undefined,
    locale: string | null | undefined
): string {
    const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
    const normalizedLocale = String(locale || 'cn').trim().toLowerCase() === 'en' ? 'en' : 'cn';
    return normalizedUserId
        ? `${DASHBOARD_CACHE_KEY}_${normalizedUserId}_${normalizedLocale}`
        : `${DASHBOARD_CACHE_KEY}_${normalizedLocale}`;
}

export function clearDashboardCacheForUser(userId: string | null | undefined): void {
    if (typeof window === 'undefined') {
        return;
    }

    const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
    if (!normalizedUserId) {
        return;
    }

    for (const locale of ['cn', 'en']) {
        window.localStorage.removeItem(getDashboardCacheStorageKey(normalizedUserId, locale));
    }
}

export function purgeLegacyDashboardCache(): void {
    if (typeof window === 'undefined') {
        return;
    }

    const removals: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (typeof key === 'string' && key.startsWith(LEGACY_DASHBOARD_CACHE_PREFIX)) {
            removals.push(key);
        }
    }

    for (const key of removals) {
        window.localStorage.removeItem(key);
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
    if (!['free', 'go', 'plus', 'pro', 'alpha'].includes(String(cache.tier))) return null;
    return cache;
}

export function readProfileCache<T extends object = ProfileCache>(
    raw: string | null | undefined,
    expectedUserId?: string | null
): T | null {
    const profile = parseJson<T>(raw);
    if (!profile || typeof profile !== 'object') return null;
    if (expectedUserId) {
        const profileRecord = profile as Record<string, unknown>;
        if (profileRecord.userId !== expectedUserId) {
            return null;
        }
    }
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
            tier: normalizeBootstrapTier(profile.tier),
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
        authCacheRaw: window.localStorage.getItem(AUTH_CACHE_KEY),
        profileCacheRaw: window.localStorage.getItem(getScopedProfileCacheKey(getStoredUserId())),
        hasOnboardedRaw: window.localStorage.getItem(HAS_ONBOARDED_KEY),
        navIntentRaw: window.sessionStorage.getItem(DASHBOARD_NAV_INTENT_KEY),
        splashTsRaw: window.localStorage.getItem(SPLASH_TS_KEY),
    };
}

export function writeAuthCache(
    tier: BootstrapTier,
    authorized: boolean,
    now: number = Date.now()
): AuthCache | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const payload: AuthCache = { tier, authorized, timestamp: now };
    window.localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(payload));
    return payload;
}

export function clearAuthCache(): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.removeItem(AUTH_CACHE_KEY);
}

export function writeProfileCache<T extends { userId: string }>(profile: T): T | null {
    if (typeof window === 'undefined') {
        return null;
    }

    purgeLegacyUserProfileCache();
    window.localStorage.setItem(getScopedProfileCacheKey(profile.userId), JSON.stringify(profile));
    return profile;
}

export function markDashboardSplashSeen(now: number = Date.now()): string | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const timestamp = String(now);
    window.localStorage.setItem(SPLASH_TS_KEY, timestamp);
    return timestamp;
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

export function buildRootBootstrapInlineScript(): string {
    return `
      (function() {
        try {
          var ua = window.navigator.userAgent;
          var isIOS = /iPhone|iPad|iPod/i.test(ua);
          var isAndroid = /Android/i.test(ua);
          var isMobile = isIOS || isAndroid;
          var now = Date.now();
          var authCacheRaw = localStorage.getItem('${AUTH_CACHE_KEY}');
          var currentUserId = localStorage.getItem('${USER_ID_STORAGE_KEY}');
          var profileCacheKey = currentUserId ? '${PROFILE_CACHE_KEY}_' + currentUserId : '${PROFILE_CACHE_KEY}';
          var profileCacheRaw = localStorage.getItem(profileCacheKey);
          var hasOnboardedFlag = localStorage.getItem('${HAS_ONBOARDED_KEY}') === 'true';
          var authCache = null;
          var profileCache = null;

          try { authCache = authCacheRaw ? JSON.parse(authCacheRaw) : null; } catch (e) {}
          try { profileCache = profileCacheRaw ? JSON.parse(profileCacheRaw) : null; } catch (e) {}

          var hasValidAuthCache =
            !!(authCache &&
              typeof authCache.timestamp === 'number' &&
              now - authCache.timestamp <= ${AUTH_CACHE_MAX_AGE_MS} &&
              authCache.authorized === true);

          var canBypassDashboardSkeleton =
            (
              hasOnboardedFlag ||
              !!(profileCache && profileCache.userId && profileCache.hasOnboarded !== false)
            ) &&
            (
              hasValidAuthCache ||
              !!(profileCache && profileCache.userId)
            );

          if (isIOS) document.body.classList.add('is-ios');
          if (isAndroid) document.body.classList.add('is-android');
          if (isMobile) document.body.classList.add('is-mobile');
          if (canBypassDashboardSkeleton) {
            document.documentElement.classList.add('dashboard-boot-ready');
          }

          var splash = document.getElementById('app-splash');
          if (splash) {
            var host = window.location.hostname;
            var path = window.location.pathname;
            var isAppHost = host === 'app.ziso.cc' || host.indexOf('app.') === 0;
            var isDashboardRoute = path === '/dashboard' || path.indexOf('/dashboard/') === 0;
            var isLocalDev = host === 'localhost' || host === '127.0.0.1';

            var splashTs = parseInt(localStorage.getItem('${SPLASH_TS_KEY}') || '0', 10);
            var isInSession = Number.isFinite(splashTs) && splashTs > 0
              ? now - splashTs < ${SPLASH_SESSION_TTL_MS}
              : false;

            var shouldShowSplash =
              !isInSession &&
              isMobile &&
              (isDashboardRoute || (isAppHost && path === '/') || (isLocalDev && isDashboardRoute));

            if (!shouldShowSplash) {
              splash.style.opacity = '0';
              splash.style.pointerEvents = 'none';
            } else {
              setTimeout(function() {
                var s = document.getElementById('app-splash');
                if (s) { s.style.opacity = '0'; s.style.pointerEvents = 'none'; }
              }, 4000);
            }
          }
        } catch(e) {}
      })();
    `;
}
