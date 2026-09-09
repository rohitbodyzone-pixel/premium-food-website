// PropertyTalk Service Worker for Web Push Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || 'PropertyTalk Notification';
    const options = {
      body: payload.body || 'You have a new update in PropertyTalk.',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: payload.type || 'propertytalk-notification',
      data: payload.data || {},
      requireInteraction: payload.priority === 'URGENT' || payload.type === 'INCOMING_CALL' || payload.type === 'CHAT_REQUEST',
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('PropertyTalk', {
        body: text || 'You have a new update.',
        icon: '/favicon.ico',
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Safely validate destination URL to prevent open redirect vulnerabilities
  let targetUrl = '/';
  const rawUrl = event.notification.data?.url;
  if (typeof rawUrl === 'string') {
    // Only allow safe relative paths starting with single '/'
    if (rawUrl.startsWith('/') && !rawUrl.startsWith('//') && !rawUrl.includes('\\')) {
      targetUrl = rawUrl;
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (targetUrl !== '/' && 'navigate' in client) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      // Otherwise open new window with safe target URL
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
