import { migrateEntries, migrateReviews, migrateScheduleEvents } from './migrations.js';

export const STORAGE_KEYS = Object.freeze({
  entries: 'quran_hifz_entries_v1',
  quranCache: 'quran_text_cache_v1',
  reviews: 'quran_review_sessions_v1',
  settings: 'quran_settings_v2',
  schedule: 'quran_schedule_events_v1',
  legacyTheme: 'quran_theme_v1',
  preImportBackup: 'quran_pre_import_backup_v1',
});

export class StorageError extends Error {
  constructor(message, code = 'storage') {
    super(message);
    this.name = 'StorageError';
    this.code = code;
  }
}

/**
 * لا تُستبدل القيمة التالفة بقائمة فارغة. عند فشل القراءة يصبح المفتاح للقراءة فقط،
 * وتبقى القيمة الأصلية في مكانها مع نسخة إنقاذ إضافية متى سمحت المساحة.
 */
export class SafeStorage {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.readOnlyKeys = new Set();
    this.warnings = [];
  }

  getRaw(key) {
    try {
      if (!this.storage) throw new Error('unavailable');
      return this.storage.getItem(key);
    } catch (error) {
      this.readOnlyKeys.add(key);
      throw new StorageError('تعذر الوصول إلى التخزين المحلي. لم تُعدّل بياناتك.', 'read');
    }
  }

  readJson(key) {
    const raw = this.getRaw(key);
    if (raw === null || raw === '') return { value: null, raw, missing: true };
    try {
      return { value: JSON.parse(raw), raw, missing: false };
    } catch (error) {
      this.readOnlyKeys.add(key);
      try {
        const rescueKey = `${key}_corrupt_v1`;
        if (this.storage.getItem(rescueKey) !== raw) this.storage.setItem(rescueKey, raw);
      } catch { /* الأصل محفوظ في مكانه حتى لو تعذر إنشاء نسخة الإنقاذ. */ }
      this.warnings.push(`توجد بيانات تالفة في «${key}». لم نستبدلها؛ صدّرها أو استعد نسخة صالحة قبل الحفظ.`);
      return { value: null, raw, missing: false, corrupt: true };
    }
  }

  writeJson(key, value, { createPreviousBackup = false } = {}) {
    if (this.readOnlyKeys.has(key)) {
      throw new StorageError('الحفظ متوقف لحماية بيانات تالفة موجودة. استعد نسخة سليمة أولًا.', 'readonly');
    }
    let serialized;
    try {
      serialized = JSON.stringify(value);
      if (serialized === undefined) throw new Error('undefined');
    } catch {
      throw new StorageError('تعذر تجهيز البيانات للحفظ.', 'serialize');
    }
    try {
      if (!this.storage) throw new Error('unavailable');
      const previous = this.storage.getItem(key);
      if (createPreviousBackup && previous !== null) {
        this.storage.setItem(`${key}_previous_v1`, previous);
      }
      this.storage.setItem(key, serialized);
      if (this.storage.getItem(key) !== serialized) throw new Error('verification');
      return true;
    } catch (error) {
      const quota = error?.name === 'QuotaExceededError' || error?.code === 22;
      throw new StorageError(
        quota
          ? 'مساحة التخزين ممتلئة. لم تُحفظ التغييرات؛ صدّر نسخة احتياطية ثم حرّر مساحة.'
          : 'فشل الحفظ في التخزين المحلي. لم تظهر العملية كأنها ناجحة.',
        quota ? 'quota' : 'write',
      );
    }
  }

  loadEntries() {
    const result = this.readJson(STORAGE_KEYS.entries);
    if (result.missing) return [];
    if (result.corrupt) return [];
    const migration = migrateEntries(result.value);
    if (migration.invalidCount > 0) {
      this.readOnlyKeys.add(STORAGE_KEYS.entries);
      this.warnings.push(`عُزلت ${migration.invalidCount} سجلات غير صالحة، وأوقف الحفظ لحماية الملف الأصلي. صدّر البيانات الخام للمراجعة.`);
      return migration.entries;
    }
    if (migration.changed) {
      try {
        this.writeJson(STORAGE_KEYS.entries, migration.entries, { createPreviousBackup: true });
        this.warnings.push('حُدّثت بنية المحفوظات القديمة مع الاحتفاظ بنسخة من صيغتها السابقة.');
      } catch (error) {
        this.readOnlyKeys.add(STORAGE_KEYS.entries);
        this.warnings.push(`تعذر ترحيل المحفوظات بأمان: ${error.message}`);
      }
    }
    return migration.entries;
  }

  saveEntries(entries) {
    return this.writeJson(STORAGE_KEYS.entries, entries, { createPreviousBackup: true });
  }

  loadReviews() {
    const result = this.readJson(STORAGE_KEYS.reviews);
    if (result.missing) return [];
    if (result.corrupt) return [];
    const migration = migrateReviews(result.value);
    if (migration.invalidCount > 0) {
      this.readOnlyKeys.add(STORAGE_KEYS.reviews);
      this.warnings.push('سجل المراجعات يحتوي بيانات غير صالحة؛ أوقف تسجيل مراجعات جديدة لحماية الأصل.');
      return migration.reviews;
    }
    if (migration.changed) this.writeJson(STORAGE_KEYS.reviews, migration.reviews, { createPreviousBackup: true });
    return migration.reviews;
  }

  saveReviews(reviews) {
    return this.writeJson(STORAGE_KEYS.reviews, reviews, { createPreviousBackup: true });
  }

  loadScheduleEvents() {
    const result = this.readJson(STORAGE_KEYS.schedule);
    if (result.missing) return [];
    if (result.corrupt) return [];
    const migration = migrateScheduleEvents(result.value);
    if (migration.invalidCount > 0) {
      this.readOnlyKeys.add(STORAGE_KEYS.schedule);
      this.warnings.push('تعذر التحقق من بعض أحداث الجدولة؛ لم تُحذف من التخزين.');
    }
    return migration.events;
  }

  saveScheduleEvents(events) {
    return this.writeJson(STORAGE_KEYS.schedule, events, { createPreviousBackup: true });
  }

  loadTextCache() {
    const result = this.readJson(STORAGE_KEYS.quranCache);
    if (!result.value || typeof result.value !== 'object' || Array.isArray(result.value)) return {};
    return result.value;
  }

  saveTextCache(cache) {
    return this.writeJson(STORAGE_KEYS.quranCache, cache);
  }

  rawUserData() {
    const data = {};
    Object.values(STORAGE_KEYS).forEach((key) => {
      try { data[key] = this.storage?.getItem(key) ?? null; } catch { data[key] = null; }
    });
    return data;
  }
}
