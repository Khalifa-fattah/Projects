import test from 'node:test';
import assert from 'node:assert/strict';
import { SafeStorage, STORAGE_KEYS, StorageError } from '../js/storage.js';
import { QuranApi } from '../js/quran-api.js';

class MockStorage {
  constructor() { this.map = new Map(); this.fail = null; }
  getItem(key) { if (this.fail === 'read') throw new Error('read'); return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) {
    if (this.fail === 'quota') { const error = new Error('quota'); error.name = 'QuotaExceededError'; throw error; }
    if (this.fail === 'write') throw new Error('write');
    this.map.set(key, String(value));
  }
}

const legacyEntry = { id: 'legacy', surah: 1, surahName: 'قديم', from: 1, to: 2, dateAdded: '2026-10-01', lastReviewed: null, reviewCount: 0 };

test('ترحيل البيانات القديمة مع الاحتفاظ بالمفتاح ونسخة سابقة', () => {
  const mock = new MockStorage();
  mock.setItem(STORAGE_KEYS.entries, JSON.stringify([legacyEntry]));
  const storage = new SafeStorage(mock);
  const entries = storage.loadEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].mastery, 'unrated');
  assert.equal(entries[0].surahName, 'سُورَةُ ٱلْفَاتِحَةِ');
  assert.ok(mock.getItem(`${STORAGE_KEYS.entries}_previous_v1`).includes('قديم'));
  assert.ok(mock.getItem(STORAGE_KEYS.entries));
});

test('JSON التالف لا يُستبدل بمصفوفة فارغة ويمنع الكتابة', () => {
  const mock = new MockStorage();
  mock.setItem(STORAGE_KEYS.entries, '{broken');
  const storage = new SafeStorage(mock);
  assert.deepEqual(storage.loadEntries(), []);
  assert.equal(mock.getItem(STORAGE_KEYS.entries), '{broken');
  assert.equal(mock.getItem(`${STORAGE_KEYS.entries}_corrupt_v1`), '{broken');
  assert.throws(() => storage.saveEntries([]), (error) => error instanceof StorageError && error.code === 'readonly');
});

test('فشل الكتابة وامتلاء المساحة يظهران خطأ ولا نجاحًا', () => {
  const mock = new MockStorage();
  const storage = new SafeStorage(mock);
  mock.fail = 'quota';
  assert.throws(() => storage.saveEntries([]), /ممتلئة/);
  assert.equal(mock.getItem(STORAGE_KEYS.entries), null);
  mock.fail = 'write';
  assert.throws(() => storage.saveReviews([]), /فشل الحفظ/);
});

test('القيمة المكتوبة تُقرأ للتحقق منها وتبقى النسخة السابقة', () => {
  const mock = new MockStorage();
  const storage = new SafeStorage(mock);
  storage.saveEntries([legacyEntry]);
  storage.saveEntries([]);
  assert.deepEqual(JSON.parse(mock.getItem(STORAGE_KEYS.entries)), []);
  assert.deepEqual(JSON.parse(mock.getItem(`${STORAGE_KEYS.entries}_previous_v1`)), [legacyEntry]);
});

function apiFixture({ invalid = false } = {}) {
  return async (url) => {
    if (url.includes('meta.json')) return { ok: true, json: async () => ({ available: false }) };
    const ayahs = Array.from({ length: invalid ? 6 : 7 }, (_, index) => ({ numberInSurah: index + 1, text: `نص اختباري ${index + 1}` }));
    return { ok: true, json: async () => ({ code: 200, data: { number: 1, ayahs } }) };
  };
}

test('API يتحقق من السورة والآيات ثم يخزن النص الصالح', async () => {
  const mock = new MockStorage();
  const storage = new SafeStorage(mock);
  const api = new QuranApi({ storage, fetchImpl: apiFixture() });
  const range = await api.getRange(1, 2, 4);
  assert.equal(range.length, 3);
  assert.equal(range[0].number, 2);
  const cached = JSON.parse(mock.getItem(STORAGE_KEYS.quranCache));
  assert.equal(cached[1].length, 7);
});

test('الرد الناقص يُرفض ولا يدخل ذاكرة التخزين', async () => {
  const mock = new MockStorage();
  const storage = new SafeStorage(mock);
  const api = new QuranApi({ storage, fetchImpl: apiFixture({ invalid: true }) });
  await assert.rejects(() => api.getSurahAyahs(1), /عدد آياتها|ناقصة/);
  assert.equal(mock.getItem(STORAGE_KEYS.quranCache), null);
});

test('السورة غير المخزنة دون اتصال تعطي رسالة صريحة', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
  try {
    const storage = new SafeStorage(new MockStorage());
    const api = new QuranApi({ storage, fetchImpl: apiFixture() });
    await assert.rejects(() => api.getSurahAyahs(1), (error) => error.code === 'offline-missing');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else delete globalThis.navigator;
  }
});

test('النسخة القديمة المخزنة تُستخدم فقط بعد التحقق من اكتمالها', async () => {
  const mock = new MockStorage();
  mock.setItem(STORAGE_KEYS.quranCache, JSON.stringify({ 1: Array.from({ length: 7 }, (_, i) => `نص ${i}`) }));
  const storage = new SafeStorage(mock);
  let apiCalls = 0;
  const fetchImpl = async (url) => { if (!url.includes('meta.json')) apiCalls += 1; return apiFixture()(url); };
  const api = new QuranApi({ storage, fetchImpl });
  const result = await api.getRange(1, 1, 7);
  assert.equal(result.length, 7);
  assert.equal(apiCalls, 0);
});
