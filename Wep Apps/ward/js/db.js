/**
 * تطبيق وِرد | Wird
 * طبقة قاعدة البيانات المحلية باستخدام IndexedDB مع دعم احتياطي لبيئات WebView المقيدة
 */

const DB_NAME = 'WirdDB';
const DB_VERSION = 1;

class Database {
  constructor() {
    this.db = null;
    this.fallbackStorage = new Map();
    this.isIndexedDBSupported = typeof indexedDB !== 'undefined';
  }

  async init() {
    if (!this.isIndexedDBSupported) {
      console.warn('IndexedDB غير مدعوم في هذه البيئة، يتم استخدام التخزين البديل.');
      return this;
    }

    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          // جدول الأذكار والمحتوى
          if (!db.objectStoreNames.contains('items')) {
            const itemStore = db.createObjectStore('items', { keyPath: 'id' });
            itemStore.createIndex('collectionId', 'collectionId', { unique: false });
            itemStore.createIndex('isFavorite', 'isFavorite', { unique: false });
            itemStore.createIndex('isCustom', 'isCustom', { unique: false });
          }

          // جدول المجموعات وترتيبها
          if (!db.objectStoreNames.contains('collections')) {
            db.createObjectStore('collections', { keyPath: 'id' });
          }

          // جدول حالات الحفظ والتعلم
          if (!db.objectStoreNames.contains('learning_states')) {
            const stateStore = db.createObjectStore('learning_states', { keyPath: 'itemId' });
            stateStore.createIndex('status', 'status', { unique: false });
          }

          // جدول جدولات المراجعة المتباعدة
          if (!db.objectStoreNames.contains('review_schedules')) {
            const scheduleStore = db.createObjectStore('review_schedules', { keyPath: 'itemId' });
            scheduleStore.createIndex('nextReviewDate', 'nextReviewDate', { unique: false });
          }

          // جدول سجل المراجعات التاريخي
          if (!db.objectStoreNames.contains('review_logs')) {
            const logStore = db.createObjectStore('review_logs', { keyPath: 'id' });
            logStore.createIndex('itemId', 'itemId', { unique: false });
            logStore.createIndex('evaluatedAt', 'evaluatedAt', { unique: false });
          }

          // جدول تخصيص المقاطع
          if (!db.objectStoreNames.contains('custom_segments')) {
            db.createObjectStore('custom_segments', { keyPath: 'itemId' });
          }

          // جدول إعدادات التطبيق
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
          }
        };

        request.onsuccess = (event) => {
          this.db = event.target.result;
          resolve(this);
        };

        request.onerror = (event) => {
          console.error('فشل فتح IndexedDB:', event.target.error);
          // سنعتمد التخزين الاحتياطي بدلاً من الانهيار
          this.db = null;
          resolve(this);
        };
      } catch (err) {
        console.error('استثناء أثناء تهيئة IndexedDB:', err);
        this.db = null;
        resolve(this);
      }
    });
  }

  // --- عمليات عامة في المخازن ---

  async get(storeName, key) {
    if (!this.db) {
      const store = this.fallbackStorage.get(storeName);
      return store ? store.get(key) || null : null;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const req = store.get(key);

        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getAll(storeName) {
    if (!this.db) {
      const store = this.fallbackStorage.get(storeName);
      return store ? Array.from(store.values()) : [];
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async put(storeName, value) {
    if (!this.db) {
      if (!this.fallbackStorage.has(storeName)) {
        this.fallbackStorage.set(storeName, new Map());
      }
      const key = value.id || value.itemId || value.key;
      this.fallbackStorage.get(storeName).set(key, value);
      return value;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const req = store.put(value);

        req.onsuccess = () => resolve(value);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async delete(storeName, key) {
    if (!this.db) {
      const store = this.fallbackStorage.get(storeName);
      if (store) store.delete(key);
      return true;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const req = store.delete(key);

        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async clear(storeName) {
    if (!this.db) {
      this.fallbackStorage.delete(storeName);
      return true;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const req = store.clear();

        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getByIndex(storeName, indexName, value) {
    if (!this.db) {
      const all = await this.getAll(storeName);
      return all.filter(item => item[indexName] === value);
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        const req = index.getAll(value);

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }
}

export const db = new Database();
