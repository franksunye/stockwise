
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
        navigator.setAppBadge ? navigator.setAppBadge(1) : Promise.resolve()
      ])
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
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
  );
});
