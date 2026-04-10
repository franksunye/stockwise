const AUTH_CACHE_KEY = 'ZISO_AUTH_CACHE_V1';
const PROFILE_CACHE_KEY = 'stockwise_user_profile_v2';
const HAS_ONBOARDED_KEY = 'STOCKWISE_HAS_ONBOARDED';
const SPLASH_TS_KEY = 'stockwise_splash_ts';

const AUTH_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SPLASH_SESSION_TTL_MS = 120 * 1000;

/**
 * Root-level bootstrap script used by app shell routes.
 * This module is intentionally decoupled from dashboard bootstrap helpers
 * so public marketing pages never import dashboard runtime patch code.
 */
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
        var profileCacheRaw = localStorage.getItem('${PROFILE_CACHE_KEY}');
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

