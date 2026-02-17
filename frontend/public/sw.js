// =============================================================================
// ZISO AI — Service Worker (Production-Safe)
// =============================================================================

const CACHE_NAME = 'ziso-v3'; // Bump version to ziso-v3 to apply new optimizations and clear old cache

// 1. LIFECYCLE
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 2. FETCH HANDLING (The "Safety First" Approach)
let cachePromise = null;
function getCache() {
  if (!cachePromise) {
    cachePromise = caches.open(CACHE_NAME);
  }
  return cachePromise;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // RULE 0: Only handle http/https (ignore chrome-extension://, etc.)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  // RULE 1: Bypass for all API requests (CRITICAL)
  if (url.pathname.includes('/api/')) {
    return; // Let browser handle it normally
  }

  // RULE 2: Only intercept GET requests
  if (request.method !== 'GET') return;

  // RULE 3: Navigation - Network-first with grace
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // RULE 4: Static Assets (Cache-First with Background Sync)
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            getCache().then((cache) => cache.put(request, copy));
          }
          return response;
        }).catch(() => cached);
      })
    );
  }
});

// 3. PUSH & BADGE (保持原有逻辑)
self.addEventListener('push', function(event) {
  if (event.data) {
    const payload = event.data.json();
    event.waitUntil(
      self.registration.showNotification(payload.title || 'ZISO AI', {
        body: payload.body,
        icon: '/logo.png',
        badge: '/logo.png',
        data: { url: payload.url || '/dashboard' }
      })
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
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
