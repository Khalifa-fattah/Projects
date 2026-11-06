/*
 * sw.js — Service Worker لعمل ملفات التطبيق دون اتصال (ليس PWA: لا manifest ولا تثبيت).
 *
 *  - التثبيت: تُخزَّن ملفات الواجهة كلها (هيكل التطبيق) في ذاكرة مسماة بالإصدار.
 *  - الطلبات من نفس الأصل: من الذاكرة أولًا (سريع ويعمل دون اتصال). عند فتح الصفحة يُحدَّث الهيكل كله
 *    في الخلفية بشكل ذري (كل الملفات أو لا شيء) كي لا يختلط إصداران، ويظهر التحديث عند الفتح التالي.
 *  - الخطوط (Google Fonts): stale-while-revalidate في ذاكرة مستقلة؛ تعمل دون اتصال بعد أول تحميل ناجح.
 *  - لا نتدخل في طلبات النصوص والتفاسير (api.alquran.cloud وjsDelivr): التطبيق يخزّنها بنفسه ويتحقق منها.
 */
'use strict';

const VERSION = '1.4.2';
const SHELL_PREFIX = 'sahib-shell-';
const SHELL_CACHE = `${SHELL_PREFIX}${VERSION}`;
const FONT_CACHE = 'sahib-fonts-v1';
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);

// يجب أن تطابق هذه القائمة ملفات index.html (يتحقق منها الاختبار الآلي).
const SHELL_FILES = [
  './',
  'index.html',
  'css/style.css',
  'js/quran-data.js',
  'js/utils.js',
  'js/storage.js',
  'js/memorization.js',
  'js/quran-api.js',
  'js/tafsir-api.js',
  'js/settings.js',
  'js/ui.js',
  'js/tafsir-ui.js',
  'js/review.js',
  'js/plan.js',
  'js/backup.js',
  'js/stats.js',
  'js/offline.js',
  'js/settings-ui.js',
  'js/download-ui.js',
  'js/app.js',
  'js/exit-guard.js'
];

const scopeUrl = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL_FILES.map((f) => new Request(scopeUrl(f), { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((n) => n.startsWith(SHELL_PREFIX) && n !== SHELL_CACHE)
      .map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// تحديث الهيكل كله ذريًا: لا نكتب شيئًا في الذاكرة إلا إذا نجح جلب كل الملفات.
async function refreshShell() {
  try {
    const cache = await caches.open(SHELL_CACHE);
    const fetched = await Promise.all(SHELL_FILES.map(async (f) => {
      const req = new Request(scopeUrl(f), { cache: 'reload' });
      const res = await fetch(req);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const old = await cache.match(req);
      const changed = !old || (await old.clone().text()) !== (await res.clone().text());
      return { req, res, changed };
    }));
    const changedItems = fetched.filter((x) => x.changed);
    await Promise.all(changedItems.map((x) => cache.put(x.req, x.res.clone())));
    return { ok: true, changed: changedItems.length };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

async function shellResponse(event) {
  const request = event.request;
  const cache = await caches.open(SHELL_CACHE);
  const isNav = request.mode === 'navigate';
  const key = isNav ? scopeUrl('index.html') : request;
  const cached = await cache.match(key, { ignoreSearch: true });
  if (cached) {
    if (isNav) event.waitUntil(refreshShell());
    return cached;
  }
  try {
    const res = await fetch(request);
    if (res && res.ok && res.type === 'basic') cache.put(request, res.clone());
    return res;
  } catch (err) {
    if (isNav) {
      const fallback = await cache.match(scopeUrl('index.html'));
      if (fallback) return fallback;
    }
    return Response.error();
  }
}

async function staleWhileRevalidate(event, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(event.request);
  const network = fetch(event.request).then((res) => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(event.request, res.clone());
    return res;
  }).catch(() => null);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('/sw.js')) return; // تحديث الـ SW نفسه يتولاه المتصفح
    event.respondWith(shellResponse(event));
  } else if (FONT_HOSTS.has(url.hostname)) {
    event.respondWith(staleWhileRevalidate(event, FONT_CACHE));
  }
});

// رسائل من الصفحة: {type:'CHECK_UPDATE'} ← يرد على المنفذ بنتيجة refreshShell، {type:'VERSION'} ← رقم الإصدار.
self.addEventListener('message', (event) => {
  const data = event.data || {};
  const port = event.ports && event.ports[0];
  if (!port) return;
  if (data.type === 'CHECK_UPDATE') {
    event.waitUntil(refreshShell().then((r) => port.postMessage({ ...r, version: VERSION })));
  } else if (data.type === 'VERSION') {
    port.postMessage({ version: VERSION });
  }
});
