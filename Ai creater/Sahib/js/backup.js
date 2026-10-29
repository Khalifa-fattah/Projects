import { migrateEntries, migrateReviews, migrateScheduleEvents } from './migrations.js';
import { validateSettings, DEFAULT_SETTINGS } from './settings.js';
import { APP_VERSION, SCHEMA_VERSION, localDateKey } from './utils.js';

export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

export function createBackup({ entries, reviews, settings, scheduleEvents }, exportedAt = new Date().toISOString()) {
  return {
    app: 'sahib',
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt,
    data: {
      entries,
      reviews,
      settings: validateSettings(settings),
      scheduleEvents,
    },
  };
}

export function parseBackup(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('الملف فارغ أو غير مقروء.');
  if (new Blob([text]).size > MAX_BACKUP_BYTES) throw new Error('حجم الملف يتجاوز الحد المسموح (25 ميجابايت).');
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { throw new Error('صيغة JSON غير صالحة.'); }

  // دعم نسخة أولية كانت تصدّر مصفوفة المحفوظات فقط.
  if (Array.isArray(parsed)) parsed = { app: 'sahib', schemaVersion: 1, data: { entries: parsed } };
  if (!parsed || parsed.app !== 'sahib' || ![1, 2].includes(parsed.schemaVersion)) {
    throw new Error('هذا ليس ملف نسخة احتياطية مدعومًا من «صاحِب».');
  }
  const data = parsed.data;
  if (!data || typeof data !== 'object' || !Array.isArray(data.entries)) {
    throw new Error('النسخة لا تحتوي حقل المحفوظات المطلوب.');
  }
  if (data.entries.length > 20000 || (data.reviews?.length || 0) > 200000) {
    throw new Error('عدد السجلات يتجاوز الحد الآمن للاستيراد.');
  }
  const entriesMigration = migrateEntries(data.entries);
  if (entriesMigration.invalidCount) throw new Error('بعض المقاطع غير صالحة أو أرقام آياتها غير مطابقة.');
  const reviewsMigration = migrateReviews(data.reviews || []);
  if (reviewsMigration.invalidCount) throw new Error('سجل المراجعات يحتوي حقولًا ناقصة أو غير صالحة.');
  const scheduleMigration = migrateScheduleEvents(data.scheduleEvents || []);
  if (scheduleMigration.invalidCount) throw new Error('بيانات الجدولة غير صالحة.');
  return {
    entries: entriesMigration.entries,
    reviews: reviewsMigration.reviews,
    settings: validateSettings(data.settings || DEFAULT_SETTINGS),
    scheduleEvents: scheduleMigration.events,
  };
}

function entryFingerprint(entry) {
  return JSON.stringify([entry.surah, entry.from, entry.to, entry.dateAdded, entry.startDate, entry.notes, entry.category]);
}

export function mergeBackupData(current, incoming) {
  const entryIds = new Set(current.entries.map((entry) => entry.id));
  const entryFingerprints = new Set(current.entries.map(entryFingerprint));
  const reviewIds = new Set(current.reviews.map((review) => review.id));
  const sessionKeys = new Set(current.reviews.map((review) => `${review.sessionId}:${review.status}`));
  const scheduleIds = new Set(current.scheduleEvents.map((event) => event.id));
  const added = { entries: 0, reviews: 0, scheduleEvents: 0 };
  const skipped = { entries: 0, reviews: 0, scheduleEvents: 0 };

  const entries = [...current.entries];
  incoming.entries.forEach((entry) => {
    if (entryIds.has(entry.id) || entryFingerprints.has(entryFingerprint(entry))) skipped.entries += 1;
    else {
      entries.push(entry);
      entryIds.add(entry.id);
      entryFingerprints.add(entryFingerprint(entry));
      added.entries += 1;
    }
  });
  const reviews = [...current.reviews];
  incoming.reviews.forEach((review) => {
    const sessionKey = `${review.sessionId}:${review.status}`;
    if (reviewIds.has(review.id) || sessionKeys.has(sessionKey)) skipped.reviews += 1;
    else {
      reviews.push(review);
      reviewIds.add(review.id);
      sessionKeys.add(sessionKey);
      added.reviews += 1;
    }
  });
  const scheduleEvents = [...current.scheduleEvents];
  incoming.scheduleEvents.forEach((event) => {
    if (scheduleIds.has(event.id)) skipped.scheduleEvents += 1;
    else { scheduleEvents.push(event); scheduleIds.add(event.id); added.scheduleEvents += 1; }
  });
  return { data: { entries, reviews, settings: current.settings, scheduleEvents }, added, skipped };
}

export function downloadJson(data, filename = `sahib-backup-${localDateKey()}.json`) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readBackupFile(file) {
  if (!file || file.size > MAX_BACKUP_BYTES) throw new Error('الملف فارغ أو أكبر من 25 ميجابايت.');
  return parseBackup(await file.text());
}
