const CONVEX_URL = self.location.origin.includes('localhost') 
  ? 'http://localhost:3000'
  : self.registration.scope;

let authToken = null;

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SET_AUTH_TOKEN') {
    authToken = event.data.token;
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    })
  );
  startPolling();
});

function startPolling() {
  setInterval(async () => {
    if (!authToken) return;

    try {
      const response = await fetch(`${CONVEX_URL}/api/channelNotifications/getUnnotifiedMessages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({}),
      });

      const messages = await response.json();
      
      if (messages && messages.length > 0) {
        for (const message of messages) {
          await self.registration.showNotification('New Message', {
            body: message.text.substring(0, 100),
            icon: '/icon.png',
            badge: '/badge.png',
            tag: `message-${message._id}`,
            data: { messageId: message._id, channelId: message.channelId },
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, 30000);
}

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
