import { surahByNumber } from './quran-data.js';
import { compareDateKeys, isValidDateKey, localDateKey, makeId, normalizeArabic, safeString } from './utils.js';
import { MASTERY_LEVELS } from './migrations.js';

export function validateEntryInput(input) {
  const surah = surahByNumber(input?.surah);
  if (!surah) return { valid: false, error: 'اختر سورة موجودة.' };
  const from = input.from;
  const to = input.to;
  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    return { valid: false, error: 'أدخل رقم الآية الأولى والأخيرة كعددين صحيحين.' };
  }
  if (from < 1 || to < 1) return { valid: false, error: 'رقم الآية لا يمكن أن يقل عن 1.' };
  if (from > to) return { valid: false, error: 'الآية الأخيرة لا يمكن أن تكون قبل الآية الأولى.' };
  if (to > surah.ayahs) return { valid: false, error: `عدد آيات ${surah.name} هو ${surah.ayahs} فقط.` };
  if (input.startDate && !isValidDateKey(input.startDate)) return { valid: false, error: 'تاريخ بدء الحفظ غير صالح.' };
  if (input.mastery && !MASTERY_LEVELS.includes(input.mastery)) return { valid: false, error: 'مستوى الإتقان غير معروف.' };
  return { valid: true, surah };
}

export function buildEntry(input, now = new Date()) {
  const validation = validateEntryInput(input);
  if (!validation.valid) throw new Error(validation.error);
  const timestamp = now.toISOString();
  const today = localDateKey(now);
  return {
    id: makeId('entry'),
    surah: input.surah,
    surahName: validation.surah.name,
    from: input.from,
    to: input.to,
    dateAdded: today,
    startDate: input.startDate || today,
    createdAt: timestamp,
    updatedAt: timestamp,
    mastery: input.mastery || 'unrated',
    notes: safeString(input.notes, 4000),
    category: safeString(input.category, 80).trim(),
    lastReviewed: null,
    reviewCount: 0,
    dueDate: null,
    mergeHistory: [],
  };
}

export function findOverlaps(entries, candidate, excludeId = null) {
  return entries.filter((entry) => entry.id !== excludeId
    && entry.surah === candidate.surah
    && entry.from <= candidate.to
    && entry.to >= candidate.from);
}

export function findAdjacent(entries, candidate, excludeId = null) {
  return entries.filter((entry) => entry.id !== excludeId
    && entry.surah === candidate.surah
    && (entry.to + 1 === candidate.from || candidate.to + 1 === entry.from));
}

export function overlapDescription(overlaps) {
  return overlaps.map((entry) => `${entry.surahName}: ${entry.from}–${entry.to}`).join('، ');
}

export function uniqueAyahMap(entries) {
  const map = new Map();
  entries.forEach((entry) => {
    if (!surahByNumber(entry.surah)) return;
    if (!map.has(entry.surah)) map.set(entry.surah, new Set());
    const ayahs = map.get(entry.surah);
    for (let number = entry.from; number <= entry.to; number += 1) ayahs.add(number);
  });
  return map;
}

export function countUniqueAyahs(entries) {
  let total = 0;
  uniqueAyahMap(entries).forEach((ayahs) => { total += ayahs.size; });
  return total;
}

/**
 * الدمج صريح فقط. يبقي مقطعًا واحدًا، وينقل سجلات المراجعة إلى المعرّف الباقي،
 * ويحتفظ بمصادر النطاقات كي لا تضيع العلاقة التاريخية بين السجلات.
 */
