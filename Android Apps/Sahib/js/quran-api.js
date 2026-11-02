/*
 * quran-api.js — جلب نص السور من Al Quran Cloud مع تحقق صارم.
 *
 * - لا يُدرج في الذاكرة (ولا في التخزين) إلا ردّ تم التحقق منه بالكامل.
 * - أخطاء الطلب تحمل code واضحًا: network | timeout | http | invalid | aborted.
 * - لا يوجد مصدر بديل عمدًا: لا نستبدل النص القرآني بمصدر غير موثوق عند تعطل الأساسي.
 */
(function (g) {
  'use strict';
  const NS = (g.Sahib = g.Sahib || {});
  const { Quran, Storage } = NS;

  const config = {
    baseUrl: 'https://api.alquran.cloud/v1',
    edition: 'quran-uthmani',
    timeoutMs: 15000
  };

  let textCache = Storage.loadTextCache(); // رقم السورة -> مصفوفة نصوص آيات (تم التحقق منها)
  const inflight = new Map(); // رقم السورة -> Promise مشتركة لتفادي الطلبات المكررة

  class ApiError extends Error {
    constructor(code, message) {
      super(message || code);
      this.name = 'ApiError';
      this.code = code;
    }
  }

  // التحقق من بنية الردّ وأنه فعلًا السورة المطلوبة بعدد آياتها وترقيمها الصحيح.
  function validatePayload(json, surahNum) {
    const s = Quran.surahByNumber(surahNum);
    const d = json && json.data;
    if (!s || !json || json.code !== 200 || !d) throw new ApiError('invalid', 'bad envelope');
    if (d.number !== surahNum) throw new ApiError('invalid', 'wrong surah');
    if (d.edition && d.edition.identifier && d.edition.identifier !== config.edition) {
      throw new ApiError('invalid', 'wrong edition');
    }
    if (!Array.isArray(d.ayahs) || d.ayahs.length !== s.ayahs) throw new ApiError('invalid', 'ayah count mismatch');
    return d.ayahs.map((a, i) => {
      if (!a || typeof a.text !== 'string' || !a.text.trim() || a.numberInSurah !== i + 1) {
        throw new ApiError('invalid', `bad ayah at ${i + 1}`);
      }
      return a.text;
    });
  }

  async function requestSurah(surahNum) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, config.timeoutMs);
    try {
      let res;
      try {
        res = await fetch(`${config.baseUrl}/surah/${surahNum}/${config.edition}`, { signal: controller.signal });
      } catch (e) {
        throw new ApiError(timedOut ? 'timeout' : 'network');
      }
      if (!res.ok) throw new ApiError('http', `HTTP ${res.status}`);
      let json;
      try {
        json = await res.json();
      } catch (e) {
        throw timedOut ? new ApiError('timeout') : new ApiError('invalid', 'not json');
      }
      return validatePayload(json, surahNum);
    } finally {
      clearTimeout(timer);
    }
  }

  // انتظار الوعد مع إمكانية إلغاء المنتظِر فقط (الطلب المشترك يكمل ويملأ الذاكرة).
  function waitWithAbort(promise, signal) {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(new ApiError('aborted'));
    return new Promise((resolve, reject) => {
      const onAbort = () => reject(new ApiError('aborted'));
      signal.addEventListener('abort', onAbort, { once: true });
      promise.then(
        (v) => { signal.removeEventListener('abort', onAbort); resolve(v); },
        (e) => { signal.removeEventListener('abort', onAbort); reject(e); }
      );
    });
  }

  // يعيد مصفوفة نصوص آيات السورة (الفهرس 0 = الآية 1).
  async function fetchSurahAyahs(surahNum, options) {
    const signal = options && options.signal;
    if (signal && signal.aborted) throw new ApiError('aborted');
    if (textCache[surahNum]) return textCache[surahNum];

    let pending = inflight.get(surahNum);
    if (!pending) {
      pending = requestSurah(surahNum)
        .then((ayahs) => {
          textCache[surahNum] = ayahs;
          // فشل حفظ الذاكرة (امتلاء المساحة مثلًا) لا يمنع العرض؛ تبقى النسخة في الذاكرة المؤقتة للجلسة.
          Storage.saveTextCache(textCache);
          return ayahs;
        })
        .finally(() => inflight.delete(surahNum));
      inflight.set(surahNum, pending);
    }
    return waitWithAbort(pending, signal);
  }

  function isCached(surahNum) {
    return !!textCache[surahNum];
  }

  function cachedSurahCount() {
    return Object.keys(textCache).length;
  }

  // مسح ذاكرة النصوص المحفوظة فقط (لا يمس المحفوظات). يعيد نتيجة الكتابة.
  function clearCache() {
    const res = Storage.saveTextCache({});
    if (res.ok) textCache = {};
    return res;
  }

  // المصدر يلصق البسملة في أول آية من كل سورة (عدا الفاتحة والتوبة). في المصحف تُكتب البسملة سطرًا مستقلًا فوق السورة،
  // فنفصلها عن نص الآية الأولى للعرض فقط (النص المخزَّن يبقى كما وصل). الفاتحة: البسملة آيتها الأولى فلا تُفصل.
  const BASMALA = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';
  function splitBasmala(surah, ayah, text) {
    const plain = { text, basmala: false };
    if (ayah !== 1 || surah === 1 || surah === 9 || typeof text !== 'string') return plain;
    const norm = NS.Memorization.normalizeArabic;
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= 4 || norm(words.slice(0, 4).join(' ')) !== norm(BASMALA)) return plain;
    return { text: words.slice(4).join(' '), basmala: true };
  }

  NS.QuranApi = { config, ApiError, fetchSurahAyahs, isCached, validatePayload, cachedSurahCount, clearCache, splitBasmala, BASMALA };
})(globalThis);
