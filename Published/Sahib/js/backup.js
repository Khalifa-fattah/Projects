/*
 * backup.js — النسخ الاحتياطي والاستعادة.
 *
 * الملف: { app:'sahib', version:1, exportedAt, entries, reviewLog, settings }
 *  - لا يتضمن نص القرآن ولا ذاكرة التفاسير (قابلة لإعادة الجلب من المصدر)؛ بعد الاستعادة
 *    على جهاز جديد تُجلب النصوص والتفاسير مجددًا عند الحاجة.
 *  - الاستيراد صارم: أي ملف غير صالح يُرفض كاملًا مع السبب، ولا يُغيَّر شيء.
 *  - الاستبدال: تُحفظ نسخة أمان من البيانات الحالية أولًا (مفتاح sahib_prebackup_<وقت>)، وإن فشلت
 *    أي كتابة تُعاد القيم السابقة تلقائيًا.
 */
(function (g) {
  'use strict';
  const NS = (g.Sahib = g.Sahib || {});
  const { Utils, Storage, Memorization, Settings } = NS;

  const FORMAT = { app: 'sahib', version: 1 };
  const MAX_FILE_BYTES = 5 * 1024 * 1024;

  function getReviewLog() {
    return NS.ReviewLog ? NS.ReviewLog.all() : [];
  }

  function exportData() {
    return {
      app: FORMAT.app,
      version: FORMAT.version,
      exportedAt: Utils.now().toISOString(),
      entries: Memorization.all(),
      reviewLog: getReviewLog(),
      settings: Settings.snapshot()
    };
  }

  function exportFileName() {
    return `sahib-backup-${Utils.toLocalDateStr()}.json`;
  }

  // التحقق من كائن مُحلَّل. يعيد { ok:true, data } أو { ok:false, error }.
  function validate(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, error: 'محتوى الملف ليس نسخة احتياطية صالحة.' };
    if (obj.app !== FORMAT.app) return { ok: false, error: 'هذا الملف ليس نسخة احتياطية من تطبيق صاحِب.' };
    if (!Number.isInteger(obj.version) || obj.version < 1) return { ok: false, error: 'رقم إصدار النسخة غير صالح.' };
    if (obj.version > FORMAT.version) return { ok: false, error: `هذه النسخة أحدث (الإصدار ${obj.version}) مما يدعمه هذا التطبيق (${FORMAT.version}). حدّث التطبيق أولًا.` };
    if (!Array.isArray(obj.entries)) return { ok: false, error: 'قائمة المحفوظات مفقودة أو غير صالحة.' };
    if (obj.reviewLog !== undefined && !Array.isArray(obj.reviewLog)) return { ok: false, error: 'سجل المراجعات غير صالح.' };
    if (obj.settings !== undefined && (obj.settings === null || typeof obj.settings !== 'object' || Array.isArray(obj.settings))) {
      return { ok: false, error: 'الإعدادات غير صالحة.' };
    }

    const entries = [];
    const ids = new Set();
    for (let i = 0; i < obj.entries.length; i++) {
      const e = Storage.normalizeEntry(obj.entries[i]);
      if (!e) return { ok: false, error: `السجل رقم ${i + 1} في المحفوظات غير صالح (سورة أو نطاق آيات خاطئ). لم يُستورد شيء.` };
      if (ids.has(e.id)) return { ok: false, error: `المعرّف "${e.id}" مكرر في الملف. لم يُستورد شيء.` };
      ids.add(e.id);
      entries.push(e);
    }
    const log = [];
    const logIds = new Set();
    for (const r of obj.reviewLog || []) {
      if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !Utils.isValidDateStr(r.date)) {
        return { ok: false, error: 'سجل المراجعات يحتوي على عنصر غير صالح. لم يُستورد شيء.' };
      }
      if (!logIds.has(r.id)) { logIds.add(r.id); log.push(r); }
    }
    return {
      ok: true,
      data: {
        entries, reviewLog: log,
        settings: Settings.sanitize(obj.settings),
        exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : null
      }
    };
  }

  // يقرأ نص ملف JSON ويتحقق منه.
  function parseAndValidate(text) {
    if (typeof text !== 'string' || text.length > MAX_FILE_BYTES) return { ok: false, error: 'حجم الملف كبير جدًا أو غير صالح.' };
    let obj;
    try {
      obj = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: 'الملف ليس بصيغة JSON صالحة (قد يكون تالفًا).' };
    }
    return validate(obj);
  }

  const sameRange = (a, b) => a.surah === b.surah && a.from === b.from && a.to === b.to;

  // خطة الدمج: نضيف ما ليس موجودًا (بالمعرّف أو بنفس السورة والنطاق) ولا نغيّر الموجود.
  function planMerge(data) {
    const current = Memorization.all();
    const curIds = new Set(current.map((e) => e.id));
    const toAdd = data.entries.filter((e) => !curIds.has(e.id) && !current.some((c) => sameRange(c, e)));
    const curLogIds = new Set(getReviewLog().map((r) => r.id));
    const logToAdd = data.reviewLog.filter((r) => !curLogIds.has(r.id));
    return { toAdd, logToAdd, skipped: data.entries.length - toAdd.length };
  }

  // كتابة مجموعة قيم مع تراجع تلقائي. changes: { entries?, reviewLog?, settings? }
  function writeAll(changes) {
    const before = { entries: Memorization.all(), reviewLog: getReviewLog(), settings: Settings.snapshot() };
    const done = [];
    const undo = () => {
      if (done.includes('entries')) Storage.saveEntries(before.entries);
      if (done.includes('reviewLog')) Storage.saveReviewLog(before.reviewLog);
      if (done.includes('settings')) Settings.replaceAll(before.settings);
    };
    if (changes.entries) {
      const r = Storage.saveEntries(changes.entries);
      if (!r.ok) return { ok: false, result: r };
      done.push('entries');
    }
    if (changes.reviewLog) {
      const r = Storage.saveReviewLog(changes.reviewLog);
      if (!r.ok) { undo(); return { ok: false, result: r }; }
      done.push('reviewLog');
    }
    if (changes.settings) {
      const r = Settings.replaceAll(changes.settings);
      if (!r.ok) { undo(); return { ok: false, result: r }; }
      done.push('settings');
    }
    // نجحت كل الكتابات: حدّث الذاكرة
    if (changes.entries) Memorization.init(changes.entries);
    if (changes.reviewLog && NS.ReviewLog) NS.ReviewLog.setAll(changes.reviewLog);
    return { ok: true };
  }

  function applyMerge(data) {
    const plan = planMerge(data);
    if (plan.toAdd.length === 0 && plan.logToAdd.length === 0) return { ok: true, added: 0, logAdded: 0, skipped: plan.skipped };
    const out = writeAll({
      entries: [...Memorization.all(), ...plan.toAdd],
      reviewLog: [...getReviewLog(), ...plan.logToAdd]
    });
    return out.ok
      ? { ok: true, added: plan.toAdd.length, logAdded: plan.logToAdd.length, skipped: plan.skipped }
      : { ok: false, result: out.result };
  }

  // الاستبدال: نسخة أمان أولًا، ثم الكتابة مع تراجع عند الفشل.
  function applyReplace(data) {
    const safetyKey = `sahib_prebackup_${Date.now()}`;
    const safety = Storage.rawSet(safetyKey, JSON.stringify(exportData()));
    if (!safety.ok) return { ok: false, result: safety, stage: 'safety' };
    const out = writeAll({ entries: data.entries, reviewLog: data.reviewLog, settings: data.settings });
    return out.ok ? { ok: true, count: data.entries.length, safetyKey } : { ok: false, result: out.result, stage: 'write' };
  }

  NS.Backup = { FORMAT, MAX_FILE_BYTES, exportData, exportFileName, validate, parseAndValidate, planMerge, applyMerge, applyReplace };
})(globalThis);
