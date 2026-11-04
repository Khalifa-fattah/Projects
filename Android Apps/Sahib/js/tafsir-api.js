/*
 * tafsir-api.js — طبقة جلب التفسير وتخزينه (مستقلة عن الواجهة).
 *
 * المصدر المُعدّ: مشروع spa5k/tafsir_api عبر CDN (jsDelivr) — نصوص عربية، آية آية:
 *   {baseUrl}/tafsir/{slug}/{سورة}/{آية}.json
 * تحذير صريح: لم أتمكن من فحص الردّ الفعلي لهذا المصدر من بيئة التطوير (الشبكة مقيّدة)،
 * لذلك التحقق أدناه صارم: لا يُعرض ولا يُخزَّن إلا ردّ فيه نص غير فارغ، وإن وُجد فيه رقم
 * السورة أو الآية وجب أن يطابق المطلوب. شغّل tools/verify-tafsir-source.html على جهازك للتأكد
 * من الـ slugs والبنية قبل الاعتماد، وغيّر الإعداد هنا إن اختلف شيء.
 * لتبديل المصدر مستقبلًا يكفي تعديل config وfetchRaw/parseResponse دون لمس الواجهة.
 *
 * لا نستخدم نموذجًا لغويًا لتوليد التفسير ولا نختلقه عند الفشل.
 */