export function mergeEntries(entries, candidate) {
  const directOverlaps = findOverlaps(entries, candidate);
  const overlaps = directOverlaps.length ? directOverlaps : findAdjacent(entries, candidate);
  if (!overlaps.length) throw new Error('لا توجد مقاطع متداخلة أو متجاورة للدمج.');
  const selectedIds = new Set(overlaps.map((entry) => entry.id));
  let from = Math.min(candidate.from, ...overlaps.map((entry) => entry.from));
  let to = Math.max(candidate.to, ...overlaps.map((entry) => entry.to));
  // وسّع الدمج إلى أي مقطع يتصل بالنطاق الجديد، حتى لا يبقى تداخل ناتج عن الدمج نفسه.
  let expanded = true;
  while (expanded) {
    expanded = false;
    entries.forEach((entry) => {
      if (entry.surah === candidate.surah && !selectedIds.has(entry.id) && entry.from <= to && entry.to >= from) {
        selectedIds.add(entry.id);
        from = Math.min(from, entry.from);
        to = Math.max(to, entry.to);
        expanded = true;
      }
    });
  }
  const sources = entries.filter((entry) => selectedIds.has(entry.id));
  const survivor = [...sources].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))[0] || overlaps[0];
  const removedIds = sources.filter((entry) => entry.id !== survivor.id).map((entry) => entry.id);
  const idMap = Object.fromEntries(removedIds.map((id) => [id, survivor.id]));
  const notes = [...new Set([candidate.notes, ...sources.map((entry) => entry.notes)]
    .filter((note) => typeof note === 'string' && note.trim()).map((note) => note.trim()))].join('\n---\n');
  const reviewedDates = sources.map((entry) => entry.lastReviewed).filter(isValidDateKey).sort();
  const merged = {
    ...survivor,
    from,
    to,
    updatedAt: new Date().toISOString(),
    mastery: candidate.mastery && candidate.mastery !== 'unrated' ? candidate.mastery : survivor.mastery,
    notes: safeString(notes, 4000),
    category: candidate.category || survivor.category,
    lastReviewed: reviewedDates.at(-1) || null,
    reviewCount: sources.reduce((sum, entry) => sum + (entry.reviewCount || 0), 0),
    mergeHistory: [
      ...(survivor.mergeHistory || []),
      ...sources.map((entry) => ({ id: entry.id, from: entry.from, to: entry.to, mergedAt: new Date().toISOString() })),
      { id: null, from: candidate.from, to: candidate.to, mergedAt: new Date().toISOString(), source: 'new-input' },
    ].slice(-100),
  };
  return {
    mergedEntry: merged,
    idMap,
    entries: entries.filter((entry) => !removedIds.includes(entry.id) && entry.id !== survivor.id).concat(merged),
  };
}

export function reassignReviewEntryIds(reviews, idMap) {
  return reviews.map((review) => {
    const nextId = idMap[review.entryId];
    if (!nextId) return review;
    return {
      ...review,
      entryId: nextId,
      mergedFromEntryIds: [...new Set([...(review.mergedFromEntryIds || []), review.entryId])],
    };
  });
}

export function searchAndSortEntries(entries, options, scheduleById = new Map()) {
  const query = normalizeArabic(options.query || '');
  const numericQuery = /^\d+$/.test(query) ? Number(query) : null;
  const filtered = entries.filter((entry) => {
    if (options.mastery && options.mastery !== 'all' && entry.mastery !== options.mastery) return false;
    if (options.needsReview && !scheduleById.get(entry.id)?.isDue) return false;
    if (!query) return true;
    const haystack = normalizeArabic(`${entry.surahName} ${entry.notes || ''} ${entry.category || ''}`);
    return haystack.includes(query)
      || (numericQuery !== null && numericQuery >= entry.from && numericQuery <= entry.to)
      || String(entry.from) === query || String(entry.to) === query;
  });
  const sorted = [...filtered];
  sorted.sort((a, b) => {
    switch (options.sort) {
      case 'dateAdded': return (b.createdAt || '').localeCompare(a.createdAt || '');
      case 'lastReviewed': {
        const aDate = scheduleById.get(a.id)?.lastReviewedAt || scheduleById.get(a.id)?.lastReviewedDate || '';
        const bDate = scheduleById.get(b.id)?.lastReviewedAt || scheduleById.get(b.id)?.lastReviewedDate || '';
        return bDate.localeCompare(aDate) || a.surah - b.surah || a.from - b.from;
      }
      case 'priority': return (scheduleById.get(b.id)?.priority || 0) - (scheduleById.get(a.id)?.priority || 0);
      default: return a.surah - b.surah || a.from - b.from || a.to - b.to;
    }
  });
  return sorted;
}

export function masteryLabel(level) {
  return ({ unrated: 'دون تقييم', new: 'جديد', learning: 'قيد التثبيت', good: 'جيد', mastered: 'متقن' })[level] || 'دون تقييم';
}

export function compareNullableDates(a, b) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return compareDateKeys(a, b) ?? 0;
}
