/*
 * offline.js — العمل دون اتصال: تسجيل Service Worker، مؤشر الاتصال، تنزيل النصوص والتفاسير، مسح الذاكرات، التحديث.
 * ملاحظة: Service Worker يعمل فقط عبر http(s) (أو localhost)، لا من ملف محلي file://.
 */
(function (g) {
  'use strict';
  const NS = (g.Sahib = g.Sahib || {});
  const { Quran, Storage, Memorization, QuranApi, TafsirApi } = NS;
  const $ = (id) => document.getElementById(id);

  const state = { sw: 'idle', reason: '', registration: null };
  const listeners = [];
  const notify = () => listeners.forEach((fn) => { try { fn(state); } catch (e) { /* لا نكسر الواجهة */ } });

  function onChange(fn) { listeners.push(fn); }

  // ---------- مؤشر الاتصال ----------
  function isOnline() {
    return typeof navigator === 'undefined' || navigator.onLine !== false;
  }
  function updateIndicator() {
    const box = $('netStatus');
    if (!box) return;
    const online = isOnline();
    box.classList.toggle('offline', !online);
    box.querySelector('.txt').textContent = online ? 'متصل' : 'غير متصل';
    box.title = online ? 'أنت متصل بالإنترنت' : 'لا يوجد اتصال: يعمل التطبيق بما حُفظ على جهازك';
  }

  // ---------- Service Worker ----------
  async function register() {
    if (!('serviceWorker' in navigator)) {
      state.sw = 'unsupported'; state.reason = 'متصفحك لا يدعم العمل دون اتصال للملفات.';
    } else if (!/^https?:$/.test(location.protocol) || !g.isSecureContext) {
      state.sw = 'unsupported';
      state.reason = 'يعمل تخزين الملفات دون اتصال عند فتح التطبيق عبر رابط https (أو localhost)، لا من ملف محلي. النصوص والتفاسير المحفوظة تعمل دون اتصال في الحالتين.';
    } else {
      state.sw = 'registering';
      notify();
      try {
        state.registration = await navigator.serviceWorker.register('sw.js');
        await navigator.serviceWorker.ready;
        state.sw = 'ready'; state.reason = '';
      } catch (err) {
        state.sw = 'error'; state.reason = 'تعذّر تفعيل العمل دون اتصال للملفات.';
      }
    }
    notify();
    return state;
  }

  // يسأل الـ SW أن يحدّث الهيكل ذريًا. يعيد { ok, changed } أو { ok:false, reason }.
  async function checkForUpdate() {
    if (state.sw !== 'ready') return { ok: false, reason: 'unavailable' };
    if (!isOnline()) return { ok: false, reason: 'offline' };
    try { await state.registration.update(); } catch (e) { /* قد يفشل دون اتصال */ }
    const worker = navigator.serviceWorker.controller || state.registration.active;
    if (!worker) return { ok: false, reason: 'unavailable' };
    return new Promise((resolve) => {
      const ch = new MessageChannel();
      const timer = setTimeout(() => resolve({ ok: false, reason: 'timeout' }), 20000);
      ch.port1.onmessage = (e) => { clearTimeout(timer); resolve(e.data && e.data.ok ? { ok: true, changed: e.data.changed, version: e.data.version } : { ok: false, reason: 'failed' }); };
      worker.postMessage({ type: 'CHECK_UPDATE' }, [ch.port2]);
    });
  }

  async function clearShellCache() {
    if (!g.caches) return 0;
    const names = (await caches.keys()).filter((n) => n.startsWith('sahib-'));
    await Promise.all(names.map((n) => caches.delete(n)));
    return names.length;
  }

  // ---------- المحفوظات: السور والآيات المطلوبة ----------
  function memorizedSurahs() {
    return Array.from(Memorization.coveredMap(Memorization.all()).keys()).sort((a, b) => a - b);
  }

  // ---------- تنزيل النصوص ----------
  // يجلب نص كل سورة فيها محفوظات (يتخطى المحفوظ مسبقًا). onProgress(done,total).
  async function downloadTexts({ signal, onProgress } = {}) {
    const list = memorizedSurahs();
    let done = 0, failure = null;
    for (const n of list) {
      if (signal && signal.aborted) return { total: list.length, done, aborted: true, failure };
      if (onProgress) onProgress(done, list.length);
      if (!QuranApi.isCached(n)) {
        try { await QuranApi.fetchSurahAyahs(n, { signal }); }
        catch (err) {
          if (err && err.code === 'aborted') return { total: list.length, done, aborted: true, failure };
          failure = err; break;
        }
      }
      done++;
    }
    if (onProgress) onProgress(done, list.length);
    return { total: list.length, done, aborted: false, failure };
  }

  // ---------- تنزيل التفسير لكل آيات المحفوظات ----------
  async function downloadTafsir({ tafsirId, signal, onProgress } = {}) {
    const id = tafsirId || NS.Settings.get('tafsirId');
    const targets = [];
    Memorization.coveredMap(Memorization.all()).forEach((set, surah) => {
      Array.from(set).sort((a, b) => a - b).forEach((ayah) => targets.push([surah, ayah]));
    });
    const out = { total: targets.length, done: 0, skipped: 0, failure: null, aborted: false };
    let next = 0;
    async function worker() {
      while (next < targets.length && !out.failure && !out.aborted) {
        if (signal && signal.aborted) { out.aborted = true; return; }
        const [surah, ayah] = targets[next++];
        if (TafsirApi.isPersisted(id, surah, ayah)) { out.done++; continue; }
        try {
          const r = await TafsirApi.fetchTafsir(id, surah, ayah, { signal, persist: true });
          if (r.storageError) { out.failure = { code: 'storage' }; return; }
          out.done++;
        } catch (err) {
          if (err && err.code === 'aborted') { out.aborted = true; return; }
          if (err && (err.code === 'notfound' || err.code === 'empty')) { out.skipped++; continue; }
          out.failure = err || { code: 'network' };
          return;
        }
        if (onProgress) onProgress(out.done + out.skipped, targets.length);
      }
    }
    if (onProgress) onProgress(0, targets.length);
    await Promise.all([worker(), worker(), worker()]);
    return out;
  }

  // ---------- المساحة المستخدمة ----------
  function storageBreakdown() {
    const K = Storage.KEYS;
    const size = (key) => {
      const got = Storage.rawGet(key);
      return got.ok && typeof got.value === 'string' ? (key.length + got.value.length) * 2 : 0;
    };
    const parts = {
      texts: size(K.cache),
      tafsir: size(K.tafsirCache),
      data: size(K.entries) + size(K.reviewLog) + size(K.settings)
    };
    return { ...parts, total: parts.texts + parts.tafsir + parts.data };
  }

  function formatBytes(n) {
    if (n < 1024) return `${n} بايت`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} ك.ب`;
    return `${(n / 1024 / 1024).toFixed(2)} م.ب`;
  }

  function init() {
    updateIndicator();
    window.addEventListener('online', updateIndicator);
    window.addEventListener('offline', updateIndicator);
    register();
  }

  NS.Offline = {
    init, onChange, state, isOnline, updateIndicator, register, checkForUpdate, clearShellCache,
    memorizedSurahs, downloadTexts, downloadTafsir, storageBreakdown, formatBytes
  };
})(globalThis);
