/**
 * تطبيق وِرد | Wird
 * ملف Service Worker للتخزين المؤقت والتشغيل دون اتصال بالإنترنت (Offline First)
 */

const CACHE_NAME = 'wird-cache-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/fonts/Amiri-Regular.ttf',
  './assets/fonts/Amiri-Bold.ttf',
  './assets/fonts/fonts.css',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/css/main.css',
  './assets/css/theme.css',
  './assets/css/components.css',
  './assets/css/views.css',
  './js/app.js',
  './js/db.js',
  './js/sw-register.js',
  './js/data/default-azkar.js',
  './js/services/azkar-service.js',
  './js/services/memory-service.js',
  './js/services/review-service.js',
  './js/services/segmenter.js',
  './js/services/backup-service.js',
  './js/ui/icons.js',
  './js/ui/components.js',
  './js/ui/views/home-view.js',
  './js/ui/views/library-view.js',
  './js/ui/views/reader-view.js',
  './js/ui/views/memory-view.js',
  './js/ui/views/review-view.js',
  './js/ui/views/favorites-view.js',
  './js/ui/views/settings-view.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // للطلبات المحلية: استراتيجية Cache First مع الرجوع للشبكة
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        });
      }).catch(() => {
        // إذا فشل كل شيء، نرجع صفحة البداية إن كان طلباً لمستند
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      })
    );
  }
});
