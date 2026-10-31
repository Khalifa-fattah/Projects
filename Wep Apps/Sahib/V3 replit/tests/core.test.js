import test from 'node:test';
import assert from 'node:assert/strict';
import { localDateKey, rollingDateKeys, addDays, daysBetween, isValidDateKey } from '../js/utils.js';
import { buildEntry, validateEntryInput, findOverlaps, findAdjacent, countUniqueAyahs, mergeEntries, reassignReviewEntryIds } from '../js/memorization.js';
import { DEFAULT_SETTINGS } from '../js/settings.js';
import { buildSchedule, scheduleEntry, weightedRandomEntry } from '../js/review-scheduler.js';
import { ReviewSession } from '../js/review.js';
import { computeStats } from '../js/stats.js';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const NOW = new Date(2026, 9, 30, 12, 0, 0);
const entry = (overrides = {}) => ({
  id: 'e1', surah: 1, surahName: 'سُورَةُ ٱلْفَاتِحَةِ', from: 1, to: 3,
  dateAdded: '2026-10-01', startDate: '2026-10-01', createdAt: '2026-10-01T10:00:00.000Z',
  mastery: 'unrated', notes: '', category: '', reviewCount: 0, lastReviewed: null, dueDate: null,
  ...overrides,
});
const review = (overrides = {}) => ({
  id: 'r1', sessionId: 's1', entryId: 'e1', snapshot: { surah: 1, surahName: 'سُورَةُ ٱلْفَاتِحَةِ', from: 1, to: 3 },
  mode: 'normal', tested: false, status: 'completed', rating: 'good', notes: '',
  startedAt: '2026-10-29T10:00:00.000Z', completedAt: '2026-10-29T10:01:00.000Z', localDate: '2026-10-29', durationSeconds: 60,
  ...overrides,
});

test('التوقيت المحلي وآخر سبعة أيام والتحقق من التواريخ', () => {
  assert.equal(localDateKey(new Date(2026, 0, 2, 23, 59)), '2026-01-02');
  assert.deepEqual(rollingDateKeys(7, NOW), ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']);
  assert.equal(addDays('2026-03-08', 1), '2026-03-09');
  assert.equal(daysBetween('2026-10-24', '2026-10-30'), 6);
  assert.equal(isValidDateKey('2026-02-30'), false);
  assert.equal(isValidDateKey('not-a-date'), false);
});

test('اختلاف المنطقة الزمنية لا يغير اليوم المحلي المقصود', () => {
  const moduleUrl = new URL('../js/utils.js', import.meta.url).href;
  const code = `import {localDateKey} from ${JSON.stringify(moduleUrl)}; console.log(localDateKey(new Date('2026-01-02T12:30:00Z')));`;
  const run = (TZ) => execFileSync(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, TZ }, encoding: 'utf8' }).trim();
  assert.equal(run('Pacific/Kiritimati'), '2026-01-03');
  assert.equal(run('Pacific/Honolulu'), '2026-01-02');
});

test('إضافة مقطع صحيح ورفض الأرقام والنطاقات غير الصالحة', () => {
  const built = buildEntry({ surah: 1, from: 2, to: 5, startDate: '2026-10-30' }, NOW);
  assert.equal(built.to - built.from + 1, 4);
  assert.match(validateEntryInput({ surah: 1, from: 0, to: 2 }).error, /يقل/);
  assert.match(validateEntryInput({ surah: 1, from: 5, to: 2 }).error, /قبل/);
  assert.match(validateEntryInput({ surah: 1, from: 1, to: 8 }).error, /7/);
  assert.equal(validateEntryInput({ surah: 999, from: 1, to: 2 }).valid, false);
});

test('اكتشاف التداخل ومنع تكرار عدّ الآيات', () => {
  const entries = [entry(), entry({ id: 'e2', from: 3, to: 5 }), entry({ id: 'e3', from: 6, to: 7 })];
  assert.equal(findOverlaps(entries, entry({ from: 5, to: 6 })).length, 2);
  assert.equal(findOverlaps(entries, entry({ from: 7, to: 7 })).length, 1);
  assert.equal(findOverlaps(entries, entry({ from: 8, to: 8 })).length, 0);
  assert.equal(findAdjacent(entries, entry({ from: 8, to: 8 })).length, 1);
  assert.equal(countUniqueAyahs(entries), 7);
  assert.equal(countUniqueAyahs([entry(), entry({ id: 'same' })]), 3);
});

test('الدمج الصريح يحفظ المصدر وينقل سجلات المراجعة', () => {
  const entries = [entry(), entry({ id: 'e2', from: 3, to: 5 })];
  const merged = mergeEntries(entries, entry({ id: 'new', from: 5, to: 7 }));
  assert.equal(merged.entries.length, 1);
  assert.equal(merged.mergedEntry.from, 1);
  assert.equal(merged.mergedEntry.to, 7);
  assert.ok(merged.mergedEntry.mergeHistory.length >= 3);
  const moved = reassignReviewEntryIds([review({ entryId: 'e2' })], merged.idMap);
  assert.equal(moved[0].entryId, 'e1');
  assert.deepEqual(moved[0].mergedFromEntryIds, ['e2']);
  assert.equal(countUniqueAyahs(merged.entries), 7);
});

