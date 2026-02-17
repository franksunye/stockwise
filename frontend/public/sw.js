// =============================================================================
// ZISO AI — Service Worker (Production)
// =============================================================================
// Responsibilities:
// 1. App Shell Caching  — Cache core assets for fast repeat loads & offline shell
// 2. Push Notifications — Receive & display push messages
// 3. Badge Management   — Track unread count via IndexedDB
// 4. Fetch Handling      — Network-first with cache fallback (required for Android WebAPK)
// =============================================================================

const CACHE_NAME = 'ziso-v1';

// App Shell: critical assets cached on install for instant load & offline shell
const APP_SHELL_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.png',
  '/offline.html',
];

// ---------------------------------------------------------------------------
// 1. LIFECYCLE EVENTS
// ---------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
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

// ---------------------------------------------------------------------------
// 2. FETCH HANDLING (Network-first, cache fallback)
//    This `fetch` listener is REQUIRED for Android Chrome to recognize the app
//    as installable and generate a WebAPK (true native app experience).
// ---------------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests — skip POST, API calls, etc.
  if (request.method !== 'GET') return;

  // Skip non-http(s) requests (e.g. chrome-extension://)
  if (!request.url.startsWith('http')) return;

  // For navigation requests (HTML pages): network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigation responses for shell
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline: try cache first, then offline page
          return caches.match(request).then((cached) => {
            return cached || caches.match('/offline.html');
          });
        })
    );
    return;
  }

  // For static assets (JS, CSS, images): stale-while-revalidate
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // All other requests: transparent pass-through (no interception)
});


// ---------------------------------------------------------------------------
// 3. PUSH NOTIFICATIONS
// ---------------------------------------------------------------------------

self.addEventListener('push', function(event) {
  if (event.data) {
    const payload = event.data.json();
    const title = payload.title || 'ZISO AI';
    const options = {
      body: payload.body,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: payload.tag,
      renotify: !!payload.tag,
      data: {
        url: payload.url || '/dashboard'
      }
    };
    event.waitUntil(
      Promise.all([
        self.registration.showNotification(title, options),
        incrementBadge()
      ])
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    Promise.all([
      clearBadge(),
      clients.matchAll({ type: 'window' }).then(windowClients => {
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
    ])
  );
});


// ---------------------------------------------------------------------------
// 4. BADGE MANAGEMENT (IndexedDB-backed)
// ---------------------------------------------------------------------------

const DB_NAME = 'stockwise-sw';
const STORE_NAME = 'badge';
const BADGE_KEY = 'unread_count';
const MAX_BADGE_COUNT = 99;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function getBadgeCount() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(BADGE_KEY);
      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

async function setBadgeCount(count) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(count, BADGE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Silently ignore
  }
}

async function incrementBadge() {
  const currentCount = await getBadgeCount();
  const newCount = currentCount + 1;
  await setBadgeCount(newCount);
  const displayCount = Math.min(newCount, MAX_BADGE_COUNT);
  if (navigator.setAppBadge) {
    await navigator.setAppBadge(displayCount);
  }
  return newCount;
}

async function clearBadge() {
  await setBadgeCount(0);
  if (navigator.clearAppBadge) {
    await navigator.clearAppBadge();
  } else if (navigator.setAppBadge) {
    await navigator.setAppBadge(0);
  }
}

// ---------------------------------------------------------------------------
// 5. MESSAGE HANDLING (from frontend)
// ---------------------------------------------------------------------------

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'CLEAR_BADGE_COUNT') {
    event.waitUntil(clearBadge());
  }
});
