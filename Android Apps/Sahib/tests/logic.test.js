// اختبارات المنطق (بدون متصفح): node tests/logic.test.js
'use strict';
const assert = require('assert');
const path = require('path');

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name, fn }); }

// ---- بيئة وهمية ----
function makeLocalStorage(opts = {}) {
  const store = new Map(Object.entries(opts.initial || {}));
  return {
    store,
    getItem(k) { if (opts.throwGet) throw new Error('denied'); return store.has(k) ? store.get(k) : null; },
    setItem(k, v) {
      if (opts.throwSet) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
      store.set(k, String(v));
    }
  };
}

function Storage_loadLog() { return globalThis.Sahib.Storage.loadReviewLog(); }
function load(opts = {}) {
  for (const k of Object.keys(require.cache)) if (k.includes(path.sep + 'js' + path.sep)) delete require.cache[k];
  globalThis.Sahib = undefined;
  globalThis.localStorage = makeLocalStorage(opts);
  const js = (f) => require(path.join(__dirname, '..', 'js', f));
  ['quran-data.js', 'utils.js', 'storage.js', 'memorization.js', 'quran-api.js', 'tafsir-api.js', 'settings.js'].forEach(js);
  // مراجعة/سجل المراجعات يحتاجان DOM؛ نستبدلهما بسجل بسيط للاختبار
  globalThis.Sahib.ReviewLog = (() => { let r = Storage_loadLog(); return { all: () => r, setAll: (n) => { r = n; } }; })();
  js('backup.js');
  js('stats.js');
  return globalThis.Sahib;
}

function fakeSurahJson(n, count, edition = 'quran-uthmani') {
  return {
    code: 200,
    data: {
      number: n, edition: { identifier: edition },
      ayahs: Array.from({ length: count }, (_, i) => ({ numberInSurah: i + 1, text: `نص ${n}:${i + 1}` }))
    }
  };
}

// ================= التواريخ =================
test('toLocalDateStr يستخدم اليوم المحلي لا UTC', () => {
  const S = load();
  // 00:30 محلي — في توقيت UTC+2 يكون toISOString يوم أمس؛ الدالة الجديدة تعيد اليوم المحلي.
  const d = new Date(2026, 9, 30, 0, 30, 0);
  assert.strictEqual(S.Utils.toLocalDateStr(d), '2026-10-30');
});
test('dayNumber يرفض التواريخ غير الصالحة', () => {
  const S = load();
  for (const bad of ['2026-02-30', '2026-13-01', 'abc', '', null, undefined, 20260101, '2026-1-1']) {
    assert.ok(Number.isNaN(S.Utils.dayNumber(bad)), String(bad));
  }
  assert.strictEqual(S.Utils.daysBetween('2026-10-23', '2026-10-30'), 7);
  assert.strictEqual(S.Utils.daysBetween('2026-03-28', '2026-03-30'), 2);
});

// ================= الإحصائيات =================
test('آخر ٧ أيام: اليوم و٦ قبله فقط، تُستبعد المستقبلية والقديمة والتالفة', () => {
  const S = load();
  const mk = (id, last) => ({ id, surah: 1, from: 1, to: 7, lastReviewed: last });
  const entries = [
    mk('a', '2026-10-30'), mk('b', '2026-10-24'), mk('c', '2026-10-23'),
    mk('d', '2026-11-05'), mk('e', 'garbage'), mk('f', null)
  ];
  const s = S.Stats.compute(entries, [], '2026-10-30');
  assert.strictEqual(s.reviewedLast7, 2); // a و b
  assert.strictEqual(s.neverReviewed, 2); // e و f
});
test('لا تتكرر الآيات عند تداخل النطاقات', () => {
  const S = load();
  const entries = [
    { id: '1', surah: 2, from: 1, to: 10 },
    { id: '2', surah: 2, from: 5, to: 15 },
    { id: '3', surah: 2, from: 1, to: 10 }
  ];
  const s = S.Stats.compute(entries, [], '2026-10-30');
  assert.strictEqual(s.uniqueAyat, 15);
  assert.strictEqual(s.entryCount, 3);
  assert.strictEqual(s.surahsInProgress, 1);
});
test('سورة كاملة بنطاقات متجاورة', () => {
  const S = load();
  const entries = [{ id: '1', surah: 1, from: 1, to: 3 }, { id: '2', surah: 1, from: 4, to: 7 }];
  const s = S.Stats.compute(entries, [], '2026-10-30');
  assert.strictEqual(s.completedSurahs, 1);
  assert.strictEqual(s.uniqueAyat, 7);
});
test('الجلسات الملغاة لا تُحسب مكتملة', () => {
  const S = load();
  const log = [{ status: 'completed' }, { status: 'cancelled' }, { status: 'incomplete' }];
  assert.strictEqual(S.Stats.compute([], log, '2026-10-30').completedSessions, 1);
});
test('لا بيانات: الإحصاءات أصفار دون أخطاء', () => {
  const S = load();
  const s = S.Stats.compute([], [], '2026-10-30');
  assert.strictEqual(s.uniqueAyat, 0);
  assert.strictEqual(s.percentOfQuran, 0);
});

// ================= التحقق من المدخلات =================
test('validateRange: صالح ومرفوض', () => {
  const S = load();
  const v = S.Memorization.validateRange;
  assert.ok(v(1, 1, 7).ok);
  assert.ok(v('2', '1', '286').ok);
  assert.ok(!v(1, 1, 8).ok);       // يتجاوز
  assert.ok(!v(1, 0, 3).ok);       // أقل من 1
  assert.ok(!v(1, 5, 3).ok);       // معكوس
  assert.ok(!v(999, 1, 1).ok);     // سورة غير موجودة
  assert.ok(!v(1, '', '').ok);     // فارغ
  assert.ok(!v(1, '2.5', 3).ok);   // كسر
  assert.ok(!v(1, 'abc', 3).ok);
});

// ================= التداخل والدمج =================
test('classify: تطابق وتداخل وتجاور وانفصال وسورة أخرى', () => {
  const S = load();
  const M = S.Memorization;
  const entries = [{ id: 'x', surah: 2, from: 10, to: 20 }, { id: 'y', surah: 3, from: 1, to: 5 }];
  assert.strictEqual(M.classify(entries, 2, 10, 20).exact.length, 1);
  assert.strictEqual(M.classify(entries, 2, 15, 30).overlapping.length, 1);
  assert.strictEqual(M.classify(entries, 2, 12, 14).overlapping.length, 1); // يبدأ داخل نطاق محفوظ
  assert.strictEqual(M.classify(entries, 2, 21, 25).adjacent.length, 1);
  assert.strictEqual(M.classify(entries, 2, 5, 9).adjacent.length, 1);
  assert.strictEqual(M.classify(entries, 2, 30, 40).group.length, 0);
  assert.strictEqual(M.classify(entries, 4, 10, 20).group.length, 0);
});
test('mergeAdd يدمج ويحفظ المصدر ولا يكرر الآيات', () => {
  const S = load();
  const M = S.Memorization;
  M.init([]);
  const a = M.add({ surah: 2, from: 1, to: 10 }).entry;
  const merged = M.mergeAdd([a.id], { surah: 2, from: 8, to: 20 });
  assert.ok(merged.ok);
  assert.strictEqual(M.all().length, 1);
  assert.strictEqual(M.all()[0].from, 1);
  assert.strictEqual(M.all()[0].to, 20);
  assert.ok(Array.isArray(M.all()[0].mergedFrom) && M.all()[0].mergedFrom.length >= 1);
  assert.strictEqual(S.Stats.compute(M.all(), [], '2026-10-30').uniqueAyat, 20);
});
test('mergeChangesRange: لا فائدة من دمج نطاق داخل مقطع واحد', () => {
  const S = load();
  const g = [{ from: 1, to: 20 }];
  assert.strictEqual(S.Memorization.mergeChangesRange(g, 5, 10), false);
  assert.strictEqual(S.Memorization.mergeChangesRange(g, 15, 25), true);
});

