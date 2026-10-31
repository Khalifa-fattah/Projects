import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackup, parseBackup, mergeBackupData } from '../js/backup.js';
import { DEFAULT_SETTINGS } from '../js/settings.js';

const entry = (id = 'e1') => ({
  id, surah: 1, surahName: 'سُورَةُ ٱلْفَاتِحَةِ', from: 1, to: 2,
  dateAdded: '2026-10-01', startDate: '2026-10-01', createdAt: '2026-10-01T10:00:00.000Z',
  mastery: 'unrated', notes: '', category: '', lastReviewed: null, reviewCount: 0, dueDate: null,
});
const empty = { entries: [], reviews: [], settings: DEFAULT_SETTINGS, scheduleEvents: [] };

test('تصدير بيانات فارغة واستعادتها', () => {
  const backup = createBackup(empty, '2026-10-30T10:00:00.000Z');
  assert.equal(backup.schemaVersion, 2);
  assert.equal(backup.exportedAt, '2026-10-30T10:00:00.000Z');
  assert.deepEqual(parseBackup(JSON.stringify(backup)).entries, []);
});

test('تصدير واستيراد عدد كبير من السجلات', () => {
  const entries = Array.from({ length: 5000 }, (_, index) => entry(`e${index}`));
  const restored = parseBackup(JSON.stringify(createBackup({ ...empty, entries })));
  assert.equal(restored.entries.length, 5000);
});

test('رفض JSON التالف والإصدار غير المدعوم والنطاق غير الصالح', () => {
  assert.throws(() => parseBackup('{broken'), /JSON/);
  assert.throws(() => parseBackup(JSON.stringify({ app: 'sahib', schemaVersion: 99, data: { entries: [] } })), /مدعوم/);
  assert.throws(() => parseBackup(JSON.stringify([entry() , { ...entry('bad'), to: 99 }])), /غير صالحة/);
});

test('استعادة صيغة قديمة كانت مصفوفة محفوظات', () => {
  const restored = parseBackup(JSON.stringify([entry('legacy')]));
  assert.equal(restored.entries[0].id, 'legacy');
  assert.equal(restored.reviews.length, 0);
});

test('الدمج يمنع التكرار ولا يغير البيانات الحالية عند فشل الملف', () => {
  const current = { ...empty, entries: [entry('same')] };
  const incoming = { ...empty, entries: [entry('same'), entry('same'), { ...entry('new'), from: 2, to: 3 }] };
  const merged = mergeBackupData(current, incoming);
  assert.equal(merged.data.entries.length, 2);
  assert.equal(merged.added.entries, 1);
  assert.equal(merged.skipped.entries, 2);
  assert.equal(current.entries.length, 1);
  assert.throws(() => parseBackup('{"app":"other"}'));
  assert.equal(current.entries[0].id, 'same');
});
