/*
 * settings.js — إعدادات التطبيق المحفوظة (مفتاح مستقل sahib_settings_v1، لا يمس المحفوظات).
 * كل القيم تُنقّى عند القراءة والكتابة: قيمة غير صالحة تعود إلى الافتراضي.
 */
(function (g) {
  'use strict';
  const NS = (g.Sahib = g.Sahib || {});
  const { Storage, TafsirApi } = NS;

  const FONT_MIN = 0.8, FONT_MAX = 1.8, FONT_STEP = 0.1;
  const SORTS = Object.freeze(['surah', 'added', 'reviewed', 'priority']);
  // فترات الجدولة بالأيام حسب آخر تقييم (قابلة للتعديل من الإعدادات)
  const DEFAULT_INTERVALS = Object.freeze({ mastered: 14, good: 7, soon: 2, failed: 1, unrated: 7 });
  const DEFAULTS = Object.freeze({
    tafsirId: 'muyassar',
    fontScale: 1,
    dailyGoal: 3,       // جلسات مراجعة مكتملة يوميًا
    weeklyGoal: 15,     // جلسات مكتملة في آخر 7 أيام
    sessionSize: 3,     // عدد المقاطع المقترحة في الجلسة اليومية
    holdMs: 500,        // مدة الضغط المطول لعرض التفسير
    defaultSort: 'surah',
    intervals: DEFAULT_INTERVALS
  });

  function intIn(v, min, max, fallback) {
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  }

  function sanitize(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const fs = Number(r.fontScale);
    const iv = r.intervals && typeof r.intervals === 'object' ? r.intervals : {};
    const hold = Number(r.holdMs);
    return {
      tafsirId: TafsirApi.TAFSIRS[r.tafsirId] ? r.tafsirId : DEFAULTS.tafsirId,
      fontScale: Number.isFinite(fs) && fs >= FONT_MIN && fs <= FONT_MAX ? Math.round(fs * 10) / 10 : DEFAULTS.fontScale,
      dailyGoal: intIn(r.dailyGoal, 1, 50, DEFAULTS.dailyGoal),
      weeklyGoal: intIn(r.weeklyGoal, 1, 350, DEFAULTS.weeklyGoal),
      sessionSize: intIn(r.sessionSize, 1, 30, DEFAULTS.sessionSize),
      holdMs: Number.isFinite(hold) && hold >= 300 && hold <= 1200 ? Math.round(hold / 50) * 50 : DEFAULTS.holdMs,
      defaultSort: SORTS.includes(r.defaultSort) ? r.defaultSort : DEFAULTS.defaultSort,
      intervals: {
        mastered: intIn(iv.mastered, 1, 365, DEFAULT_INTERVALS.mastered),
        good: intIn(iv.good, 1, 365, DEFAULT_INTERVALS.good),
        soon: intIn(iv.soon, 1, 365, DEFAULT_INTERVALS.soon),
        failed: intIn(iv.failed, 1, 365, DEFAULT_INTERVALS.failed),
        unrated: intIn(iv.unrated, 1, 365, DEFAULT_INTERVALS.unrated)
      }
    };
  }

  let current = sanitize(Storage.loadSettings());

  function get(key) {
    return current[key];
  }

  // يعيد نتيجة الحفظ؛ القيمة الجديدة تسري في الجلسة حتى لو فشل الحفظ.
  function set(key, value) {
    current = sanitize({ ...current, [key]: value });
    return Storage.saveSettings(current);
  }

  function changeFont(direction) {
    const next = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round((current.fontScale + direction * FONT_STEP) * 10) / 10));
    return { value: next, result: set('fontScale', next) };
  }

  // يستبدل الإعدادات كلها (للاستعادة). يعيد نتيجة الحفظ؛ في الفشل تبقى القيم القديمة في الجلسة.
  function replaceAll(raw) {
    const previous = current;
    const next = sanitize(raw);
    const result = Storage.saveSettings(next);
    current = result.ok ? next : previous;
    return result;
  }
  function snapshot() {
    return { ...current, intervals: { ...current.intervals } };
  }
  // إعادة الإعدادات إلى الافتراضي (لا تمس المحفوظات ولا السجل ولا التفاسير)
  function reset() {
    return replaceAll(DEFAULTS);
  }

  NS.Settings = { get, set, changeFont, sanitize, replaceAll, snapshot, reset, DEFAULTS, SORTS, DEFAULT_INTERVALS, FONT_MIN, FONT_MAX };
})(globalThis);
