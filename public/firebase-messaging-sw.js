importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDkZQ-sp3W8qwCXfadZRsGbEnUezQlInFs",
  authDomain: "mama-alumin.firebaseapp.com",
  projectId: "mama-alumin",
  storageBucket: "mama-alumin.firebasestorage.app",
  messagingSenderId: "396635962310",
  appId: "1:396635962310:web:ae5ba06ec3c60f6ade90c7"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  
  const title = payload.notification?.title || payload.data?.title || 'MAMAS Notification';
  const body = payload.notification?.body || payload.data?.body || '';
  const targetUrl = payload.data?.targetUrl || payload.data?.click_action || '/dashboard';

  const options = {
    body: body,
    icon: '/logo.png',
    badge: '/logo.png',
    data: {
      url: targetUrl
    },
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'View Details' }
    ]
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
