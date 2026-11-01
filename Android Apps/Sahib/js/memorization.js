/*
 * memorization.js — منطق المحفوظات (بلا أي اعتماد على واجهة المستخدم).
 *
 * كل تعديل يمر عبر commit(): يُحفظ أولًا في التخزين، ولا تتغير الحالة في الذاكرة
 * إلا إذا نجح الحفظ، فلا يظهر للمستخدم نجاح كاذب.
 */
(function (g) {
  'use strict';
  const NS = (g.Sahib = g.Sahib || {});
  const { Quran, Utils, Storage } = NS;

  const state = { entries: [] };

  function init(entries) {
    state.entries = entries.slice();
  }
  function all() {
    return state.entries;
  }
  function find(id) {
    return state.entries.find((e) => e.id === id);
  }

  function toInt(v) {
    if (typeof v === 'number') return Number.isInteger(v) ? v : NaN;
    if (typeof v === 'string' && /^\d+$/.test(v.trim())) return parseInt(v.trim(), 10);
    return NaN;
  }

  // التحقق من نطاق الآيات. يعيد { ok, surah, from, to } أو { ok:false, error }.
  function validateRange(surahNum, fromRaw, toRaw) {
    const surah = toInt(surahNum);
    const s = Quran.surahByNumber(surah);
    if (!s) return { ok: false, error: 'السورة المختارة غير صالحة.' };
    const from = toInt(fromRaw), to = toInt(toRaw);
    if (Number.isNaN(from) || Number.isNaN(to) || from < 1 || to < 1 || from > s.ayahs || to > s.ayahs) {
      return { ok: false, error: `فضلاً أدخل أرقام آيات صحيحة بين 1 و${s.ayahs}.` };
    }
    if (from > to) {
      return { ok: false, error: 'رقم آية البداية يجب أن يكون أصغر من أو يساوي رقم النهاية.' };
    }
    return { ok: true, surah, from, to };
  }

  // تصنيف علاقة نطاق جديد بالمقاطع الموجودة من السورة نفسها:
  //  exact: نفس النطاق تمامًا، overlapping: تداخل (ويشمل الاحتواء)، adjacent: متجاور مباشرة.
  function classify(entries, surah, from, to, excludeId) {
    const exact = [], overlapping = [], adjacent = [];
    for (const e of entries) {
      if (e.surah !== surah || e.id === excludeId) continue;
      if (e.from === from && e.to === to) exact.push(e);
      else if (from <= e.to && to >= e.from) overlapping.push(e);
      else if (from === e.to + 1 || to === e.from - 1) adjacent.push(e);
    }
    return { exact, overlapping, adjacent, group: [...exact, ...overlapping, ...adjacent] };
  }

  // الدمج يغيّر النطاق فعلًا؟ (لا فائدة منه إذا كان النطاق الجديد داخل مقطع واحد موجود)
  function mergeChangesRange(group, from, to) {
    if (group.length === 0) return false;
    const lo = Math.min(from, ...group.map((e) => e.from));
    const hi = Math.max(to, ...group.map((e) => e.to));
    return !(group.length === 1 && group[0].from === lo && group[0].to === hi);
  }

  // خريطة: رقم السورة -> مجموعة أرقام الآيات (فريدة، فلا يتكرر عدّ الآية عند التداخل).
  function coveredMap(entries) {
    const map = new Map();
    for (const e of entries || state.entries) {
      if (!map.has(e.surah)) map.set(e.surah, new Set());
      const set = map.get(e.surah);
      for (let i = e.from; i <= e.to; i++) set.add(i);
    }
    return map;
  }

  function commit(next) {
    const result = Storage.saveEntries(next);
    if (result.ok) state.entries = next;
    return result;
  }

  function uniqueId() {
    let id = Utils.generateId('e');
    while (find(id)) id = Utils.generateId('e');
    return id;
  }

  function cleanNotes(v) {
    return typeof v === 'string' ? v.trim().slice(0, 300) : '';
  }
  function cleanMastery(v) {
    return Storage.MASTERY.includes(v) ? v : null;
  }
  // تاريخ بدء الحفظ: يجب أن يكون صالحًا وليس في المستقبل، وإلا نستخدم اليوم.
  function cleanStartDate(v) {
    const today = Utils.toLocalDateStr();
    return Utils.isValidDateStr(v) && Utils.daysBetween(v, today) >= 0 ? v : today;
  }

  function buildEntry(surah, from, to, extra) {
    const x = extra || {};
    return {
      id: uniqueId(),
      surah,
      surahName: Quran.surahByNumber(surah).name,
      from,
      to,
      dateAdded: cleanStartDate(x.dateAdded),
      lastReviewed: null,
      reviewCount: 0,
      notes: cleanNotes(x.notes),
      mastery: cleanMastery(x.mastery),
      lastRating: null
    };
  }

  function add({ surah, from, to, notes, mastery, dateAdded }) {
    const entry = buildEntry(surah, from, to, { notes, mastery, dateAdded });
    const result = commit([...state.entries, entry]);
    return { ...result, entry };
  }

  // دمج النطاق الجديد مع المقاطع الموجودة في مقطع واحد. لا حذف صامت: المقاطع الأصلية
  // تُحفظ في mergedFrom كمعلومة مصدر.
  // ملاحظة: lastReviewed للمقطع المدموج = أحدث مراجعة بين الأجزاء الموجودة (قيمة تقريبية موثّقة).
  function mergeAdd(groupIds, { surah, from, to }) {
    const group = state.entries.filter((e) => groupIds.includes(e.id));
    if (group.length === 0) return { ok: false, reason: 'notfound' };
    const base = group[0];
    const lo = Math.min(from, ...group.map((e) => e.from));
    const hi = Math.max(to, ...group.map((e) => e.to));
    const today = Utils.toLocalDateStr();
    const dates = group.map((e) => e.dateAdded).filter(Utils.isValidDateStr).sort();
    const reviewed = group.map((e) => e.lastReviewed).filter(Utils.isValidDateStr).sort();
    const sources = [
      ...(Array.isArray(base.mergedFrom) ? base.mergedFrom : []),
      ...group.slice(1).map((e) => ({ from: e.from, to: e.to, dateAdded: e.dateAdded })),
      { from, to, dateAdded: today }
    ];
    const merged = {
      ...base,
      surah,
      from: lo,
      to: hi,
      dateAdded: dates[0] || today,
      lastReviewed: reviewed.length ? reviewed[reviewed.length - 1] : null,
      reviewCount: group.reduce((sum, e) => sum + (e.reviewCount || 0), 0),
      mergedFrom: sources
    };
    const next = [];
    for (const e of state.entries) {
      if (e.id === base.id) next.push(merged);
      else if (!groupIds.includes(e.id)) next.push(e);
    }
    const result = commit(next);
    return { ...result, entry: merged };
  }

  function remove(id) {
    return commit(state.entries.filter((e) => e.id !== id));
  }

  // تحديث سجل عبر دالة تعيد نسخة جديدة منه.
  function update(id, fn) {
    const current = find(id);
    if (!current) return { ok: false, reason: 'notfound' };
    const updated = fn(current);
    return { ...commit(state.entries.map((e) => (e.id === id ? updated : e))), entry: updated };
  }

  // تعديل مقطع بعد التحقق: يغيّر السورة/النطاق/الملاحظات/الإتقان ويحافظ على بقية الحقول (المراجعات والمصدر).
  function edit(id, { surah, from, to, notes, mastery, dateAdded }) {
    return update(id, (e) => ({
      ...e,
      surah,
      surahName: Quran.surahByNumber(surah).name,
      from,
      to,
      notes: cleanNotes(notes),
      mastery: cleanMastery(mastery),
      dateAdded: dateAdded === undefined ? e.dateAdded : cleanStartDate(dateAdded)
    }));
  }

  // ---------- بحث وتصفية وترتيب ----------
  // توحيد النص العربي للبحث: إزالة التشكيل والتطويل وتوحيد الألف والتاء المربوطة والياء.
  function normalizeArabic(str) {
    return String(str == null ? '' : str)
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
      .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
      .replace(/\u0629/g, '\u0647')
      .replace(/[\u0649\u064A]/g, '\u064A')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  // بحث باسم السورة أو برقم آية داخل النطاق أو في الملاحظات. الاستعلام الفارغ يطابق الكل.
  function matchesQuery(entry, query) {
    const q = normalizeArabic(query);
    if (!q) return true;
    if (/^[0-9\u0660-\u0669]+$/.test(q)) {
      const n = parseInt(q.replace(/[\u0660-\u0669]/g, (d) => d.charCodeAt(0) - 0x0660), 10);
      return n >= entry.from && n <= entry.to;
    }
    return normalizeArabic(entry.surahName).includes(q) || normalizeArabic(entry.notes).includes(q);
  }

  const DUE_AFTER_DAYS = 7; // يُعدّ المقطع مستحقًا للمراجعة بعد هذا العدد من الأيام (قابل للتعديل لاحقًا من الإعدادات)
  const RATING_WEIGHT = { failed: 3, soon: 2, good: 1, mastered: 0.5 };

  function daysSinceReview(entry, today) {
    const dn = Utils.dayNumber(entry.lastReviewed);
    return Number.isNaN(dn) ? null : Math.max(0, Utils.dayNumber(today) - dn);
  }

  // مستحق: لم يُراجع قط، أو مضى عليه DUE_AFTER_DAYS فأكثر، أو كان تقييمه الأخير ضعيفًا (soon/failed).
  function needsReview(entry, today) {
    const d = daysSinceReview(entry, today);
    return d === null || d >= DUE_AFTER_DAYS || entry.lastRating === 'soon' || entry.lastRating === 'failed';
  }

  // أولوية المراجعة (أكبر = أولى): الأيام منذ آخر مراجعة (365 إن لم يُراجع) × وزن التقييم الأخير.
  // قاعدة بسيطة وواضحة وليست ذكاءً اصطناعيًا. كثرة فتح المقطع لا ترفع الإتقان.
  function reviewPriority(entry, today) {
    const d = daysSinceReview(entry, today);
    const days = d === null ? 365 : d;
    const w = RATING_WEIGHT[entry.lastRating] || 1;
    return days * w;
  }

  function filterEntries(entries, { query, filter }, today) {
    return entries.filter((e) => {
      if (!matchesQuery(e, query)) return false;
      switch (filter) {
        case 'due': return needsReview(e, today);
        case 'never': return !Utils.isValidDateStr(e.lastReviewed);
        case 'weak': return e.lastRating === 'soon' || e.lastRating === 'failed';
        case 'mastered': return e.lastRating === 'mastered';
        default: return true;
      }
    });
  }

  function sortEntries(entries, sort, today) {
    const list = entries.slice();
    const bySurah = (a, b) => a.surah - b.surah || a.from - b.from;
    switch (sort) {
      case 'added': // الأحدث إضافة أولًا
        return list.sort((a, b) => (Utils.dayNumber(b.dateAdded) || 0) - (Utils.dayNumber(a.dateAdded) || 0) || bySurah(a, b));
      case 'reviewed': // الأقدم مراجعة أولًا، وغير المراجع في المقدمة
        return list.sort((a, b) => {
          const da = Utils.dayNumber(a.lastReviewed), db = Utils.dayNumber(b.lastReviewed);
          return (Number.isNaN(da) ? -Infinity : da) - (Number.isNaN(db) ? -Infinity : db) || bySurah(a, b);
        });
      case 'priority':
        return list.sort((a, b) => reviewPriority(b, today) - reviewPriority(a, today) || bySurah(a, b));
      default:
        return list.sort(bySurah);
    }
  }

  NS.Memorization = {
    edit, normalizeArabic, matchesQuery, needsReview, reviewPriority, filterEntries, sortEntries, DUE_AFTER_DAYS,
    init, all, find, validateRange, classify, mergeChangesRange, coveredMap,
    add, mergeAdd, remove, update, commit
  };
})(globalThis);
