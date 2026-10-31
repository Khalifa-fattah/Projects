import { surahByNumber, TOTAL_QURAN_AYAHS } from './quran-data.js';

export const QURAN_SOURCE = Object.freeze({
  api: 'https://api.alquran.cloud/v1',
  edition: 'quran-uthmani',
  localData: './data/quran-uthmani.json',
  localMeta: './data/quran-uthmani.meta.json',
});

export class QuranDataError extends Error {
  constructor(message, code = 'quran-data') {
    super(message);
    this.name = 'QuranDataError';
    this.code = code;
  }
}

function validateAyahArray(ayahs, surahNumber) {
  const surah = surahByNumber(surahNumber);
  if (!surah || !Array.isArray(ayahs) || ayahs.length !== surah.ayahs) {
    throw new QuranDataError('بيانات السورة ناقصة أو عدد آياتها غير مطابق.', 'invalid-shape');
  }
  return ayahs.map((ayah, index) => {
    const text = typeof ayah === 'string' ? ayah : ayah?.text;
    const number = typeof ayah === 'string' ? index + 1 : ayah?.number;
    if (number !== index + 1 || typeof text !== 'string' || !text.trim()) {
      throw new QuranDataError(`الآية ${index + 1} غير صالحة أو في غير موضعها.`, 'invalid-ayah');
    }
    return text;
  });
}

async function sha256Hex(text) {
  if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') return null;
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class QuranApi {
  constructor({ storage = null, fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
    this.storage = storage;
    this.fetchImpl = fetchImpl.bind(globalThis);
    this.timeoutMs = timeoutMs;
    this.localPromise = null;
    this.textCache = null;
    this.lastCacheWarning = null;
  }

  getLegacyCache() {
    if (this.textCache) return this.textCache;
    try { this.textCache = this.storage?.loadTextCache() || {}; }
    catch { this.textCache = {}; }
    return this.textCache;
  }

  async fetchJson(url, signal) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('timeout'), this.timeoutMs);
    const abort = () => controller.abort(signal?.reason || 'cancelled');
    if (signal?.aborted) abort();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const response = await this.fetchImpl(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new QuranDataError(`تعذر تحميل النص (HTTP ${response.status}).`, 'http');
      try { return await response.json(); }
      catch { throw new QuranDataError('وصل رد غير صالح من مصدر النص.', 'invalid-json'); }
    } catch (error) {
      if (error instanceof QuranDataError) throw error;
      if (controller.signal.aborted) {
        throw new QuranDataError(signal?.aborted ? 'أُلغي الطلب.' : 'انتهت مهلة تحميل النص. حاول مجددًا.', signal?.aborted ? 'aborted' : 'timeout');
      }
      throw new QuranDataError('تعذر الاتصال بمصدر النص. تحقق من الإنترنت أو استخدم نسخة مخزنة.', 'network');
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }

  async fetchText(url, signal) {
    const response = await this.fetchImpl(url, { signal });
    if (!response.ok) throw new QuranDataError('ملف النص المحلي غير متاح.', 'local-http');
    return response.text();
  }

  async loadLocalQuran(signal) {
    if (this.localPromise) return this.localPromise;
    this.localPromise = (async () => {
      const meta = await this.fetchJson(QURAN_SOURCE.localMeta, signal);
      if (meta?.available === false) {
        throw new QuranDataError('لا توجد قاعدة نص محلية مضمّنة في هذا الإصدار.', 'local-unavailable');
      }
      if (meta?.available !== true || meta?.edition !== QURAN_SOURCE.edition || meta?.surahs !== 114 || meta?.ayahs !== TOTAL_QURAN_AYAHS
        || typeof meta?.sha256 !== 'string') {
        throw new QuranDataError('بيانات تعريف النص المحلي غير مطابقة.', 'local-meta');
      }
      const raw = await this.fetchText(QURAN_SOURCE.localData, signal);
      const digest = await sha256Hex(raw);
      if (digest && digest !== meta.sha256) throw new QuranDataError('فشل التحقق من سلامة ملف النص المحلي.', 'checksum');
      let data;
      try { data = JSON.parse(raw); }
      catch { throw new QuranDataError('ملف النص المحلي تالف.', 'local-json'); }
      if (!Array.isArray(data?.surahs) || data.surahs.length !== 114) {
        throw new QuranDataError('ملف النص المحلي لا يحتوي السور الكاملة.', 'local-shape');
      }
      let total = 0;
      data.surahs.forEach((surah, index) => {
        if (surah.number !== index + 1) throw new QuranDataError('ترتيب السور في الملف المحلي غير صالح.', 'local-order');
        validateAyahArray(surah.ayahs, surah.number);
        total += surah.ayahs.length;
      });
      if (total !== TOTAL_QURAN_AYAHS) throw new QuranDataError('مجموع الآيات المحلية غير مطابق.', 'local-count');
      return data;
    })();
    try { return await this.localPromise; }
    catch (error) {
      if (error.code !== 'local-unavailable') this.localPromise = null;
      throw error;
    }
  }

  async getSurahAyahs(surahNumber, { signal, preferLocal = true } = {}) {
    const surah = surahByNumber(surahNumber);
    if (!surah) throw new QuranDataError('رقم السورة غير صالح.', 'surah');
    let localError = null;
    if (preferLocal) {
      try {
        const quran = await this.loadLocalQuran(signal);
        const record = quran.surahs[surahNumber - 1];
        return validateAyahArray(record.ayahs, surahNumber);
      } catch (error) {
        if (error.code === 'aborted') throw error;
        localError = error;
      }
    }

    const cached = this.getLegacyCache()[surahNumber];
    if (cached) {
      try { return validateAyahArray(cached, surahNumber); }
      catch { /* لا تُستخدم نسخة مخزنة ناقصة أو غير مطابقة. */ }
    }

    if (globalThis.navigator?.onLine === false) {
      throw new QuranDataError('هذه السورة غير متاحة محليًا، ولا يوجد اتصال لجلبها.', 'offline-missing');
    }

    const json = await this.fetchJson(`${QURAN_SOURCE.api}/surah/${surahNumber}/${QURAN_SOURCE.edition}`, signal);
    if (json?.code !== 200 || json?.data?.number !== surahNumber || !Array.isArray(json?.data?.ayahs)) {
      throw new QuranDataError('رد مصدر النص لا يطابق السورة المطلوبة.', 'api-shape');
    }
    const apiAyahs = json.data.ayahs.map((ayah) => ({ number: ayah.numberInSurah, text: ayah.text }));
    const verified = validateAyahArray(apiAyahs, surahNumber);
    const cache = this.getLegacyCache();
    cache[surahNumber] = verified;
    try { this.storage?.saveTextCache(cache); }
    catch { this.lastCacheWarning = 'عُرض النص، لكن تعذر حفظ نسخة منه للاستخدام دون اتصال.'; }
    return verified;
  }

  async getRange(surahNumber, from, to, options = {}) {
    const surah = surahByNumber(surahNumber);
    if (!surah || !Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > surah.ayahs) {
      throw new QuranDataError('نطاق الآيات المطلوب غير صالح.', 'range');
    }
    const ayahs = await this.getSurahAyahs(surahNumber, options);
    return ayahs.slice(from - 1, to).map((text, index) => ({ number: from + index, text }));
  }
}
