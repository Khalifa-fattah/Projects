/* Service worker: يعمل التطبيق دون اتصال بعد الزيارة الأولى */
const VERSION = 'pe-v2';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const SHELL_FILES = [
  './', 'index.html', 'styles.css', 'data.js', 'app.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
];
const MAX_RUNTIME_ENTRIES = 60;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > MAX_RUNTIME_ENTRIES) await Promise.all(keys.slice(0, keys.length - MAX_RUNTIME_ENTRIES).map((k) => cache.delete(k)));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // صفحات التنقل: الشبكة أولاً ثم النسخة المخزنة
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put('index.html', copy));
        return res;
      }).catch(() => caches.match('index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  const cacheable = sameOrigin || /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || url.hostname === 'images.unsplash.com';
  if (!cacheable) return;

  // stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(sameOrigin ? SHELL : RUNTIME).then((c) => c.put(req, copy)).then(() => !sameOrigin && trim(RUNTIME));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
