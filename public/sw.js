self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'New Message';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon.png',
    badge: '/badge.png',
    tag: data.tag || 'message',
    data: data.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});
