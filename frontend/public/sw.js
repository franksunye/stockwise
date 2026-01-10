// 未读通知计数器 - 使用 IndexedDB 持久化存储
const DB_NAME = 'stockwise-sw';
const STORE_NAME = 'badge';
const BADGE_KEY = 'unread_count';
const MAX_BADGE_COUNT = 99;

// 强制更新机制：当新 Service Worker 下载后，立即跳过等待
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 立即获取所有页面的控制权
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// 打开或创建 IndexedDB 数据库
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

// 获取当前徽章计数
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
  } catch (e) {
    return 0;
  }
}

// 设置徽章计数
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
  } catch (e) {
    // 忽略错误
  }
}

// 徽章显示的最大值（行业标准：iOS/微信等超过99显示99+，PWA API只支持数字所以显示99）
// MAX_BADGE_COUNT 已移至顶部

// 增加徽章计数并更新显示
async function incrementBadge() {
  const currentCount = await getBadgeCount();
  const newCount = currentCount + 1;
  await setBadgeCount(newCount);
  
  // 显示的数字不超过最大值
  const displayCount = Math.min(newCount, MAX_BADGE_COUNT);
  if (navigator.setAppBadge) {
    await navigator.setAppBadge(displayCount);
  }
  return newCount;
}

// 清除徽章
async function clearBadge() {
  await setBadgeCount(0);
  if (navigator.clearAppBadge) {
    await navigator.clearAppBadge();
  } else if (navigator.setAppBadge) {
    await navigator.setAppBadge(0);
  }
}

self.addEventListener('push', function(event) {
  if (event.data) {
    const payload = event.data.json();
    const title = payload.title || 'StockWise Notification';
    const options = {
      body: payload.body,
      icon: '/globe.svg',
      badge: '/globe.svg',
      tag: payload.tag, // 使用 tag 实现通知覆盖
      renotify: !!payload.tag, // 如果有 tag，重新提醒
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
      // 清除徽章
      clearBadge(),
      // 打开或聚焦窗口
      clients.matchAll({ type: 'window' }).then(windowClients => {
        // Check if there is already a window open with this URL
        for (var i = 0; i < windowClients.length; i++) {
          var client = windowClients[i];
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
    ])
  );
});

// 监听来自前端的消息
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'CLEAR_BADGE_COUNT') {
    event.waitUntil(clearBadge());
  }
});
