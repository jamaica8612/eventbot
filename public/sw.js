const CACHE_NAME = 'event-click-v4';
const APP_SHELL = [
  './manifest.webmanifest',
  './icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('event-click-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );

      await self.clients.claim();

      const scope = self.registration.scope;
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      await Promise.all(
        windows
          .filter((client) => client.url.startsWith(scope))
          .map(async (client) => {
            try {
              await client.navigate(client.url);
            } catch {
              // A window can close while the updated worker is activating.
            }
          }),
      );
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match('./index.html')),
    );
    return;
  }

  event.respondWith(fetchAndCache(event.request));
});

async function fetchAndCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match(request);
  }
}