// ================= التخزين =================
test('بيانات سليمة تُقرأ كما هي (مفتاح قديم v1)', () => {
  const old = [{ id: 'e1', surah: 2, surahName: 'x', from: 1, to: 5, dateAdded: '2026-10-01', lastReviewed: null, reviewCount: 0 }];
  const S = load({ initial: { quran_hifz_entries_v1: JSON.stringify(old) } });
  const e = S.Storage.loadEntries();
  assert.strictEqual(e.length, 1);
  assert.strictEqual(e[0].id, 'e1');
  assert.strictEqual(S.Storage.KEYS.entries, 'quran_hifz_entries_v1');
  assert.strictEqual(S.Storage.KEYS.cache, 'quran_text_cache_v1');
});
test('JSON تالف: يُنسخ احتياطيًا ويُمنع الكتابة فوقه ولا يُحذف الأصل', () => {
  const S = load({ initial: { quran_hifz_entries_v1: '{not json' } });
  assert.deepStrictEqual(S.Storage.loadEntries(), []);
  assert.strictEqual(S.Storage.issues.corrupt.length, 1);
  const backupKey = S.Storage.issues.corrupt[0].backupKey;
  assert.ok(backupKey && localStorage.store.get(backupKey) === '{not json');
  assert.strictEqual(localStorage.store.get('quran_hifz_entries_v1'), '{not json'); // الأصل باق
  const r = S.Storage.saveEntries([]);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'blocked');
  assert.strictEqual(localStorage.store.get('quran_hifz_entries_v1'), '{not json');
  S.Storage.allowWritesFor('quran_hifz_entries_v1');
  assert.ok(S.Storage.saveEntries([]).ok);
});
test('JSON صالح لكنه ليس مصفوفة: يعامل كتالف', () => {
  const S = load({ initial: { quran_hifz_entries_v1: '{"a":1}' } });
  S.Storage.loadEntries();
  assert.strictEqual(S.Storage.issues.corrupt.length, 1);
});
test('سجلات غير صالحة تُتخطى وتُنسخ، والصالحة تبقى', () => {
  const data = [
    { id: 'ok', surah: 1, from: 1, to: 7 },
    { id: 'bad1', surah: 1, from: 5, to: 99 },
    { id: 'bad2', surah: 500, from: 1, to: 2 },
    null, 'x'
  ];
  const S = load({ initial: { quran_hifz_entries_v1: JSON.stringify(data) } });
  const e = S.Storage.loadEntries();
  assert.strictEqual(e.length, 1);
  assert.strictEqual(S.Storage.issues.invalid[0].count, 4);
  assert.ok(localStorage.store.get(S.Storage.issues.invalid[0].backupKey));
});
test('فشل الكتابة (امتلاء): لا تتغير الحالة ولا يُعاد نجاح', () => {
  const S = load({ throwSet: true });
  S.Memorization.init([]);
  const r = S.Memorization.add({ surah: 1, from: 1, to: 3 });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'quota');
  assert.strictEqual(S.Memorization.all().length, 0);
  assert.ok(S.Storage.describeError(r).includes('ممتلئة'));
});
test('تخزين غير متاح عند القراءة: لا استثناء وتُسجَّل المشكلة', () => {
  const S = load({ throwGet: true });
  assert.deepStrictEqual(S.Storage.loadEntries(), []);
  assert.strictEqual(S.Storage.issues.unavailable, true);
});
test('تحقق من ذاكرة النصوص: يُهمل غير المتطابق ويُبقي السليم', () => {
  const good = Array.from({ length: 7 }, (_, i) => `آية ${i + 1}`);
  const S = load({ initial: { quran_text_cache_v1: JSON.stringify({ 1: good, 2: ['ناقص'], 3: 'x' }) } });
  const c = S.Storage.loadTextCache();
  assert.deepStrictEqual(Object.keys(c), ['1']);
});
test('حذف مقطع يحفظ ويُحدّث الحالة', () => {
  const S = load();
  S.Memorization.init([]);
  const e = S.Memorization.add({ surah: 1, from: 1, to: 3 }).entry;
  assert.ok(S.Memorization.remove(e.id).ok);
  assert.strictEqual(S.Memorization.all().length, 0);
  assert.strictEqual(JSON.parse(localStorage.store.get('quran_hifz_entries_v1')).length, 0);
});

// ================= واجهة API =================
test('API: ردّ صالح يُقبل ويُخزَّن', async () => {
  const S = load();
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: true, json: async () => fakeSurahJson(1, 7) }; };
  const a = await S.QuranApi.fetchSurahAyahs(1);
  assert.strictEqual(a.length, 7);
  await S.QuranApi.fetchSurahAyahs(1);
  assert.strictEqual(calls, 1); // من الذاكرة
  assert.ok(localStorage.store.get('quran_text_cache_v1'));
});
test('API: طلبان متزامنان لنفس السورة = طلب شبكة واحد', async () => {
  const S = load();
  let calls = 0;
  globalThis.fetch = async () => { calls++; await new Promise((r) => setTimeout(r, 10)); return { ok: true, json: async () => fakeSurahJson(1, 7) }; };
  await Promise.all([S.QuranApi.fetchSurahAyahs(1), S.QuranApi.fetchSurahAyahs(1)]);
  assert.strictEqual(calls, 1);
});
test('API: ردود غير صالحة تُرفض ولا تُخزَّن', async () => {
  const cases = {
    'عدد آيات ناقص': fakeSurahJson(1, 5),
    'سورة خاطئة': fakeSurahJson(2, 7),
    'إصدار خاطئ': fakeSurahJson(1, 7, 'other'),
    'بنية فارغة': {},
    'كود غير 200': { code: 500, data: {} },
  };
  const emptyText = fakeSurahJson(1, 7); emptyText.data.ayahs[3].text = '  ';
  cases['نص فارغ'] = emptyText;
  const badNum = fakeSurahJson(1, 7); badNum.data.ayahs[2].numberInSurah = 9;
  cases['ترقيم خاطئ'] = badNum;
  for (const [name, body] of Object.entries(cases)) {
    const S = load();
    globalThis.fetch = async () => ({ ok: true, json: async () => body });
    await assert.rejects(() => S.QuranApi.fetchSurahAyahs(1), (e) => e.code === 'invalid', name);
    assert.strictEqual(S.QuranApi.isCached(1), false, name);
    assert.strictEqual(localStorage.store.get('quran_text_cache_v1'), undefined, name);
  }
});
test('API: HTTP خطأ وانقطاع شبكة وJSON فاسد', async () => {
  let S = load();
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  await assert.rejects(() => S.QuranApi.fetchSurahAyahs(1), (e) => e.code === 'http');
  S = load();
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(() => S.QuranApi.fetchSurahAyahs(1), (e) => e.code === 'network');
  S = load();
  globalThis.fetch = async () => ({ ok: true, json: async () => { throw new SyntaxError('x'); } });
  await assert.rejects(() => S.QuranApi.fetchSurahAyahs(1), (e) => e.code === 'invalid');
});
test('API: انتهاء المهلة', async () => {
  const S = load();
  S.QuranApi.config.timeoutMs = 30;
  globalThis.fetch = (url, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('aborted'))));
  await assert.rejects(() => S.QuranApi.fetchSurahAyahs(1), (e) => e.code === 'timeout');
});
test('API: إلغاء المنتظِر عبر AbortController', async () => {
  const S = load();
  globalThis.fetch = async () => { await new Promise((r) => setTimeout(r, 30)); return { ok: true, json: async () => fakeSurahJson(1, 7) }; };
  const ac = new AbortController();
  const p = S.QuranApi.fetchSurahAyahs(1, { signal: ac.signal });
  ac.abort();
  await assert.rejects(() => p, (e) => e.code === 'aborted');
});
test('API: فشل حفظ الذاكرة لا يمنع العرض', async () => {
  const S = load({ throwSet: true });
  globalThis.fetch = async () => ({ ok: true, json: async () => fakeSurahJson(1, 7) });
  const a = await S.QuranApi.fetchSurahAyahs(1);
  assert.strictEqual(a.length, 7);
});


