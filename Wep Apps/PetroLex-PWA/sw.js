// PetroLex service worker
// - Files are served from cache first (works offline) and refreshed in the background
//   (stale-while-revalidate), so updates no longer depend on bumping a version by hand.
// - When a refreshed file differs from the cached one, open pages get an
//   ASSETS_UPDATED message and show an "update available" notice.
// - Changing this file itself triggers the normal waiting-worker update flow.
const CACHE_PREFIX = 'petrolex-offline-';
const CACHE_NAME = CACHE_PREFIX + 'v5';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './data.js',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

async function notifyClients() {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach((c) => c.postMessage({ type: 'ASSETS_UPDATED' }));
}

async function refresh(request, cache, cached) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      if (cached) {
        const [a, b] = await Promise.all([cached.clone().text(), response.clone().text()]);
        if (a !== b) {
          await cache.put(request, response.clone());
          await notifyClients();
          return response;
        }
      }
      await cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return null;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: true });
    const network = refresh(request, cache, cached);
    if (cached) {
      event.waitUntil(network);
      return cached;
    }
    const response = await network;
    if (response) return response;
    if (request.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    return Response.error();
  })());
});