(function (g) {
  'use strict';
  const NS = (g.Sahib = g.Sahib || {});
  const { Quran, Storage } = NS;

  const TAFSIRS = Object.freeze({
    muyassar: Object.freeze({
      id: 'muyassar',
      name: 'التفسير الميسر',
      author: 'نخبة من العلماء بإشراف مجمع الملك فهد لطباعة المصحف الشريف',
      slug: 'ar-tafsir-muyassar'
    }),
    saadi: Object.freeze({
      id: 'saadi',
      name: 'تفسير السعدي',
      author: 'عبد الرحمن بن ناصر السعدي',
      slug: 'ar-tafseer-al-saddi' // وُجد في المصدر اسمان محتملان (هذا و ar-tafsir-as-saadi)؛ تحقق عبر أداة الفحص
    })
  });
  const TAFSIR_IDS = Object.keys(TAFSIRS);

  const config = {
    baseUrl: 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api',
    ref: 'main', // الأفضل تثبيت وسم إصدار بعد التحقق
    sourceName: 'tafsir_api (jsDelivr)',
    timeoutMs: 12000
  };

  class TafsirError extends Error {
    constructor(code, message) {
      super(message || code);
      this.name = 'TafsirError';
      this.code = code; // network | timeout | http | notfound | invalid | empty | aborted
    }
  }

  const keyOf = (tafsirId, surah, ayah) => `${tafsirId}:${surah}:${ayah}`;

  let store = Storage.loadTafsirCache(); // سجلات محفوظة على الجهاز
  const mem = new Map(); // سجلات الجلسة فقط (آيات غير مرتبطة بمحفوظات)
  const inflight = new Map();

  // ---------- التخزين الكبير (IndexedDB) لتنزيل التفسير كاملًا ----------
  // localStorage لا يتسع لتفسير القرآن كله (~5 م.ب)، فالتنزيل الكامل يُحفظ في IndexedDB ويُحمَّل إلى ذاكرة الجلسة عند الفتح.
  // bulk: مفتاح "<tafsirId>:<سورة>:<آية>" -> نص التفسير. bulkReady تنتهي سواء نجح التحميل أم لا.
  const BULK_DB = 'sahib_tafsir_bulk_v1';
  const BULK_STORE = 'ayat';
  const bulk = new Map();
  let bulkDbPromise = null;

  function openBulkDb() {
    if (bulkDbPromise) return bulkDbPromise;
    bulkDbPromise = new Promise((resolve, reject) => {
      try {
        if (!g.indexedDB) { reject(new Error('no-idb')); return; }
        const req = g.indexedDB.open(BULK_DB, 1);
        req.onupgradeneeded = () => { req.result.createObjectStore(BULK_STORE); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('idb-open'));
        req.onblocked = () => reject(new Error('idb-blocked'));
      } catch (e) { reject(e); }
    });
    bulkDbPromise.catch(() => { bulkDbPromise = null; });
    return bulkDbPromise;
  }

  function loadBulk() {
    return openBulkDb().then((db) => new Promise((resolve) => {
      try {
        const tx = db.transaction(BULK_STORE, 'readonly');
        const cur = tx.objectStore(BULK_STORE).openCursor();
        cur.onsuccess = () => {
          const c = cur.result;
          if (c) { if (typeof c.value === 'string') bulk.set(c.key, c.value); c.continue(); }
        };
        tx.oncomplete = () => resolve(true);
        tx.onerror = tx.onabort = () => resolve(false);
      } catch (e) { resolve(false); }
    })).catch(() => false);
  }
  const bulkReady = loadBulk();

  // يكتب مجموعة آيات في معاملة واحدة (كلها أو لا شيء). entries: [[ayah, text], ...]. يعيد { ok, reason }.
  function saveBulk(tafsirId, surah, entries) {
    const items = [];
    for (const [ayah, text] of entries) {
      if (!validTarget(tafsirId, surah, ayah) || typeof text !== 'string' || !toPlainText(text)) {
        return Promise.resolve({ ok: false, reason: 'invalid' });
      }
      items.push([keyOf(tafsirId, surah, ayah), text]);
    }
    return openBulkDb().then((db) => new Promise((resolve) => {
      try {
        const tx = db.transaction(BULK_STORE, 'readwrite');
        const os = tx.objectStore(BULK_STORE);
        items.forEach(([k, t]) => os.put(t, k));
        tx.oncomplete = () => { items.forEach(([k, t]) => bulk.set(k, t)); resolve({ ok: true }); };
        tx.onerror = tx.onabort = () => resolve({ ok: false, reason: 'storage' });
      } catch (e) { resolve({ ok: false, reason: 'storage' }); }
    })).catch(() => ({ ok: false, reason: 'storage' }));
  }

  function clearBulk() {
    return openBulkDb().then((db) => new Promise((resolve) => {
      try {
        const tx = db.transaction(BULK_STORE, 'readwrite');
        tx.objectStore(BULK_STORE).clear();
        tx.oncomplete = () => { bulk.clear(); resolve({ ok: true }); };
        tx.onerror = tx.onabort = () => resolve({ ok: false, reason: 'storage' });
      } catch (e) { resolve({ ok: false, reason: 'storage' }); }
    })).catch(() => (bulk.size ? { ok: false, reason: 'storage' } : { ok: true }));
  }

  function validTarget(tafsirId, surah, ayah) {
    const s = Quran.surahByNumber(surah);
    return !!TAFSIRS[tafsirId] && !!s && Number.isInteger(ayah) && ayah >= 1 && ayah <= s.ayahs;
  }

  function getCachedTafsir(tafsirId, surah, ayah) {
    const k = keyOf(tafsirId, surah, ayah);
    if (store[k] || mem.get(k)) return store[k] || mem.get(k);
    if (bulk.has(k)) {
      return { tafsirId, surahNumber: surah, ayahNumber: ayah, text: bulk.get(k), cachedAt: null, source: 'bulk' };
    }
    return null;
  }

  // يخزّن في الذاكرة دائمًا؛ ويكتب في التخزين المحلي فقط عند persist=true.
  // يعيد { ok, persisted, reason }: فشل الكتابة لا يمنع القراءة ولا يُعلَن نجاحًا كاذبًا.
  function cacheTafsir(tafsirId, surah, ayah, text, opts) {
    if (!validTarget(tafsirId, surah, ayah) || typeof text !== 'string' || !text.trim()) {
      return { ok: false, persisted: false, reason: 'invalid' };
    }
    const record = {
      tafsirId, surahNumber: surah, ayahNumber: ayah, text,
      cachedAt: new Date().toISOString(),
      source: `${config.sourceName}@${config.ref}`
    };
    const k = keyOf(tafsirId, surah, ayah);
    mem.set(k, record);
    if (!(opts && opts.persist)) return { ok: true, persisted: false };
    const next = { ...store, [k]: record };
    const res = Storage.saveTafsirCache(next);
    if (res.ok) {
      store = next;
      return { ok: true, persisted: true };
    }
    return { ok: true, persisted: false, reason: res.reason };
  }

  // يرقّي سجلًا موجودًا في الذاكرة المؤقتة إلى التخزين (عند صيرورة الآية جزءًا من محفوظ).
  function persistIfCached(tafsirId, surah, ayah) {
    const rec = mem.get(keyOf(tafsirId, surah, ayah));
    if (!rec || store[keyOf(tafsirId, surah, ayah)] || bulk.has(keyOf(tafsirId, surah, ayah))) return { ok: true, persisted: !!rec };
    return cacheTafsir(tafsirId, surah, ayah, rec.text, { persist: true });
  }

  function isPersisted(tafsirId, surah, ayah) {
    const k = keyOf(tafsirId, surah, ayah);
    return !!store[k] || bulk.has(k);
  }

  // تحويل نص التفسير إلى نص عادي للعرض (إزالة وسوم HTML إن وُجدت). العرض يتم بـ textContent دائمًا.
  function toPlainText(text) {
    return String(text)
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\/p\s*>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // تحليل الردّ والتحقق منه. يرمي TafsirError عند أي خلل.
  function parseResponse(json, surah, ayah) {
    if (!json || typeof json !== 'object' || Array.isArray(json)) throw new TafsirError('invalid', 'not object');
    if (json.surah !== undefined && Number(json.surah) !== surah) throw new TafsirError('invalid', 'surah mismatch');
    if (json.ayah !== undefined && Number(json.ayah) !== ayah) throw new TafsirError('invalid', 'ayah mismatch');
    if (typeof json.text !== 'string') throw new TafsirError('invalid', 'no text');
    if (!toPlainText(json.text)) throw new TafsirError('empty', 'empty text');
    return json.text;
  }

  async function requestTafsir(tafsirId, surah, ayah) {
    const def = TAFSIRS[tafsirId];
    const url = `${config.baseUrl}@${config.ref}/tafsir/${def.slug}/${surah}/${ayah}.json`;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, config.timeoutMs);
    try {
      let res;
      try {
        res = await fetch(url, { signal: controller.signal });
      } catch (e) {
        throw new TafsirError(timedOut ? 'timeout' : 'network');
      }
      if (res.status === 404) throw new TafsirError('notfound');
      if (!res.ok) throw new TafsirError('http', `HTTP ${res.status}`);
      let json;
      try {
        json = await res.json();
      } catch (e) {
        throw timedOut ? new TafsirError('timeout') : new TafsirError('invalid', 'not json');
      }
      return parseResponse(json, surah, ayah);
    } finally {
      clearTimeout(timer);
    }
  }

  function waitWithAbort(promise, signal) {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(new TafsirError('aborted'));
    return new Promise((resolve, reject) => {
      const onAbort = () => reject(new TafsirError('aborted'));
      signal.addEventListener('abort', onAbort, { once: true });
      promise.then(
        (v) => { signal.removeEventListener('abort', onAbort); resolve(v); },
        (e) => { signal.removeEventListener('abort', onAbort); reject(e); }
      );
    });
  }

  // fetchTafsir: يعيد { text, fromCache, persisted, storageError }.
  // options: { signal, persist } — persist=true يكتب التفسير الجديد في التخزين المحلي.
  // الطلب المشترك يكمل ويملأ الذاكرة حتى لو ألغى المنتظِر (لا نعرض متأخرًا، لكن لا نهدر الطلب).
  async function fetchTafsir(tafsirId, surah, ayah, options) {
    const opts = options || {};
    if (!validTarget(tafsirId, surah, ayah)) throw new TafsirError('invalid', 'bad target');
    if (opts.signal && opts.signal.aborted) throw new TafsirError('aborted');

    const cached = getCachedTafsir(tafsirId, surah, ayah);
    if (cached) {
      let persisted = isPersisted(tafsirId, surah, ayah);
      let storageError = null;
      if (opts.persist && !persisted) {
        const r = persistIfCached(tafsirId, surah, ayah);
        persisted = !!r.persisted;
        if (!r.persisted) storageError = r.reason || 'unavailable';
      }
      return { text: cached.text, fromCache: true, persisted, storageError };
    }

    const k = keyOf(tafsirId, surah, ayah);
    let pending = inflight.get(k);
    if (!pending) {
      pending = requestTafsir(tafsirId, surah, ayah)
        .then((text) => ({ text, cache: cacheTafsir(tafsirId, surah, ayah, text, { persist: !!opts.persist }) }))
        .finally(() => inflight.delete(k));
      inflight.set(k, pending);
    }
    const { text, cache } = await waitWithAbort(pending, opts.signal);
    return {
      text, fromCache: false, persisted: !!cache.persisted,
      storageError: opts.persist && !cache.persisted ? (cache.reason || 'unavailable') : null
    };
  }

  // رسالة مناسبة لكل حالة فشل (لا نعتبر الفشل نجاحًا ولا نعرض تفسيرًا آخر بدلًا منه).
  function describeError(err, tafsirName) {
    const name = tafsirName || 'التفسير';
    switch (err && err.code) {
      case 'notfound':
      case 'empty':
        return `نص ${name} لهذه الآية غير متاح حاليًا في المصدر.`;
      case 'invalid':
        return `وصل ردّ غير صالح من مصدر ${name} فلم نعرضه حفاظًا على سلامة النص.`;
      case 'timeout':
        return 'انتهت مهلة الاتصال أثناء جلب التفسير. حاول مرة أخرى.';
      case 'http':
        return 'تعذّر جلب التفسير من المصدر الآن. حاول مرة أخرى لاحقًا.';
      default: {
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        return (offline ? 'لا يوجد اتصال بالإنترنت. ' : 'تعذّر الاتصال بالإنترنت. ') +
          'التفاسير التي حُفظت مسبقًا على جهازك تعمل دون اتصال، أما هذه الآية فلم تُحفظ بعد.';
      }
    }
  }

  function persistedCount(tafsirId) {
    const all = new Set([...Object.keys(store), ...bulk.keys()]);
    const keys = Array.from(all);
    return tafsirId ? keys.filter((k) => k.startsWith(`${tafsirId}:`)).length : keys.length;
  }

  // كم آية من القرآن محفوظة لهذا التفسير على الجهاز (من أصل 6236).
  function persistedCountFor(tafsirId) { return persistedCount(tafsirId); }

  // مسح التفاسير المحفوظة على الجهاز فقط (لا يمس المحفوظات). يعيد وعدًا بنتيجة الكتابة.
  async function clearStore() {
    const res = Storage.saveTafsirCache({});
    if (res.ok) { store = {}; mem.clear(); }
    const b = await clearBulk();
    return res.ok && b.ok ? { ok: true } : { ok: false, reason: res.ok ? b.reason : res.reason };
  }

  // ---------- جلب سورة كاملة بطلب واحد ----------
  // الشكل المتوقع (غير متحقَّق منه من بيئة التطوير): {baseUrl}@{ref}/tafsir/{slug}/{سورة}.json
  //   => { ayahs: [ { ayah: 1, text: "..." }, ... ] } (ويُقبل أيضًا مصفوفة مباشرة).
  // لا نقبل إلا سورة مكتملة العدد وبترقيم صحيح؛ وإلا يرمي خطأً فيعود المُنزِّل إلى الجلب آية آية.
  function parseSurahResponse(json, surah) {
    const s = Quran.surahByNumber(surah);
    const list = Array.isArray(json) ? json : json && Array.isArray(json.ayahs) ? json.ayahs : null;
    if (!s || !list) throw new TafsirError('invalid', 'no ayahs');
    const byAyah = new Map();
    for (const a of list) {
      if (!a || typeof a !== 'object') throw new TafsirError('invalid', 'bad item');
      const n = Number(a.ayah !== undefined ? a.ayah : a.ayah_number);
      if (!Number.isInteger(n) || n < 1 || n > s.ayahs) throw new TafsirError('invalid', 'bad ayah number');
      if (typeof a.text !== 'string') throw new TafsirError('invalid', 'no text');
      byAyah.set(n, a.text);
    }
    const out = [];
    let missing = 0;
    for (let n = 1; n <= s.ayahs; n++) {
      if (byAyah.has(n) && toPlainText(byAyah.get(n))) out.push([n, byAyah.get(n)]); else missing++;
    }
    // نسمح بنقص يسير فقط (آيات بلا تفسير في المصدر)؛ أكثر من ذلك نعدّه ردًّا غير صالح.
    if (out.length === 0 || missing > Math.max(2, Math.floor(s.ayahs * 0.1))) throw new TafsirError('invalid', 'incomplete surah');
    return { entries: out, missing };
  }

  async function requestSurahTafsir(tafsirId, surah, signal) {
    const def = TAFSIRS[tafsirId];
    const url = `${config.baseUrl}@${config.ref}/tafsir/${def.slug}/${surah}.json`;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, config.timeoutMs * 2);
    const onAbort = () => controller.abort();
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    try {
      let res;
      try { res = await fetch(url, { signal: controller.signal }); }
      catch (e) { throw new TafsirError(signal && signal.aborted ? 'aborted' : timedOut ? 'timeout' : 'network'); }
      if (res.status === 404) throw new TafsirError('notfound');
      if (!res.ok) throw new TafsirError('http', `HTTP ${res.status}`);
      let json;
      try { json = await res.json(); }
      catch (e) { throw signal && signal.aborted ? new TafsirError('aborted') : timedOut ? new TafsirError('timeout') : new TafsirError('invalid', 'not json'); }
      return parseSurahResponse(json, surah);
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  }

  NS.TafsirApi = {
    TAFSIRS, TAFSIR_IDS, config, TafsirError,
    fetchTafsir, getCachedTafsir, cacheTafsir, isPersisted, persistIfCached, persistedCount, persistedCountFor, clearStore,
    toPlainText, parseResponse, describeError,
    bulkReady, saveBulk, clearBulk, requestSurahTafsir, parseSurahResponse
  };
})(globalThis);