// ================= التفسير (طبقة الجلب والتخزين) =================
// ملاحظة: الردود هنا وهمية لاختبار المنطق فقط؛ بنية ردّ المصدر الحقيقي لم تُفحص من بيئة التطوير.
const tafsirBody = (s, a, text = `نص تفسير تجريبي ${s}:${a}`) => ({ surah: s, ayah: a, text });
const okFetch = (bodyFn) => async (url) => ({ ok: true, status: 200, json: async () => bodyFn(url) });
const parseUrl = (url) => { const m = /tafsir\/([^/]+)\/(\d+)\/(\d+)\.json/.exec(url); return { slug: m[1], s: +m[2], a: +m[3] }; };

test('تفسير: الجلب يستخدم slug كل تفسير ويخزّن بمفتاح (تفسير:سورة:آية)', async () => {
  const S = load();
  const urls = [];
  globalThis.fetch = okFetch((u) => { urls.push(u); const p = parseUrl(u); return tafsirBody(p.s, p.a); });
  const T = S.TafsirApi;
  await T.fetchTafsir('muyassar', 2, 255, { persist: true });
  await T.fetchTafsir('saadi', 2, 255, { persist: true });
  assert.ok(urls[0].includes('/ar-tafsir-muyassar/2/255.json'));
  assert.ok(urls[1].includes(T.TAFSIRS.saadi.slug + '/2/255.json'));
  const saved = JSON.parse(localStorage.store.get('sahib_tafsir_cache_v1'));
  assert.deepStrictEqual(Object.keys(saved).sort(), ['muyassar:2:255', 'saadi:2:255']);
  assert.ok(saved['muyassar:2:255'].cachedAt && saved['muyassar:2:255'].source);
  assert.notStrictEqual(saved['muyassar:2:255'].text, '');
});
test('تفسير: لا طلب ثانٍ للنص المخزّن، ويعمل بعد قطع الشبكة وإعادة التحميل', async () => {
  let S = load();
  let calls = 0;
  globalThis.fetch = okFetch((u) => { calls++; const p = parseUrl(u); return tafsirBody(p.s, p.a); });
  await S.TafsirApi.fetchTafsir('muyassar', 1, 1, { persist: true });
  await S.TafsirApi.fetchTafsir('muyassar', 1, 1);
  assert.strictEqual(calls, 1);
  // محاكاة إعادة فتح التطبيق مع بقاء localStorage ثم انقطاع الإنترنت
  const keep = new Map(localStorage.store);
  S = load({ initial: Object.fromEntries(keep) });
  globalThis.fetch = async () => { throw new TypeError('offline'); };
  const r = await S.TafsirApi.fetchTafsir('muyassar', 1, 1);
  assert.strictEqual(r.fromCache, true);
  await assert.rejects(() => S.TafsirApi.fetchTafsir('muyassar', 1, 2), (e) => e.code === 'network');
});
test('تفسير: آية غير مرتبطة بمحفوظ لا تُخزَّن محليًا (ذاكرة الجلسة فقط)', async () => {
  const S = load();
  globalThis.fetch = okFetch((u) => { const p = parseUrl(u); return tafsirBody(p.s, p.a); });
  await S.TafsirApi.fetchTafsir('saadi', 3, 7); // persist غير مفعّل
  assert.strictEqual(localStorage.store.get('sahib_tafsir_cache_v1'), undefined);
  assert.ok(S.TafsirApi.getCachedTafsir('saadi', 3, 7));
});
test('تفسير: ردود غير صالحة/فارغة/غير مطابقة تُرفض ولا تُخزَّن', async () => {
  const bodies = {
    'نص فارغ': { surah: 1, ayah: 1, text: '  ' },
    'وسوم فقط': { surah: 1, ayah: 1, text: '<br/><p></p>' },
    'سورة غير مطابقة': { surah: 2, ayah: 1, text: 'x' },
    'آية غير مطابقة': { surah: 1, ayah: 5, text: 'x' },
    'بلا نص': { surah: 1, ayah: 1 },
    'مصفوفة': []
  };
  for (const [name, body] of Object.entries(bodies)) {
    const S = load();
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => body });
    await assert.rejects(() => S.TafsirApi.fetchTafsir('muyassar', 1, 1, { persist: true }), (e) => ['invalid', 'empty'].includes(e.code), name);
    assert.strictEqual(S.TafsirApi.getCachedTafsir('muyassar', 1, 1), null, name);
    assert.strictEqual(localStorage.store.get('sahib_tafsir_cache_v1'), undefined, name);
  }
});
test('تفسير: 404 = غير متاح، HTTP، شبكة، مهلة، JSON فاسد', async () => {
  const run = async (fetchImpl, code, cfg) => {
    const S = load();
    if (cfg) cfg(S);
    globalThis.fetch = fetchImpl;
    await assert.rejects(() => S.TafsirApi.fetchTafsir('muyassar', 1, 1), (e) => e.code === code, code);
  };
  await run(async () => ({ ok: false, status: 404 }), 'notfound');
  await run(async () => ({ ok: false, status: 500 }), 'http');
  await run// ================= تنزيل القرآن والتفسير كاملين =================
function makeFakeIndexedDB() {
  const data = new Map();
  const tx = (mode) => {
    const t = { oncomplete: null, onerror: null, onabort: null };
    const done = () => setTimeout(() => t.oncomplete && t.oncomplete(), 0);
    t.objectStore = () => ({
      put(v, k) { data.set(k, v); done.pending = true; },
      clear() { data.clear(); },
      openCursor() {
        const keys = Array.from(data.keys()); let i = 0;
        const req = { result: null, onsuccess: null };
        const step = () => {
          req.result = i < keys.length ? { key: keys[i], value: data.get(keys[i]), continue() { i++; setTimeout(step, 0); } } : null;
          req.onsuccess && req.onsuccess();
          if (!req.result) done();
        };
        setTimeout(step, 0);
        return req;
      }
    });
    setTimeout(() => { if (mode === 'readwrite') t.oncomplete && t.oncomplete(); }, 0);
    return t;
  };
  return {
    data,
    open() {
      const req = { result: { createObjectStore() {}, transaction: (_n, mode) => tx(mode) }, onsuccess: null };
      setTimeout(() => { req.onupgradeneeded && req.onupgradeneeded(); req.onsuccess && req.onsuccess(); }, 0);
      return req;
    }
  };
}
function loadOffline(opts = {}) {
  globalThis.indexedDB = opts.idb;
  const S = load(opts);
  globalThis.document = { getElementById: () => null };
  require(path.join(__dirname, '..', 'js', 'offline.js'));
  return S;
}
function fakeFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const r = await handler(String(url));
    return { ok: r.status === undefined || (r.status >= 200 && r.status < 300), status: r.status || 200, json: async () => r.body };
  };
  return calls;
}
const surahOfUrl = (u, re) => { const m = re.exec(u); return m ? Number(m[1]) : NaN; };

