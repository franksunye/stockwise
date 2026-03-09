// =============================================================================
// ZISO AI — Service Worker v5 (Industrial-Grade PWA — 秒开)
// =============================================================================
// Architecture:
//   - Install:  Pre-cache critical App Shell (offline.html, manifest, logo)
//   - Navigate: CacheFirst + Background Revalidate → instant cold-start (秒开)
//   - Static:   CacheFirst (with network fallback) for _next/static/*
//   - Assets:   CacheFirst for images/fonts/css/js, StaleWhileRevalidate
//   - API:      Always bypass (never cache API responses in SW)
//   - Push:     Preserve existing notification handling
// =============================================================================

const CACHE_VERSION = 'ziso-v9';

// Critical resources that MUST be available offline for the App Shell
const PRECACHE_URLS = [
  '/offline.html',
  '/manifest.json',
  '/logo.png',
];

// =============================================================================
// 1. INSTALL — Pre-cache App Shell
// =============================================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => {
        console.log('[SW] Pre-caching App Shell resources');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// =============================================================================
// 2. ACTIVATE — Clean old caches + claim clients immediately
// =============================================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => {
              console.log('[SW] Removing stale cache:', key);
              return caches.delete(key);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activated v5, claiming clients');
        return self.clients.claim();
      })
  );
});

// =============================================================================
// 3. FETCH — Strategy-based routing
// =============================================================================

// =============================================================================
// 2.5 HELPER — Fetch with Timeout
// =============================================================================
function fetchWithTimeout(request, timeoutMs = 4000) {
  if (!navigator.onLine) {
    return Promise.reject(new Error('Browser is offline'));
  }
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Network timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    
    fetch(request)
      .then((response) => {
        clearTimeout(timeoutId);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
  });
}

// Shared cache accessor (singleton pattern for performance)
let _cachePromise = null;
function getCache() {
  if (!_cachePromise) {
    _cachePromise = caches.open(CACHE_VERSION);
  }
  return _cachePromise;
}

/**
 * NavigationCacheFirst strategy (StaleWhileRevalidate for navigations):
 * 1. If cache has the page → return it INSTANTLY (秒开)
 * 2. Background: fetch from network and update cache for next visit
 * 3. If no cache → fall back to network (first visit / cache cleared)
 * 4. If both fail → return offline.html
 *
 * This is the single most critical optimization for PWA cold-start on iOS.
 * The cached HTML shell loads instantly, then React hydrates and uses its
 * own auth cache (localStorage) to render content without waiting for APIs.
 */
async function navigationCacheFirst(request, fallbackUrl) {
  const cache = await getCache();

  // 1. Try cache first — this is what makes "秒开" possible
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    // Background revalidate: update cache silently for next visit
    fetch(request)
      .then((freshResponse) => {
        // Only update if it's actually HTML (prevent RSC poisoning)
        const contentType = freshResponse.headers.get('Content-Type') || '';
        if (freshResponse.ok && contentType.includes('text/html')) {
          cache.put(request, freshResponse);
        }
      })
      .catch(() => { /* silent — user already has cached content */ });

    // VERIFICATION: If cache somehow contains RSC payload instead of HTML, bypass it
    const cachedType = cachedResponse.headers.get('Content-Type') || '';
    if (cachedType.includes('text/x-component')) {
      console.warn('[SW] Detected RSC payload in Navigation cache, skipping...');
    } else {
      return cachedResponse;
    }
  }

  // 2. No cache (first visit) → try network
  try {
    const networkResponse = await fetchWithTimeout(request, 8000);
    if (networkResponse.ok) {
      const contentType = networkResponse.headers.get('Content-Type') || '';
      if (contentType.includes('text/html')) {
        cache.put(request, networkResponse.clone());
      }
    }
    return networkResponse;
  } catch {
    // 3. Both failed → offline fallback
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw err;
  }
}

/**
 * RSC CacheFirst strategy (StaleWhileRevalidate for Next.js soft navigations):
 * This matches the "秒开本地内容，后台更新" strategy perfectly.
 * 1. Normalize URL to strip `_rsc` so we can match it consistently.
 * 2. If cached -> Return instantly (Client Router proceeds with old tree, no spinner).
 * 3. Background -> Fetch fresh RSC payload and update cache.
 */
async function rscCacheFirst(request) {
  const cache = await getCache();
  const url = new URL(request.url);
  // Remove _rsc param to consolidate cache keys for the same route
  url.searchParams.delete('_rsc');
  // KEY FIX: Append suffix to prevent collision with HTML pages sharing the same URL
  const cacheKey = url.toString() + '__RSC';

  // ignoreVary is critical because Next.js changes Next-Router-State-Tree etc.
  const cachedResponse = await cache.match(cacheKey, { ignoreVary: true });

  if (cachedResponse) {
    // Background update
    fetchWithTimeout(request, 8000)
      .then((networkResponse) => {
        const isRSC = networkResponse.headers.get('Content-Type')?.includes('text/x-component') || 
                      networkResponse.headers.get('X-NextJS-Data') ||
                      request.headers.has('RSC');
        if (networkResponse.ok && isRSC) {
          cache.put(cacheKey, networkResponse);
        }
      })
      .catch(() => { /* silent */ });
    
    // VERIFICATION: Ensure we are not returning HTML for an RSC request
    const contentType = cachedResponse.headers.get('Content-Type') || '';
    if (contentType.includes('text/html')) {
       console.warn('[SW] Detected HTML in RSC cache, skipping...');
    } else {
       return cachedResponse;
    }
  }

  // First visit cache miss
  try {
    const networkResponse = await fetchWithTimeout(request, 8000);
    if (networkResponse.ok) {
      // Only cache if it actually looks like an RSC response
      const isRSC = networkResponse.headers.get('Content-Type')?.includes('text/x-component') || 
                    networkResponse.headers.get('X-NextJS-Data');
      if (isRSC) {
        cache.put(cacheKey, networkResponse.clone());
      }
    }
    return networkResponse;
  } catch {
    // Return a 504 to force Next.js to hard-navigate, which will hit the App Shell
    return new Response('Offline or Timeout', { status: 504, statusText: 'Gateway Timeout' });
  }
}

