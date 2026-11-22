/* Service Worker — يجعل التطبيق يعمل بدون إنترنت.
   غيّر رقم VERSION عند كل تحديث للملفات لإجبار المتصفح على تنزيل النسخة الجديدة. */
const VERSION = 'tasbih-v7';

const ASSETS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'fonts/cairo-arabic-wght-normal.woff2',
  'fonts/cairo-latin-wght-normal.woff2',
  'fonts/amiri-arabic-400-normal.woff2',
  'fonts/amiri-arabic-700-normal.woff2',
  'fonts/amiri-latin-400-normal.woff2',
  'fonts/lobster-latin-400-normal.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* استراتيجية: الكاش أولاً (سرعة + عمل بدون إنترنت) مع تحديث الكاش في الخلفية */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const isNav = req.mode === 'navigate';
    const key = isNav ? 'index.html' : req;

    const cached = await cache.match(key, { ignoreSearch: true });

    const network = fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') cache.put(key, res.clone());
        return res;
      })
      .catch(() => null);

    if (cached) {
      event.waitUntil(network);
      return cached;
    }

    const res = await network;
    if (res) return res;
    if (isNav) {
      const fallback = await cache.match('index.html');
      if (fallback) return fallback;
    }
    return Response.error();
  })());
});
