/*
 * storage.js — طبقة التخزين المحلي (localStorage).
 *
 * قواعد حماية البيانات:
 *  - مفاتيح التخزين القديمة لم تتغير (quran_hifz_entries_v1 / quran_text_cache_v1).
 *  - لا نستبدل بيانات تالفة بقائمة فارغة بصمت: تُنسخ البيانات الأصلية إلى مفتاح
 *    احتياطي ويُمنع الحفظ فوق المفتاح الأصلي حتى يقرر المستخدم المتابعة.
 *  - كل عملية كتابة تعيد { ok, reason } ولا يُعرض نجاح إلا إذا نجحت فعلًا.
 *
 * حدود الحماية: localStorage غير مشفّر ويمكن لأي شيفرة تعمل في نفس الأصل قراءته
 * أو تعديله، وللمستخدم مسحه من إعدادات المتصفح. هو ليس مخزنًا محميًا.
 */
(function (g) {
  'use strict';
  const NS = (g.Sahib = g.Sahib || {});
  const { Quran, Utils } = NS;

  const KEYS = Object.freeze({
    entries: 'quran_hifz_entries_v1',
    cache: 'quran_text_cache_v1',
    theme: 'quran_theme_v1',
    reviewLog: 'sahib_review_log_v1',
    settings: 'sahib_settings_v1',
    tafsirCache: 'sahib_tafsir_cache_v1'
  });

  // قيم الحقول الاختيارية الجديدة في سجل المقطع (مستوى الإتقان بتقدير المستخدم، ونتيجة آخر مراجعة).
  const MASTERY = Object.freeze(['weak', 'medium', 'strong']);
  const RATINGS = Object.freeze(['mastered', 'good', 'soon', 'failed']);

  // blocked[key] = true يعني: لا تكتب فوق هذا المفتاح (بيانات تالفة لم يقرر المستخدم بشأنها).
  const blocked = {};
  // ملاحظات للواجهة عن حالة آخر تحميل.
  const issues = { unavailable: false, corrupt: [], invalid: [] };

  // ---------- عمليات خام آمنة ----------
  function rawGet(key) {
    try {
      return { ok: true, value: localStorage.getItem(key) };
    } catch (error) {
      return { ok: false, reason: 'unavailable', error };
    }
  }

  function isQuotaError(e) {
    return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
  }

  function rawSet(key, text) {
    try {
      localStorage.setItem(key, text);
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: isQuotaError(error) ? 'quota' : 'unavailable', error };
    }
  }

  function describeError(result) {
    if (!result || result.ok) return '';
    switch (result.reason) {
      case 'blocked':
        return 'تعذّر الحفظ: بياناتك المخزّنة تالفة ولم نكتب فوقها. اختر المتابعة من التنبيه أعلى الصفحة أولًا.';
      case 'quota':
        return 'تعذّر الحفظ: مساحة التخزين في المتصفح ممتلئة.';
      default:
        return 'تعذّر الحفظ: التخزين المحلي غير متاح (ربما بسبب وضع التصفح الخاص).';
    }
  }

  // ---------- قراءة مصفوفة JSON مع نسخ احتياطي عند التلف ----------
  function readJsonArray(key) {
    const got = rawGet(key);
    if (!got.ok) {
      issues.unavailable = true;
      return { items: [], ok: false };
    }
    if (got.value == null) return { items: [], ok: true };
    let parsed;
    try {
      parsed = JSON.parse(got.value);
    } catch (e) {
      parsed = undefined;
    }
    if (!Array.isArray(parsed)) {
      const backupKey = `${key}_corrupt_${Date.now()}`;
      const saved = rawSet(backupKey, got.value);
      // إن فشل النسخ الاحتياطي نترك المفتاح الأصلي كما هو ونمنع الكتابة فوقه في كل الأحوال.
      blocked[key] = true;
      issues.corrupt.push({ key, backupKey: saved.ok ? backupKey : null });
      return { items: [], ok: false };
    }
    return { items: parsed, ok: true };
  }

  // ---------- سجلات المحفوظات ----------
  // يتحقق من سجل واحد ويعيد نسخة نظيفة أو null. الحقول الإضافية غير المعروفة تُحفظ.
  function normalizeEntry(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const surah = Number(raw.surah);
    const s = Number.isInteger(surah) ? Quran.surahByNumber(surah) : undefined;
    if (!s) return null;
    const from = Number(raw.from), to = Number(raw.to);
    if (!Number.isInteger(from) || !Number.isInteger(to)) return null;
    if (from < 1 || to < from || to > s.ayahs) return null;
    const count = Number(raw.reviewCount);
    return {
      ...raw,
      id: typeof raw.id === 'string' && raw.id ? raw.id : Utils.generateId('e'),
      surah,
      surahName: s.name,
      from,
      to,
      dateAdded: Utils.isValidDateStr(raw.dateAdded) ? raw.dateAdded : null,
      lastReviewed: Utils.isValidDateStr(raw.lastReviewed) ? raw.lastReviewed : null,
      reviewCount: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0,
      notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 500) : '',
      mastery: MASTERY.includes(raw.mastery) ? raw.mastery : null,
      lastRating: RATINGS.includes(raw.lastRating) ? raw.lastRating : null
    };
  }

  function loadEntries() {
    const { items } = readJsonArray(KEYS.entries);
    const good = [];
    const bad = [];
    const seen = new Set();
    for (const raw of items) {
      const entry = normalizeEntry(raw);
      if (!entry) {
        bad.push(raw);
        continue;
      }
      if (seen.has(entry.id)) entry.id = Utils.generateId('e');
      seen.add(entry.id);
      good.push(entry);
    }
    if (bad.length) {
      const backupKey = `${KEYS.entries}_invalid_${Date.now()}`;
      const saved = rawSet(backupKey, JSON.stringify(bad));
      // إن تعذّر حفظ نسخة من السجلات غير الصالحة نمنع الكتابة حتى لا تضيع بصمت.
      if (!saved.ok) blocked[KEYS.entries] = true;
      issues.invalid.push({ key: KEYS.entries, count: bad.length, backupKey: saved.ok ? backupKey : null });
    }
    return good;
  }

  function saveEntries(entries) {
    if (blocked[KEYS.entries]) return { ok: false, reason: 'blocked' };
    return rawSet(KEYS.entries, JSON.stringify(entries));
  }

  // ---------- سجل المراجعات (مستقل عن نطاقات الحفظ) ----------
  function normalizeLogRecord(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (typeof raw.id !== 'string' || !raw.id) return null;
    if (!Utils.isValidDateStr(raw.date)) return null;
    return raw;
  }

  function loadReviewLog() {
    const { items } = readJsonArray(KEYS.reviewLog);
    return items.map(normalizeLogRecord).filter(Boolean);
  }

  function saveReviewLog(log) {
    if (blocked[KEYS.reviewLog]) return { ok: false, reason: 'blocked' };
    return rawSet(KEYS.reviewLog, JSON.stringify(log));
  }

  // ---------- ذاكرة نصوص القرآن ----------
  // الشكل المخزَّن: { "<رقم السورة>": ["نص الآية 1", "نص الآية 2", ...] }
  function loadTextCache() {
    const got = rawGet(KEYS.cache);
    if (!got.ok || got.value == null) return {};
    let parsed;
    try {
      parsed = JSON.parse(got.value);
    } catch (e) {
      return {}; // الذاكرة قابلة لإعادة الجلب من المصدر، فلا حاجة لنسخ احتياطي.
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const clean = {};
    for (const [k, v] of Object.entries(parsed)) {
      const s = Quran.surahByNumber(Number(k));
      // نقبل السورة فقط إن كان عدد آياتها مطابقًا وكل نص غير فارغ.
      if (s && Array.isArray(v) && v.length === s.ayahs && v.every((t) => typeof t === 'string' && t.trim())) {
        clean[k] = v;
      }
    }
    return clean;
  }

  function saveTextCache(cache) {
    return rawSet(KEYS.cache, JSON.stringify(cache));
  }

  // ---------- ذاكرة التفاسير (مفصولة عن المحفوظات) ----------
  // الشكل: { "<tafsirId>:<سورة>:<آية>": { tafsirId, surahNumber, ayahNumber, text, cachedAt, source } }
  // قابلة لإعادة الجلب من المصدر، لذا يُهمل التالف منها دون نسخ احتياطي.
  function loadTafsirCache() {
    const got = rawGet(KEYS.tafsirCache);
    if (!got.ok || got.value == null) return {};
    let parsed;
    try {
      parsed = JSON.parse(got.value);
    } catch (e) {
      return {};
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const clean = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v === 'object' && typeof v.tafsirId === 'string' &&
          Number.isInteger(v.surahNumber) && Number.isInteger(v.ayahNumber) &&
          typeof v.text === 'string' && v.text.trim() &&
          k === `${v.tafsirId}:${v.surahNumber}:${v.ayahNumber}`) {
        clean[k] = v;
      }
    }
    return clean;
  }

  function saveTafsirCache(cache) {
    return rawSet(KEYS.tafsirCache, JSON.stringify(cache));
  }

  // ---------- الإعدادات ----------
  // تُرجع كائنًا خامًا؛ التحقق من القيم يتم في settings.js.
  function loadSettings() {
    const got = rawGet(KEYS.settings);
    if (!got.ok || got.value == null) return {};
    try {
      const parsed = JSON.parse(got.value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function saveSettings(settings) {
    return rawSet(KEYS.settings, JSON.stringify(settings));
  }

  // ---------- المظهر ----------
  function getTheme() {
    const got = rawGet(KEYS.theme);
    return got.ok && got.value === 'dark' ? 'dark' : 'light';
  }

  function setTheme(theme) {
    return rawSet(KEYS.theme, theme === 'dark' ? 'dark' : 'light');
  }

  // المستخدم اختار المتابعة بعد اكتشاف بيانات تالفة: نسمح بالكتابة (النسخة الأصلية تبقى في المفتاح الاحتياطي).
  function allowWritesFor(key) {
    blocked[key] = false;
  }

  NS.Storage = {
    KEYS, issues, MASTERY, RATINGS,
    loadTafsirCache, saveTafsirCache, loadSettings, saveSettings,
    normalizeEntry, loadEntries, saveEntries,
    loadReviewLog, saveReviewLog,
    loadTextCache, saveTextCache,
    getTheme, setTheme,
    describeError, allowWritesFor, rawGet, rawSet
  };
})(globalThis);
