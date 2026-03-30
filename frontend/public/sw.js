const CACHE_NAME = 'bgn-pwa-v1';
const OFFLINE_URL = '/offline.html';
const ASSETS_TO_CACHE = [OFFLINE_URL, '/', '/manifest.webmanifest'];

globalThis.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)),
  );
  globalThis.skipWaiting();
});

globalThis.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  globalThis.clients.claim();
});

globalThis.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((response) => {
          if (response?.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseClone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, responseClone))
            .catch(() => undefined);
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL));
    }),
  );
});

globalThis.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Board Game Night';
  const body = data.body || '';
  const url = data.url || data.eventUrl || '/';

  const options = {
    body,
    data: { url },
    icon: '/next.svg',
    badge: '/next.svg',
  };

  event.waitUntil(
    self.registration.showNotification(title, options),
  );
});

globalThis.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/';

  event.waitUntil(self.clients.openWindow(url));
});
