const CACHE_NAME = 'eventbot-v2-shell-1';
const APP_SHELL = [
  './',
  './index.html',
  './v2-shell.html',
  './manifest.webmanifest',
  './manifest-v2.webmanifest',
  './icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch(() => {
            /* dev 환경 등 일부 자산 없는 경우 무시 */
          }),
        ),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigate(event.request));
    return;
  }

  event.respondWith(fetchAndCache(event.request));
});

async function handleNavigate(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const url = new URL(request.url);
    if (url.pathname.includes('v2-shell') || url.pathname.includes('v2.html')) {
      return (await caches.match('./v2-shell.html')) || Response.error();
    }
    return (await caches.match('./index.html')) || Response.error();
  }
}

async function fetchAndCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || Response.error();
  }
}
