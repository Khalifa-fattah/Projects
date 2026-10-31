import { surahByNumber } from './quran-data.js';
import { isValidDateKey, makeId, safeString, validTimestamp } from './utils.js';

export const MASTERY_LEVELS = ['unrated', 'new', 'learning', 'good', 'mastered'];
export const REVIEW_MODES = ['normal', 'test', 'random', 'surah', 'daily'];
export const REVIEW_RATINGS = ['mastered', 'good', 'soon', 'failed'];

function validRange(record) {
  const surah = surahByNumber(record?.surah);
  return Boolean(
    surah
    && Number.isInteger(record.from)
    && Number.isInteger(record.to)
    && record.from >= 1
    && record.to >= record.from
    && record.to <= surah.ayahs
  );
}

export function normalizeEntry(record) {
  if (!record || typeof record !== 'object' || !validRange(record)) return null;
  const surah = surahByNumber(record.surah);
  const createdAt = validTimestamp(record.createdAt, { allowFuture: true })
    ? record.createdAt
    : (validTimestamp(record.dateAdded, { allowFuture: true }) ? record.dateAdded : null);
  return {
    ...record,
    id: typeof record.id === 'string' && record.id ? record.id : makeId('entry'),
    surah: record.surah,
    surahName: surah.name,
    from: record.from,
    to: record.to,
    dateAdded: isValidDateKey(record.dateAdded) ? record.dateAdded : null,
    startDate: isValidDateKey(record.startDate) ? record.startDate : (isValidDateKey(record.dateAdded) ? record.dateAdded : null),
    createdAt,
    updatedAt: validTimestamp(record.updatedAt, { allowFuture: true }) ? record.updatedAt : createdAt,
    mastery: MASTERY_LEVELS.includes(record.mastery) ? record.mastery : 'unrated',
    notes: safeString(record.notes, 4000),
    category: safeString(record.category, 80),
    lastReviewed: isValidDateKey(record.lastReviewed) ? record.lastReviewed : null,
    reviewCount: Number.isInteger(record.reviewCount) && record.reviewCount >= 0 ? record.reviewCount : 0,
    dueDate: isValidDateKey(record.dueDate) ? record.dueDate : null,
    mergeHistory: Array.isArray(record.mergeHistory) ? record.mergeHistory.slice(0, 100) : [],
  };
}

export function migrateEntries(value) {
  if (!Array.isArray(value)) return { entries: [], changed: true, invalidCount: 1 };
  const entries = [];
  let invalidCount = 0;
  value.forEach((record) => {
    const normalized = normalizeEntry(record);
    if (normalized) entries.push(normalized);
    else invalidCount += 1;
  });
  let changed = invalidCount > 0 || entries.length !== value.length;
  if (!changed) {
    try { changed = JSON.stringify(entries) !== JSON.stringify(value); } catch { changed = true; }
  }
  return { entries, changed, invalidCount };
}

export function normalizeReview(record) {
  if (!record || typeof record !== 'object') return null;
  const snapshot = record.snapshot;
  if (!snapshot || !validRange({ ...snapshot, surah: snapshot.surah })) return null;
  if (!['completed', 'incomplete'].includes(record.status)) return null;
  const startedAt = validTimestamp(record.startedAt, { allowFuture: true })
    ? record.startedAt : null;
  const completedAt = validTimestamp(record.completedAt, { allowFuture: true })
    ? record.completedAt : null;
  if (!startedAt) return null;
  return {
    ...record,
    id: typeof record.id === 'string' && record.id ? record.id : makeId('review'),
    entryId: typeof record.entryId === 'string' ? record.entryId : null,
    snapshot: {
      surah: snapshot.surah,
      surahName: surahByNumber(snapshot.surah).name,
      from: snapshot.from,
      to: snapshot.to,
    },
    sessionId: typeof record.sessionId === 'string' ? record.sessionId : makeId('session'),
    mode: REVIEW_MODES.includes(record.mode) ? record.mode : 'normal',
    tested: record.tested === true || record.mode === 'test',
    status: record.status,
    rating: REVIEW_RATINGS.includes(record.rating) ? record.rating : null,
    notes: safeString(record.notes, 4000),
    startedAt,
    completedAt,
    localDate: isValidDateKey(record.localDate) ? record.localDate : null,
    durationSeconds: Number.isFinite(record.durationSeconds) && record.durationSeconds >= 0
      ? Math.min(record.durationSeconds, 86400) : null,
    mergedFromEntryIds: Array.isArray(record.mergedFromEntryIds)
      ? record.mergedFromEntryIds.filter((id) => typeof id === 'string').slice(0, 100) : [],
  };
}

export function migrateReviews(value) {
  if (!Array.isArray(value)) return { reviews: [], changed: true, invalidCount: 1 };
  const reviews = [];
  let invalidCount = 0;
  value.forEach((record) => {
    const normalized = normalizeReview(record);
    if (normalized) reviews.push(normalized);
    else invalidCount += 1;
  });
  return {
    reviews,
    invalidCount,
    changed: invalidCount > 0 || JSON.stringify(reviews) !== JSON.stringify(value),
  };
}

export function migrateScheduleEvents(value) {
  if (!Array.isArray(value)) return { events: [], invalidCount: 1 };
  const events = value.filter((event) => event && typeof event === 'object'
    && typeof event.id === 'string' && typeof event.entryId === 'string'
    && ['postponed', 'rescheduled'].includes(event.type)
    && isValidDateKey(event.date));
  return { events, invalidCount: value.length - events.length };
}