/**
 * NetworkFirst strategy:
 * Try network, cache the response, fall back to cache, then to fallback.
 * Used for non-navigation dynamic content (e.g. _next/data/*.json).
 */
async function networkFirst(request, fallbackUrl, timeoutMs = 4000) {
  const cache = await getCache();
  try {
    const networkResponse = await fetchWithTimeout(request, timeoutMs);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw err;
  }
}

/**
 * CacheFirst strategy:
 * Try cache first (instant), fall back to network (and cache the result).
 * If both fail, return a synthetic error response instead of undefined.
 */
async function cacheFirst(request) {
  const cache = await getCache();

  // 1. Try cache
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    // Background revalidate for non-hashed assets (StaleWhileRevalidate behavior)
    // Next.js hashed assets (_next/static) don't need revalidation
    if (!request.url.includes('/_next/static/')) {
      fetch(request)
        .then((freshResponse) => {
          if (freshResponse.ok) {
            cache.put(request, freshResponse);
          }
        })
        .catch(() => { /* silent background update failure is OK */ });
    }
    return cachedResponse;
  }

  // 2. Cache miss → try network
  try {
    const networkResponse = await fetchWithTimeout(request, 8000);
    
    // VERSION MISMATCH PROTECTION:
    // If a request for a JS chunk returns 404, it means the build has updated.
    // We should NOT cache this error, and potentially let the client handle it.
    if (networkResponse.status === 404 && request.url.includes('/_next/static/')) {
        return networkResponse;
    }

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // 3. Both cache and network failed → return a proper error response
    // CRITICAL FIX: Previously returned `undefined` here, crashing the browser
    return new Response('Network error', {
      status: 408,
      statusText: 'Resource unavailable offline',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ─── RULE 0: Only handle http/https ───
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  // ─── RULE 1: Bypass ALL API requests (CRITICAL — never cache API) ───
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/api/')) {
    return; // Let browser handle natively
  }

  // ─── RULE 2: Only intercept GET requests ───
  if (request.method !== 'GET') return;

  // ─── RULE 2.5: Next.js App Router RSC/Data Requests (拦截软路由数据) ───
  // Using SWR (Stale-While-Revalidate) ensures instant soft-navigations.
  // This achieves "秒开本地内容，然后后台更新" for Next.js transitions.
  const isRSC = request.headers.has('RSC') || url.searchParams.has('_rsc');
  if (isRSC) {
    event.respondWith(rscCacheFirst(request));
    return;
  }

  // ─── RULE 3: Navigation — CacheFirst + Background Revalidate (秒开) ───
  if (request.mode === 'navigate') {
    // App subdomain entry routes must honor server-side redirects/rewrite/auth
    // and should not be served from stale cached HTML.
    const isAppHost = url.hostname === 'app.ziso.cc' || url.hostname.startsWith('app.');
    const isAppEntryPath =
      url.pathname === '/' ||
      url.pathname === '/dashboard' ||
      url.pathname.startsWith('/dashboard/');

    if (isAppHost && isAppEntryPath) {
      event.respondWith(networkFirst(request, '/offline.html', 8000));
      return;
    }

    event.respondWith(navigationCacheFirst(request, '/offline.html'));
    return;
  }

  // ─── RULE 4: Next.js hashed static assets — CacheFirst (immutable) ───
  // These files have content hashes in their names, so they are safe to
  // cache indefinitely. This is the single most impactful optimization
  // for PWA load speed — eliminates network latency for JS/CSS bundles.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // ─── RULE 5: Other static assets — CacheFirst with background revalidate ───
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // ─── RULE 6: Everything else — NetworkFirst (safe default) ───
  // This catches any non-API, non-static requests (e.g., _next/data/*.json)
  // Using NetworkFirst ensures we always get fresh data when online,
  // but can still serve cached pages when offline.
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(networkFirst(request, null));
    return;
  }

  // Unmatched requests: let the browser handle normally
});

// =============================================================================
// 4. SW UPDATE NOTIFICATION — Signal clients to refresh
// =============================================================================
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
// =============================================================================
// 5. PUSH & NOTIFICATION — 推送通知 + 角标 (小红点)
//
// 角标生命周期:
//   push 到达    → setAppBadge(1)    设置红点
//   通知被点击   → clearAppBadge()   清除红点 (用户响应)
//   通知被关闭   → clearAppBadge()   清除红点 (用户划掉)
//   打开 App     → clearAppBadge()   清除红点 (dashboard/page.tsx)
// =============================================================================
self.addEventListener('push', function(event) {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    console.warn('[SW] Invalid push payload, ignoring:', e);
    return;
  }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title || 'ZISO AI', {
        body: payload.body,
        icon: '/logo.png',
        badge: '/logo.png',
        data: { url: payload.url || '/dashboard' }
      }),
      navigator.setAppBadge
        ? navigator.setAppBadge(1).catch(() => {})
        : Promise.resolve()
    ])
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === event.notification.data.url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(event.notification.data.url);
    })
  );
});

// 用户从通知中心划掉通知时也清除角标
self.addEventListener('notificationclose', function() {
  if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
});
