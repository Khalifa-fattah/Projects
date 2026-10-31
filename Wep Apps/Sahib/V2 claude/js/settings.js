/*
 * settings.js — إعدادات التطبيق المحفوظة (مفتاح مستقل sahib_settings_v1، لا يمس المحفوظات).
 *  - tafsirId: التفسير النشط (muyassar | saadi)
 *  - fontScale: تكبير خط الآيات (0.8 … 1.8)
 */
(function (g) {
  'use strict';
  const NS = (g.Sahib = g.Sahib || {});
  const { Storage, TafsirApi } = NS;

  const FONT_MIN = 0.8, FONT_MAX = 1.8, FONT_STEP = 0.1;
  const DEFAULTS = Object.freeze({ tafsirId: 'muyassar', fontScale: 1 });

  function sanitize(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const fs = Number(r.fontScale);
    return {
      tafsirId: TafsirApi.TAFSIRS[r.tafsirId] ? r.tafsirId : DEFAULTS.tafsirId,
      fontScale: Number.isFinite(fs) && fs >= FONT_MIN && fs <= FONT_MAX ? Math.round(fs * 10) / 10 : DEFAULTS.fontScale
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
    return { ...current };
  }

  NS.Settings = { get, set, changeFont, sanitize, replaceAll, snapshot, FONT_MIN, FONT_MAX };
})(globalThis);
