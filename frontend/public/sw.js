const CACHE_NAME = 'bgn-pwa-v3';
const OFFLINE_URL = '/offline.html';
const ASSETS_TO_CACHE = [
  OFFLINE_URL,
  '/',
  '/manifest.webmanifest',
  '/meeple-photo-full.png',
  '/meeple-photo-full-192.png',
  '/meeple-photo-full-64.png',
];
const STATIC_PATH_PREFIXES = ['/static/', '/_next/static/'];

function isStaticCacheableRequest(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.origin !== globalThis.location.origin) return false;

  // Never cache API responses. They are user/session scoped and quickly stale.
  if (url.pathname.startsWith('/api/')) return false;

  if (ASSETS_TO_CACHE.includes(url.pathname)) return true;
  return STATIC_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

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

  if (!isStaticCacheableRequest(request)) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((response) => {
          if (response?.status === 200 && response.type === 'basic') {
            const responseClone = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, responseClone))
              .catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL));
    }),
  );
});

globalThis.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'What2Play';
  const body = data.body || '';
  const url = data.url || data.eventUrl || '/';

  const options = {
    body,
    data: { url },
    icon: '/meeple-photo-full.png',
    badge: '/meeple-photo-full-64.png',
  };

  event.waitUntil(
    globalThis.registration.showNotification(title, options),
  );
});

globalThis.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/';

  event.waitUntil(globalThis.clients.openWindow(url));
});
