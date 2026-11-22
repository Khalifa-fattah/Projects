/* Service Worker — يجعل تطبيق مساحة المشاريع يعمل كـ PWA وبدون انترنت (الملفات الأساسية) */
const VERSION = 'projects-v1';

const ASSETS = [
  './',
  'index.html',
  'github page/manifest.json',
  'github page/icons/icon-192.png',
  'github page/icons/icon-512.png',
  'github page/icons/icon-maskable-512.png',
  'github page/icons/apple-touch-icon.png'
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

/* استراتيجية الاستجابة: الكاش أولاً للملفات الأساسية، والشبكة لبيانات GitHub API */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // إذا كانت الطلبات لـ GitHub API أو GitHub Pages، اتركها للشبكة أولاً مع fallback
  if (url.hostname.includes('github.com') || url.hostname.includes('githubusercontent.com') || url.hostname.includes('github.io')) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // للملفات المحلية (App Shell)
  if (url.origin === self.location.origin) {
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
  }
});