test('downloadAllTexts: ينزّل 114 سورة، يتخطى المحفوظ، ويحفظها على الجهاز', async () => {
  const S = loadOffline({});
  const calls = fakeFetch((u) => { const n = surahOfUrl(u, /surah\/(\d+)\//); return { body: fakeSurahJson(n, S.Quran.surahByNumber(n).ayahs) }; });
  const seen = [];
  const r1 = await S.Offline.downloadAllTexts({ onProgress: (d, t) => seen.push([d, t]) });
  assert.strictEqual(r1.done, 114); assert.ok(!r1.failure && !r1.aborted && !r1.storage);
  assert.strictEqual(calls.length, 114);
  assert.strictEqual(S.QuranApi.cachedSurahCount(), 114);
  assert.strictEqual(Object.keys(S.Storage.loadTextCache()).length, 114);
  assert.deepStrictEqual(seen[seen.length - 1], [114, 114]);
  const r2 = await S.Offline.downloadAllTexts({});
  assert.strictEqual(r2.done, 114); assert.strictEqual(calls.length, 114, 'لا طلبات جديدة');
});
test('downloadAllTexts: فشل الشبكة يوقف دون ادّعاء اكتمال، والإلغاء يُحتسب', async () => {
  const S = loadOffline({});
  fakeFetch((u) => { const n = surahOfUrl(u, /surah\/(\d+)\//); if (n === 5) throw new Error('net'); return { body: fakeSurahJson(n, S.Quran.surahByNumber(n).ayahs) }; });
  const r = await S.Offline.downloadAllTexts({});
  assert.ok(r.failure && r.done < 114);
  const S2 = loadOffline({});
  fakeFetch((u) => { const n = surahOfUrl(u, /surah\/(\d+)\//); return { body: fakeSurahJson(n, S2.Quran.surahByNumber(n).ayahs) }; });
  const ctl = new AbortController(); ctl.abort();
  const r2 = await S2.Offline.downloadAllTexts({ signal: ctl.signal });
  assert.ok(r2.aborted && r2.done === 0);
});
test('downloadAllTexts: امتلاء المساحة يُبلَّغ (storage) ولا يُعدّ حفظًا ناجحًا', async () => {
  const S = loadOffline({ throwSet: true });
  fakeFetch((u) => { const n = surahOfUrl(u, /surah\/(\d+)\//); return { body: fakeSurahJson(n, S.Quran.surahByNumber(n).ayahs) }; });
  const r = await S.Offline.downloadAllTexts({});
  assert.strictEqual(r.storage, true);
});
test('parseSurahResponse: يقبل سورة كاملة، ويرفض الناقصة والمعطوبة', () => {
  const S = load();
  const mk = (n) => ({ ayahs: Array.from({ length: S.Quran.surahByNumber(n).ayahs }, (_, i) => ({ ayah: i + 1, text: `تفسير ${i + 1}` })) });
  const ok = S.TafsirApi.parseSurahResponse(mk(2), 2);
  assert.strictEqual(ok.entries.length, 286);
  assert.ok(S.TafsirApi.parseSurahResponse(Array.from({ length: 7 }, (_, i) => ({ ayah: i + 1, text: 'x' })), 1).entries.length === 7);
  const half = mk(2); half.ayahs.length = 100;
  assert.throws(() => S.TafsirApi.parseSurahResponse(half, 2), /incomplete/);
  assert.throws(() => S.TafsirApi.parseSurahResponse({ ayahs: [{ ayah: 99, text: 'x' }] }, 1), /bad ayah/);
  assert.throws(() => S.TafsirApi.parseSurahResponse({ nope: 1 }, 1), /no ayahs/);
  assert.throws(() => S.TafsirApi.parseSurahResponse({ ayahs: [{ ayah: 1, text: 5 }] }, 1), /no text/);
});
test('downloadAllTafsir: ملف السورة يُحفظ في IndexedDB ويظهر عبر getCachedTafsir/isPersisted، ويُتخطى عند الإعادة', async () => {
  const idb = makeFakeIndexedDB();
  const S = loadOffline({ idb });
  await S.TafsirApi.bulkReady;
  const calls = fakeFetch((u) => {
    const n = surahOfUrl(u, /\/(\d+)\.json$/);
    return { body: { ayahs: Array.from({ length: S.Quran.surahByNumber(n).ayahs }, (_, i) => ({ ayah: i + 1, text: `تفسير ${n}:${i + 1}` })) } };
  });
  const r = await S.Offline.downloadAllTafsir({ tafsirId: 'muyassar' });
  assert.ok(!r.failure && !r.aborted, JSON.stringify(r));
  assert.strictEqual(r.done, 114); assert.strictEqual(r.ayat, 6236); assert.strictEqual(r.viaAyah, 0);
  assert.strictEqual(calls.length, 114);
  assert.ok(calls[0].includes('/tafsir/ar-tafsir-muyassar/'));
  assert.strictEqual(S.TafsirApi.persistedCount('muyassar'), 6236);
  assert.strictEqual(S.TafsirApi.persistedCount('saadi'), 0);
  assert.strictEqual(S.TafsirApi.getCachedTafsir('muyassar', 2, 255).text, 'تفسير 2:255');
  assert.ok(S.TafsirApi.isPersisted('muyassar', 114, 6));
  assert.strictEqual(idb.data.size, 6236);
  const r2 = await S.Offline.downloadAllTafsir({ tafsirId: 'muyassar' });
  assert.strictEqual(r2.done, 114); assert.strictEqual(calls.length, 114); assert.strictEqual(r2.ayat, 0);
  const c = await S.TafsirApi.clearStore();
  assert.ok(c.ok); assert.strictEqual(S.TafsirApi.persistedCount(), 0); assert.strictEqual(idb.data.size, 0);
});
test('downloadAllTafsir: إن لم يتوفر ملف السورة يعود للجلب آية آية بالتحقق نفسه', async () => {
  const idb = makeFakeIndexedDB();
  const S = loadOffline({ idb });
  await S.TafsirApi.bulkReady;
  const calls = fakeFetch((u) => {
    if (/\/\d+\.json$/.test(u) && !/\/\d+\/\d+\.json$/.test(u)) return { status: 404, body: null };
    const m = /\/(\d+)\/(\d+)\.json$/.exec(u);
    if (Number(m[1]) === 1 && Number(m[2]) === 3) return { status: 404, body: null };
    return { body: { surah: Number(m[1]), ayah: Number(m[2]), text: `ت ${m[1]}:${m[2]}` } };
  });
  const ctl = new AbortController();
  let stopAfter = 0;
  const r = await S.Offline.downloadAllTafsir({ tafsirId: 'saadi', signal: ctl.signal, onProgress: (d) => { if (d >= 2 && !stopAfter) { stopAfter = d; ctl.abort(); } } });
  assert.ok(r.aborted, JSON.stringify(r));
  assert.ok(r.viaAyah >= 1 && r.skipped === 1, JSON.stringify(r));
  assert.ok(S.TafsirApi.isPersisted('saadi', 1, 1) && !S.TafsirApi.isPersisted('saadi', 1, 3));
  assert.ok(calls.some((u) => u.includes('/ar-tafseer-al-saddi/1/2.json')));
});
test('downloadAllTafsir: فشل الشبكة أو التخزين يوقف ويُبلَّغ بوضوح', async () => {
  const idb = makeFakeIndexedDB();
  const S = loadOffline({ idb });
  await S.TafsirApi.bulkReady;
  fakeFetch(() => { throw new Error('offline'); });
  const r = await S.Offline.downloadAllTafsir({ tafsirId: 'muyassar' });
  assert.ok(r.failure && r.failure.code === 'network' && r.done < 114);
  const S2 = loadOffline({});  // لا IndexedDB
  await S2.TafsirApi.bulkReady;
  fakeFetch((u) => { const n = surahOfUrl(u, /\/(\d+)\.json$/); return { body: { ayahs: Array.from({ length: S2.Quran.surahByNumber(n).ayahs }, (_, i) => ({ ayah: i + 1, text: 'x' })) } }; });
  const r2 = await S2.Offline.downloadAllTafsir({ tafsirId: 'muyassar' });
  assert.ok(r2.failure && r2.failure.code === 'storage'); assert.strictEqual(S2.TafsirApi.persistedCount(), 0);
});
test('التفسير المحفوظ في IndexedDB يُحمَّل عند الفتح التالي', async () => {
  const idb = makeFakeIndexedDB();
  const S = loadOffline({ idb });
  await S.TafsirApi.bulkReady;
  assert.ok((await S.TafsirApi.saveBulk('muyassar', 1, [[1, 'أ'], [2, 'ب']])).ok);
  assert.strictEqual((await S.TafsirApi.saveBulk('muyassar', 1, [[99, 'x']])).ok, false);
  const S2 = loadOffline({ idb });
  await S2.TafsirApi.bulkReady;
  assert.strictEqual(S2.TafsirApi.getCachedTafsir('muyassar', 1, 2).text, 'ب');
  assert.strictEqual(S2.TafsirApi.persistedCount('muyassar'), 2);
});

(async () => { throw new TypeError('x'); }, 'network');
  await run(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } }), 'invalid');
  await run((u, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('a')))), 'timeout', (S) => { S.TafsirApi.config.timeoutMs = 30; });
});
test('تفسير: رسائل الخطأ لا تعرض تفسيرًا بديلًا وتذكر الاسم عند عدم التوفر', () => {
  const S = load();
  const T = S.TafsirApi;
  assert.ok(T.describeError({ code: 'notfound' }, 'تفسير السعدي').includes('تفسير السعدي'));
  assert.ok(T.describeError({ code: 'notfound' }).includes('غير متاح'));
  assert.ok(T.describeError({ code: 'network' }).includes('دون اتصال'));
});
test('تفسير: امتلاء التخزين لا يمنع القراءة ويُبلَّغ بخطأ التخزين', async () => {
  const S = load({ throwSet: true });
  globalThis.fetch = okFetch((u) => { const p = parseUrl(u); return tafsirBody(p.s, p.a); });
  const r = await S.TafsirApi.fetchTafsir('muyassar', 2, 1, { persist: true });
  assert.ok(r.text);
  assert.strictEqual(r.persisted, false);
  assert.strictEqual(r.storageError, 'quota');
  assert.ok(S.TafsirApi.getCachedTafsir('muyassar', 2, 1)); // متاح في الجلسة
});
test('تفسير: طلبان متزامنان لنفس الآية = طلب واحد، وإلغاء المنتظِر لا يلغي الطلب', async () => {
  const S = load();
  let calls = 0;
  globalThis.fetch = async (u) => { calls++; await new Promise((r) => setTimeout(r, 15)); const p = parseUrl(u); return { ok: true, status: 200, json: async () => tafsirBody(p.s, p.a) }; };
  const ac = new AbortController();
  const a = S.TafsirApi.fetchTafsir('muyassar', 1, 1, { signal: ac.signal });
  const b = S.TafsirApi.fetchTafsir('muyassar', 1, 1);
  ac.abort();
  await assert.rejects(() => a, (e) => e.code === 'aborted');
  await b;
  assert.strictEqual(calls, 1);
  assert.ok(S.TafsirApi.getCachedTafsir('muyassar', 1, 1)); // وصل الردّ وخُزّن دون عرضه
});
test('تفسير: التخزين لا يُحذف بتغيير الاختيار ولا بحذف مقطع', async () => {
  const S = load();
  globalThis.fetch = okFetch((u) => { const p = parseUrl(u); return tafsirBody(p.s, p.a); });
  S.Memorization.init([]);
  const e = S.Memorization.add({ surah: 1, from: 1, to: 3 }).entry;
  await S.TafsirApi.fetchTafsir('muyassar', 1, 2, { persist: true });
  S.Settings.set('tafsirId', 'saadi');
  S.Memorization.remove(e.id);
  assert.ok(S.TafsirApi.isPersisted('muyassar', 1, 2));
});
test('تفسير: toPlainText يزيل الوسوم دون تغيير النص العربي', () => {
  const S = load();
  assert.strictEqual(S.TafsirApi.toPlainText('<p>بِسْمِ</p>اللَّهِ<br>تَتِمَّة'), 'بِسْمِ\nاللَّهِ\nتَتِمَّة');
});
test('إعدادات: افتراضي، حفظ، رفض قيم غير صالحة، حدود الخط', () => {
  let S = load();
  assert.strictEqual(S.Settings.get('tafsirId'), 'muyassar');
  S.Settings.set('tafsirId', 'saadi');
  S = load({ initial: Object.fromEntries(localStorage.store) });
  assert.strictEqual(S.Settings.get('tafsirId'), 'saadi');
  S.Settings.set('tafsirId', 'evil');
  assert.strictEqual(S.Settings.get('tafsirId'), 'muyassar');
  for (let i = 0; i < 30; i++) S.Settings.changeFont(1);
  assert.strictEqual(S.Settings.get('fontScale'), 1.8);
  S = load({ initial: { sahib_settings_v1: '{"tafsirId":5,"fontScale":"x"}' } });
  assert.strictEqual(S.Settings.get('fontScale'), 1);
  S = load({ initial: { sahib_settings_v1: '{{bad' } });
  assert.strictEqual(S.Settings.get('tafsirId'), 'muyassar');
});
test('إعدادات: فشل الحفظ يُبلَّغ ولا يمنع الاستخدام في الجلسة', () => {
  const S = load({ throwSet: true });
  const r = S.Settings.set('tafsirId', 'saadi');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(S.Settings.get('tafsirId'), 'saadi');
});

// ================= البحث والتصفية والترتيب والتعديل =================
const mkE = (o) => ({ id: o.id, surah: o.surah, surahName: o.name || '', from: o.from, to: o.to, dateAdded: o.added || '2026-10-01', lastReviewed: o.last || null, reviewCount: 0, notes: o.notes || '', mastery: null, lastRating: o.rating || null });

test('بحث: يتجاهل التشكيل وأشكال الألف والتاء المربوطة ويبحث بالآية والملاحظات', () => {
  const S = load();
  const M = S.Memorization;
  const e = mkE({ id: 'a', surah: 2, name: S.Quran.surahByNumber(2).name, from: 100, to: 120, notes: 'موضع تشابه' });
  assert.ok(M.matchesQuery(e, 'البقرة'));
  assert.ok(M.matchesQuery(e, 'بَقَرَه'));
  assert.ok(M.matchesQuery(e, 'تشابه'));
  assert.ok(M.matchesQuery(e, '110'));
  assert.ok(M.matchesQuery(e, '١١٠')); // أرقام عربية
  assert.ok(!M.matchesQuery(e, '121'));
  assert.ok(!M.matchesQuery(e, 'الكهف'));
  assert.ok(M.matchesQuery(e, '   '));
  const al = mkE({ id: 'b', surah: 3, name: S.Quran.surahByNumber(3).name, from: 1, to: 5 });
  assert.ok(M.matchesQuery(al, 'ال عمران'));
  assert.ok(M.matchesQuery(al, 'آل عمران'));
});
test('تصفية: مستحق/لم يُراجع/ضعيف/متقن', () => {
  const S = load();
  const M = S.Memorization;
  const today = '2026-10-30';
  const list = [
    mkE({ id: 'never', surah: 1, from: 1, to: 3 }),
    mkE({ id: 'fresh', surah: 1, from: 4, to: 7, last: '2026-10-29', rating: 'good' }),
    mkE({ id: 'old', surah: 2, from: 1, to: 5, last: '2026-10-01', rating: 'good' }),
    mkE({ id: 'weak', surah: 2, from: 6, to: 9, last: '2026-10-29', rating: 'soon' }),
    mkE({ id: 'ok', surah: 3, from: 1, to: 9, last: '2026-10-29', rating: 'mastered' })
  ];
  const ids = (f) => M.filterEntries(list, { query: '', filter: f }, today).map((e) => e.id).sort();
  assert.deepStrictEqual(ids('due'), ['never', 'old', 'weak']);
  assert.deepStrictEqual(ids('never'), ['never']);
  assert.deepStrictEqual(ids('weak'), ['weak']);
  assert.deepStrictEqual(ids('mastered'), ['ok']);
  assert.strictEqual(ids('all').length, 5);
});
test('ترتيب: السورة، الأحدث إضافة، الأقدم مراجعة، الأولوية (التقييم الضعيف أعلى)', () => {
  const S = load();
  const M = S.Memorization;
  const today = '2026-10-30';
  const list = [
    mkE({ id: 'c', surah: 3, from: 1, to: 2, added: '2026-10-05', last: '2026-10-29', rating: 'mastered' }),
    mkE({ id: 'a', surah: 1, from: 1, to: 2, added: '2026-10-20', last: '2026-10-20', rating: 'good' }),
    mkE({ id: 'b', surah: 2, from: 1, to: 2, added: '2026-10-10', last: '2026-10-20', rating: 'failed' }),
    mkE({ id: 'n', surah: 4, from: 1, to: 2, added: '2026-10-25' })
  ];
  const order = (k) => M.sortEntries(list, k, today).map((e) => e.id).join('');
  assert.strictEqual(order('surah'), 'abcn');
  assert.strictEqual(order('added'), 'nabc');
  assert.strictEqual(order('reviewed'), 'nabc'); // غير المراجع أولًا ثم الأقدم (والتعادل حسب السورة)
  assert.strictEqual(order('priority'), 'nbac'); // n: 365، b: 10×3=30، a: 10، c: 1×0.5
  assert.ok(M.reviewPriority(list[2], today) > M.reviewPriority(list[1], today));
});
test('تعديل: يتحقق من النطاق ويحافظ على المراجعات ويتجاهل نفسه عند فحص التداخل', () => {
  const S = load();
  const M = S.Memorization;
  M.init([]);
  const a = M.add({ surah: 2, from: 1, to: 10, notes: 'ن' }).entry;
  M.update(a.id, (e) => ({ ...e, reviewCount: 4, lastReviewed: '2026-10-29' }));
  assert.strictEqual(M.classify(M.all(), 2, 1, 12, a.id).group.length, 0); // لا تداخل مع نفسه
  assert.strictEqual(M.classify(M.all(), 2, 1, 12).group.length, 1);
  const r = M.edit(a.id, { surah: 2, from: 1, to: 12, notes: '  جديدة  ', mastery: 'strong' });
  assert.ok(r.ok);
  const e = M.find(a.id);
  assert.strictEqual(e.to, 12);
  assert.strictEqual(e.reviewCount, 4);
  assert.strictEqual(e.notes, 'جديدة');
  assert.strictEqual(e.mastery, 'strong');
  assert.strictEqual(M.edit(a.id, { surah: 2, from: 1, to: 12, mastery: 'hacker' }).entry.mastery, null);
});
test('إضافة: تاريخ البدء المستقبلي/التالف يُستبدل بتاريخ اليوم، وسجلات قديمة بلا حقول جديدة تُقرأ', () => {
  const S = load({ initial: { quran_hifz_entries_v1: JSON.stringify([{ id: 'old', surah: 1, from: 1, to: 7, dateAdded: '2026-10-01', lastReviewed: null, reviewCount: 0 }]) } });
  const e = S.Storage.loadEntries();
  assert.strictEqual(e[0].notes, '');
  assert.strictEqual(e[0].mastery, null);
  S.Memorization.init(e);
  const today = S.Utils.toLocalDateStr();
  assert.strictEqual(S.Memorization.add({ surah: 1, from: 1, to: 2, dateAdded: '2999-01-01' }).entry.dateAdded, today);
  assert.strictEqual(S.Memorization.add({ surah: 1, from: 1, to: 2, dateAdded: 'zzz' }).entry.dateAdded, today);
  assert.strictEqual(S.Memorization.add({ surah: 1, from: 1, to: 2, dateAdded: '2026-09-01' }).entry.dateAdded, '2026-09-01');
});


// ================= النسخ الاحتياطي =================
const mkEntry = (id, surah, from, to, extra = {}) => ({ id, surah, surahName: 'x', from, to, dateAdded: '2026-10-01', lastReviewed: null, reviewCount: 0, ...extra });
const goodBackup = (over = {}) => ({
  app: 'sahib', version: 1, exportedAt: '2026-10-30T10:00:00.000Z',
  entries: [mkEntry('a', 1, 1, 7), mkEntry('b', 2, 1, 10)],
  reviewLog: [{ id: 'r1', date: '2026-10-29', status: 'completed' }],
  settings: { tafsirId: 'saadi', fontScale: 1.2 },
  ...over
});

test('نسخ احتياطي: تصدير بيانات فارغة وكبيرة ثم قبولها عند الاستيراد', () => {
  let S = load();
  S.Memorization.init([]);
  let out = S.Backup.exportData();
  assert.ok(out.app === 'sahib' && out.version === 1 && out.exportedAt);
  assert.deepStrictEqual(out.entries, []);
  assert.ok(S.Backup.validate(JSON.parse(JSON.stringify(out))).ok);
  S = load();
  const big = Array.from({ length: 2000 }, (_, i) => mkEntry('e' + i, 2, 1 + (i % 100), 100 + (i % 100)));
  S.Memorization.init(big);
  out = S.Backup.exportData();
  const v = S.Backup.parseAndValidate(JSON.stringify(out));
  assert.ok(v.ok);
  assert.strictEqual(v.data.entries.length, 2000);
  assert.ok(!JSON.stringify(out).includes('tafsir_cache')); // لا نص قرآن/تفاسير في الملف
});
test('نسخ احتياطي: رفض ملفات تالفة وغير صالحة مع سبب', () => {
  const S = load();
  const B = S.Backup;
  const bad = [
    ['{not json', 'JSON'],
    ['[]', 'ليس نسخة'],
    ['null', 'ليس نسخة'],
    [JSON.stringify({ ...goodBackup(), app: 'other' }), 'ليس نسخة احتياطية من تطبيق صاحِب'],
    [JSON.stringify({ ...goodBackup(), version: 99 }), 'أحدث'],
    [JSON.stringify({ ...goodBackup(), version: 'x' }), 'إصدار'],
    [JSON.stringify({ ...goodBackup(), entries: 'no' }), 'المحفوظات'],
    [JSON.stringify(goodBackup({ entries: [mkEntry('a', 1, 1, 7), mkEntry('z', 1, 5, 99)] })), 'رقم 2'],
    [JSON.stringify(goodBackup({ entries: [mkEntry('a', 1, 1, 7), mkEntry('a', 2, 1, 7)] })), 'مكرر'],
    [JSON.stringify(goodBackup({ reviewLog: [{ id: 'r', date: 'bad' }] })), 'المراجعات'],
    [JSON.stringify(goodBackup({ settings: [] })), 'الإعدادات']
  ];
  for (const [text, reason] of bad) {
    const r = B.parseAndValidate(text);
    assert.strictEqual(r.ok, false, text.slice(0, 40));
    assert.ok(r.error.includes(reason), `${r.error} !~ ${reason}`);
  }
});
test('نسخ احتياطي: الدمج يمنع التكرار ولا يغيّر الموجود', () => {
  const S = load();
  S.Memorization.init([mkEntry('a', 1, 1, 7, { reviewCount: 5 }), mkEntry('keep', 3, 1, 5)]);
  const data = S.Backup.validate(goodBackup()).data; // a (نفس المعرف) و b (جديد) + سجل r1
  const r = S.Backup.applyMerge(data);
  assert.ok(r.ok);
  assert.strictEqual(r.added, 1);
  assert.strictEqual(r.skipped, 1);
  assert.strictEqual(S.Memorization.all().length, 3);
  assert.strictEqual(S.Memorization.find('a').reviewCount, 5); // الموجود لم يتغير
  assert.strictEqual(S.ReviewLog.all().length, 1);
  const again = S.Backup.applyMerge(data); // إعادة الدمج: لا إضافة
  assert.strictEqual(again.added, 0);
  assert.strictEqual(S.Memorization.all().length, 3);
  // نفس السورة والنطاق بمعرّف مختلف يُعدّ تكرارًا
  const dup = S.Backup.validate(goodBackup({ entries: [mkEntry('zzz', 3, 1, 5)], reviewLog: [] })).data;
  assert.strictEqual(S.Backup.planMerge(dup).toAdd.length, 0);
});
test('نسخ احتياطي: الاستبدال يحفظ نسخة أمان ويستعيد الإعدادات والسجل', () => {
  const S = load();
  S.Memorization.init([mkEntry('old', 4, 1, 5)]);
  S.Storage.saveEntries(S.Memorization.all());
  const r = S.Backup.applyReplace(S.Backup.validate(goodBackup()).data);
  assert.ok(r.ok);
  assert.deepStrictEqual(S.Memorization.all().map((e) => e.id), ['a', 'b']);
  assert.strictEqual(S.Settings.get('tafsirId'), 'saadi');
  assert.strictEqual(S.ReviewLog.all().length, 1);
  const saved = JSON.parse(localStorage.store.get('quran_hifz_entries_v1'));
  assert.strictEqual(saved.length, 2);
  const safety = JSON.parse(localStorage.store.get(r.safetyKey));
  assert.strictEqual(safety.entries[0].id, 'old'); // النسخة السابقة محفوظة
});
test('نسخ احتياطي: فشل الكتابة أثناء الاستبدال يعيد البيانات القديمة ولا يفقد شيئًا', () => {
  const S = load();
  S.Memorization.init([mkEntry('old', 4, 1, 5)]);
  S.Storage.saveEntries(S.Memorization.all());
  S.Storage.saveSettings({ tafsirId: 'muyassar', fontScale: 1 });
  // نجعل كتابة سجل المراجعات تفشل بعد نجاح كتابة المحفوظات
  const orig = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (k, v) => { if (k === 'sahib_review_log_v1') { const e = new Error('q'); e.name = 'QuotaExceededError'; throw e; } return orig(k, v); };
  const r = S.Backup.applyReplace(S.Backup.validate(goodBackup()).data);
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(S.Memorization.all().map((e) => e.id), ['old']);                 // الذاكرة
  assert.deepStrictEqual(JSON.parse(localStorage.store.get('quran_hifz_entries_v1')).map((e) => e.id), ['old']); // التخزين أُعيد
  assert.strictEqual(S.Settings.get('tafsirId'), 'muyassar');
});
test('نسخ احتياطي: لا استبدال إذا تعذّرت نسخة الأمان', () => {
  const S = load();
  S.Memorization.init([mkEntry('old', 4, 1, 5)]);
  const orig = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (k, v) => { if (k.startsWith('sahib_prebackup_')) { const e = new Error('q'); e.name = 'QuotaExceededError'; throw e; } return orig(k, v); };
  const r = S.Backup.applyReplace(S.Backup.validate(goodBackup()).data);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.stage, 'safety');
  assert.deepStrictEqual(S.Memorization.all().map((e) => e.id), ['old']);
});
test('نسخ احتياطي: استيراد نسخة بسجلات قديمة بلا الحقول الجديدة (notes/mastery) مقبول', () => {
  const S = load();
  const old = goodBackup({ entries: [{ id: 'x', surah: 1, from: 1, to: 7, dateAdded: '2026-10-01', lastReviewed: null, reviewCount: 0 }], reviewLog: undefined });
  const r = S.Backup.validate(old);
  assert.ok(r.ok);
  assert.strictEqual(r.data.entries[0].notes, '');
});

// ================= بيانات السور =================
test('بيانات السور: 114 سورة و6236 آية وأرقام متسلسلة', () => {
  const S = load();
  assert.strictEqual(S.Quran.SURAHS.length, 114);
  assert.strictEqual(S.Quran.TOTAL_AYAHS, 6236);
  assert.ok(S.Quran.SURAHS.every((s, i) => s.n === i + 1));
});


// ================= الإصدار 1.3: جدولة، نشاط، إعدادات، ملفات العمل دون اتصال =================
function loadPlan() {
  const S = load();
  require(path.join(__dirname, '..', 'js', 'plan.js'));
  return S;
}
function entry(S, o) {
  return S.Storage.normalizeEntry({ id: 'e' + Math.random(), surah: 112, surahName: 'الإخلاص', from: 1, to: 4, dateAdded: '2026-10-01', lastReviewed: null, reviewCount: 0, ...o });
}

test('addDays وweekdayName: عبور الشهر والسنة والسنة الكبيسة وتواريخ غير صالحة', () => {
  const S = load();
  assert.strictEqual(S.Utils.addDays('2026-10-30', 3), '2026-11-02');
  assert.strictEqual(S.Utils.addDays('2026-12-31', 1), '2027-01-01');
  assert.strictEqual(S.Utils.addDays('2028-02-28', 1), '2028-02-29');
  assert.strictEqual(S.Utils.addDays('2026-03-01', -1), '2026-02-28');
  assert.strictEqual(S.Utils.addDays('bad', 1), null);
  assert.ok(S.Utils.weekdayName('2026-11-01').length > 2 && S.Utils.weekdayName('x') === '');
});

test('الإعدادات: القيم الجديدة تُنقّى، والمدخلات الفاسدة ترجع للافتراضي، وإعادة الضبط لا تمس غيرها', () => {
  const S = load();
  const d = S.Settings.sanitize({ dailyGoal: 0, weeklyGoal: 'x', sessionSize: 99, holdMs: 100, defaultSort: 'zzz', intervals: { good: 0, mastered: 400, soon: 3.5 } });
  assert.strictEqual(d.dailyGoal, 3); assert.strictEqual(d.weeklyGoal, 15); assert.strictEqual(d.sessionSize, 3);
  assert.strictEqual(d.holdMs, 500); assert.strictEqual(d.defaultSort, 'surah');
  assert.deepStrictEqual(d.intervals, { mastered: 14, good: 7, soon: 2, failed: 1, unrated: 7 });
  const ok = S.Settings.sanitize({ dailyGoal: 5, holdMs: 620, intervals: { good: 10 } });
  assert.strictEqual(ok.dailyGoal, 5); assert.strictEqual(ok.holdMs, 600); assert.strictEqual(ok.intervals.good, 10);
  S.Settings.set('dailyGoal', 9);
  assert.strictEqual(S.Settings.get('dailyGoal'), 9);
  const before = globalThis.localStorage.getItem('quran_hifz_entries_v1');
  assert.ok(S.Settings.reset().ok);
  assert.strictEqual(S.Settings.get('dailyGoal'), 3);
  assert.strictEqual(globalThis.localStorage.getItem('quran_hifz_entries_v1'), before);
});

test('الجدولة: موعد المراجعة حسب آخر تقييم والفترات، ومقطع لم يُراجع يُستحق من يوم إضافته', () => {
  const S = loadPlan();
  const today = '2026-11-01';
  const mk = (rating, last) => entry(S, { lastRating: rating, lastReviewed: last });
  assert.strictEqual(S.Plan.dueDate(mk('mastered', '2026-10-25'), today), '2026-11-08'); // +14
  assert.strictEqual(S.Plan.dueDate(mk('good', '2026-10-25'), today), '2026-11-01');     // +7
  assert.strictEqual(S.Plan.dueDate(mk('soon', '2026-10-30'), today), '2026-11-01');     // +2
  assert.strictEqual(S.Plan.dueDate(mk('failed', '2026-10-31'), today), '2026-11-01');   // +1
  assert.strictEqual(S.Plan.dueDate(mk(null, '2026-10-28'), today), '2026-11-04');       // بلا تقييم +7
  assert.strictEqual(S.Plan.dueDate(entry(S, { dateAdded: '2026-10-20' }), today), '2026-10-20');
  assert.strictEqual(S.Plan.dueDate(entry(S, { dateAdded: undefined }), today) <= today, true);
  // فترات مخصصة
  assert.strictEqual(S.Plan.dueDate(mk('good', '2026-10-25'), today, { ...S.Settings.DEFAULT_INTERVALS, good: 3 }), '2026-10-28');
});

test('الجدولة: المستحقة/المتأخرة/القادمة والترتيب وطابور الجلسة بالحجم', () => {
  const S = loadPlan();
  const today = '2026-11-01';
  const a = entry(S, { id: 'a', surah: 1, from: 1, to: 7, lastRating: 'good', lastReviewed: '2026-10-20' }); // متأخرة 4
  const b = entry(S, { id: 'b', surah: 2, from: 1, to: 5, lastRating: 'soon', lastReviewed: '2026-10-30' }); // اليوم
  const c = entry(S, { id: 'c', surah: 3, from: 1, to: 5, lastRating: 'mastered', lastReviewed: '2026-10-30' }); // +12
  const d = entry(S, { id: 'd', surah: 4, from: 1, to: 5, lastRating: 'failed', lastReviewed: '2026-10-25' }); // متأخرة 5
  const items = S.Plan.schedule([a, b, c, d], today);
  assert.deepStrictEqual(items.map((i) => i.entry.id), ['d', 'a', 'b', 'c']);
  assert.deepStrictEqual(items.map((i) => i.bucket), ['overdue', 'overdue', 'today', 'upcoming']);
  const ids = (w) => S.Plan.filterSchedule(items, w).map((i) => i.entry.id);
  assert.deepStrictEqual(ids('due'), ['d', 'a', 'b']);
  assert.deepStrictEqual(ids('overdue'), ['d', 'a']);
  assert.deepStrictEqual(ids('upcoming'), ['c']);
  assert.deepStrictEqual(ids('all'), ['d', 'a', 'b', 'c']);
  assert.deepStrictEqual(S.Plan.buildQueue([a, b, c, d], today, 2).map((e) => e.id), ['d', 'a']);
  assert.deepStrictEqual(S.Plan.buildQueue([c], today, 3), []);
});

test('المراجعة العشوائية: لا تكرار حتى استنفاد المقاطع، ولا يتكرر الأخير عند دورة جديدة، وتتحمل الحذف', () => {
  const S = loadPlan();
  const list = ['x', 'y', 'z', 'w'].map((id) => entry(S, { id }));
  let seed = 7; const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const pick = S.Plan.createRandomPicker(rng);
  const first = [pick(list).id, pick(list).id, pick(list).id, pick(list).id];
  assert.strictEqual(new Set(first).size, 4);
  const next = pick(list).id;
  assert.notStrictEqual(next, first[3]);
  const only = [list[0]];
  assert.strictEqual(S.Plan.createRandomPicker(rng)(only).id, 'x');
  assert.strictEqual(pick([]), null);
  const p2 = S.Plan.createRandomPicker(rng); p2(list);
  assert.ok(p2(list.slice(0, 1)));
});

test('الإحصائيات: نشاط آخر 7 أيام يعدّ المكتملة فقط داخل الفترة، وتعريف المتقن الجديد', () => {
  const S = load();
  const today = '2026-11-01';
  const log = [
    { id: '1', status: 'completed', date: '2026-11-01' }, { id: '2', status: 'completed', date: '2026-11-01' },
    { id: '3', status: 'completed', date: '2026-10-26' }, { id: '4', status: 'completed', date: '2026-10-25' },
    { id: '5', status: 'abandoned', date: '2026-10-31' }, { id: '6', status: 'completed', date: '2026-11-02' }
  ];
  const entries = [
    entry(S, { id: 'm1', lastRating: 'mastered' }), entry(S, { id: 'm2', mastery: 'strong' }),
    entry(S, { id: 'm3', mastery: 'strong', lastRating: 'failed' }), entry(S, { id: 'm4' })
  ];
  const st = S.Stats.compute(entries, log, today);
  assert.strictEqual(st.activity.length, 7);
  assert.strictEqual(st.activity[0].date, '2026-10-26'); assert.strictEqual(st.activity[6].date, today);
  assert.deepStrictEqual(st.activity.map((d) => d.count), [1, 0, 0, 0, 0, 0, 2]);
  assert.strictEqual(st.todayCount, 2); assert.strictEqual(st.last7Count, 3);
  assert.strictEqual(st.masteredByRating, 2);
});

test('العمل دون اتصال: قائمة ملفات sw.js تطابق سكربتات index.html وكلها موجودة، ولا manifest', () => {
  const fs = require('fs');
  const root = path.join(__dirname, '..');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const list = /SHELL_FILES = \[([\s\S]*?)\];/.exec(sw)[1].match(/'([^']+)'/g).map((x) => x.slice(1, -1));
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  const css = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
  for (const f of [...scripts, ...css, 'index.html']) assert.ok(list.includes(f), 'ناقص من sw.js: ' + f);
  for (const f of list) if (f !== './') assert.ok(fs.existsSync(path.join(root, f)), 'غير موجود: ' + f);
  assert.ok(!/rel="manifest"/.test(html));
});

test('نسخة احتياطية قديمة بإعدادات قديمة (بلا الحقول الجديدة) تُقبل وتكتمل بالافتراضي', () => {
  const S = load();
  const r = S.Backup.parseAndValidate(JSON.stringify({ app: 'sahib', version: 1, exportedAt: '2026-10-01T00:00:00Z', entries: [], reviewLog: [], settings: { tafsirId: 'saadi', fontScale: 1.2 } }));
  assert.ok(r.ok, JSON.stringify(r));
  const clean = S.Settings.sanitize(r.data.settings);
  assert.strictEqual(clean.tafsirId, 'saadi'); assert.strictEqual(clean.dailyGoal, 3);
});


test('البسملة: تُفصل عن الآية الأولى لكل السور عدا الفاتحة والتوبة، وبأشكال تشكيل مختلفة، دون المساس بغيرها', () => {
  const S = load();
  const B1 = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';
  const B2 = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
  const r = S.QuranApi.splitBasmala(2, 1, `${B1} الٓمٓ`);
  assert.deepStrictEqual(r, { text: 'الٓمٓ', basmala: true });
  assert.strictEqual(S.QuranApi.splitBasmala(112, 1, `${B2} قُلْ هُوَ اللَّهُ أَحَدٌ`).text, 'قُلْ هُوَ اللَّهُ أَحَدٌ');
  assert.strictEqual(S.QuranApi.splitBasmala(1, 1, B1).basmala, false);          // الفاتحة: آيتها الأولى
  assert.strictEqual(S.QuranApi.splitBasmala(9, 1, 'بَرَآءَةٌ مِّنَ ٱللَّهِ وَرَسُولِهِۦٓ').basmala, false);
  assert.strictEqual(S.QuranApi.splitBasmala(2, 2, `${B1} x y`).basmala, false);   // ليست الآية الأولى
  assert.strictEqual(S.QuranApi.splitBasmala(2, 1, 'الٓمٓ ذَٰلِكَ ٱلۡكِتَٰبُ لَا رَيۡبَۛ').basmala, false);
  assert.strictEqual(S.QuranApi.splitBasmala(2, 1, B1).basmala, false);            // لا نترك آية فارغة
});

(async () => {
  for (const { name, fn } of queue) {
    try { await fn(); passed++; console.log('  ✓', name); }
    catch (e) { failed++; console.log('  ✗', name, '\n     ', e.message); }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