test('الجدولة تعطي التقييم الضعيف موعدًا أقرب والمتقن موعدًا أبعد', () => {
  const weak = scheduleEntry(entry(), [review({ rating: 'failed', localDate: '2026-10-29' })], DEFAULT_SETTINGS, NOW);
  const strong = scheduleEntry(entry(), [review({ rating: 'mastered', localDate: '2026-10-29' })], DEFAULT_SETTINGS, NOW);
  assert.equal(weak.dueDate, '2026-10-29');
  assert.equal(strong.dueDate, '2026-11-19');
  assert.ok(weak.priority > strong.priority);
  const schedule = buildSchedule([entry()], [], DEFAULT_SETTINGS, NOW);
  assert.equal(schedule.get('e1').isDue, true);
  const manualEntry = entry({ dueDate: '2026-12-01', updatedAt: '2026-10-28T10:00:00.000Z' });
  const beforeReview = scheduleEntry(manualEntry, [], DEFAULT_SETTINGS, NOW);
  const afterReview = scheduleEntry(manualEntry, [review({ rating: 'good', localDate: '2026-10-30', completedAt: NOW.toISOString() })], DEFAULT_SETTINGS, NOW);
  assert.equal(beforeReview.dueDate, '2026-12-01');
  assert.equal(afterReview.dueDate, '2026-11-06');
});

test('الاختيار العشوائي يستبعد المقاطع المستخدمة داخل السلسلة', () => {
  const entries = [entry(), entry({ id: 'e2', from: 4, to: 7 })];
  const schedule = buildSchedule(entries, [], DEFAULT_SETTINGS, NOW);
  assert.equal(weightedRandomEntry(entries, schedule, new Set(['e1']), () => 0).id, 'e2');
  assert.equal(weightedRandomEntry(entries, schedule, new Set(['e1', 'e2']), () => 0), null);
});

test('لا تكتمل جلسة دون نص صالح، والنقر المزدوج ينتج سجلًا واحدًا', () => {
  const session = new ReviewSession({ entry: entry(), snapshot: entry(), mode: 'test' });
  assert.equal(session.beginCompletion('mastered'), null);
  assert.equal(session.markReady([{ number: 1, text: 'اختبار' }]), false);
  assert.equal(session.markReady([{ number: 1, text: 'أ' }, { number: 2, text: 'ب' }, { number: 3, text: 'ج' }]), true);
  const record = session.beginCompletion('mastered', 'ملاحظة');
  assert.ok(record);
  assert.equal(session.beginCompletion('mastered'), null);
  assert.equal(record.status, 'completed');
  assert.equal(record.notes, 'ملاحظة');
  assert.equal(session.finishCompletion(), true);
  assert.equal(session.cancel(), null);
});

test('إلغاء الجلسة يسجلها غير مكتملة ويحسب النشاط دون التوقف', () => {
  const realNow = Date.now;
  let now = 100000;
  Date.now = () => now;
  try {
    const session = new ReviewSession({ snapshot: entry() });
    now += 5000;
    session.pause();
    now += 10000;
    assert.equal(session.durationSeconds(), 5);
    session.resume();
    now += 3000;
    const record = session.cancel();
    assert.equal(record.status, 'incomplete');
    assert.equal(record.durationSeconds, 8);
  } finally { Date.now = realNow; }
});

test('الإحصائيات تستبعد المستقبل والملغاة ولا تكرر الآيات', () => {
  const entries = [entry(), entry({ id: 'e2', from: 3, to: 5 })];
  const reviews = [
    review({ id: 'today', sessionId: 'today', localDate: '2026-10-30', completedAt: NOW.toISOString(), mode: 'test', tested: true }),
    review({ id: 'old', sessionId: 'old', localDate: '2026-10-20', completedAt: '2026-10-20T10:00:00.000Z' }),
    review({ id: 'future', sessionId: 'future', localDate: '2026-11-01', completedAt: '2026-11-01T10:00:00.000Z' }),
    review({ id: 'cancel', sessionId: 'cancel', status: 'incomplete', localDate: '2026-10-30', completedAt: NOW.toISOString() }),
  ];
  const stats = computeStats(entries, reviews, DEFAULT_SETTINGS, NOW);
  assert.equal(stats.uniqueAyahs, 5);
  assert.equal(stats.completedSessions, 2);
  assert.equal(stats.testedAyahs, 3);
  assert.equal(stats.todayCount, 1);
  assert.equal(stats.streak, 1);
  assert.equal(stats.activity.reduce((sum, day) => sum + day.count, 0), 1);
});
