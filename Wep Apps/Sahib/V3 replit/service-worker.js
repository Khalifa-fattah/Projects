const SHELL_CACHE = 'sahib-shell-v2.0.0';
const CORE = [
  './', './index.html', './offline.html', './manifest.json',
  './css/themes.css', './css/style.css', './css/responsive.css',
  './js/app.js', './js/quran-data.js', './js/quran-api.js', './js/storage.js',
  './js/migrations.js', './js/memorization.js', './js/review.js',
  './js/review-scheduler.js', './js/stats.js', './js/backup.js',
  './js/settings.js', './js/utils.js',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png',
  './assets/fonts/NotoSansArabic-Regular.ttf', './assets/fonts/NotoSansArabic-Bold.ttf',
  './assets/fonts/NotoNaskhArabic-Regular.ttf', './assets/fonts/NotoNaskhArabic-Bold.ttf',
  './data/quran-uthmani.meta.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(CORE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('sahib-shell-') && key !== SHELL_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const fallback = await cache.match('./offline.html');
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const staticAsset = /\/assets\/(fonts|icons)\//.test(url.pathname);
  event.respondWith(staticAsset ? cacheFirst(request) : networkFirst(request));
});
