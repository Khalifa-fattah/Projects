/**
 * تطبيق وِرد | Wird
 * خدمة إدارة الأذكار والمجموعات والترتيب والمفضلة
 */

import { db } from '../db.js';
import { DEFAULT_COLLECTIONS, DEFAULT_AZKAR } from '../data/default-azkar.js';
import { ArabicSegmenter } from './segmenter.js';

export class AzkarService {
  /**
   * تهيئة البيانات الافتراضية عند أول تشغيل للتطبيق
   */
  static async initDefaults() {
    const existingCollections = await db.getAll('collections');
    if (existingCollections.length === 0) {
      for (const col of DEFAULT_COLLECTIONS) {
        // جمع المعرفات الافتراضية الخاصة بهذه المجموعة
        const defaultItems = DEFAULT_AZKAR.filter(item => item.collectionId === col.id);
        const defaultOrder = defaultItems.sort((a, b) => a.order - b.order).map(i => i.id);

        await db.put('collections', {
          ...col,
          defaultOrder,
          customOrder: [...defaultOrder]
        });
      }
    }

    const existingItems = await db.getAll('items');
    if (existingItems.length === 0) {
      for (const item of DEFAULT_AZKAR) {
        await db.put('items', {
          ...item,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
    }
  }

  /**
   * جلب جميع المجموعات مع مراعاة عدد الأذكار في كل منها
   */
  static async getCollections() {
    await this.initDefaults();
    const collections = await db.getAll('collections');
    const allItems = await db.getAll('items');

    return collections.map(col => {
      const items = allItems.filter(i => i.collectionId === col.id);
      return {
        ...col,
        count: items.length
      };
    });
  }

  /**
   * جلب مجموعة محددة بالمعرف
   */
  static async getCollectionById(collectionId) {
    await this.initDefaults();
    return await db.get('collections', collectionId);
  }

  /**
   * جلب الأذكار داخل تصنيف معين وفق الترتيب المعتمد (الترتيب المخصص للمستخدم أو الافتراضي)
   */
  static async getAzkarByCollection(collectionId) {
    await this.initDefaults();
    const collection = await db.get('collections', collectionId);
    const allItems = await db.getAll('items');
    const collectionItems = allItems.filter(item => item.collectionId === collectionId);

    const orderList = collection?.customOrder && collection.customOrder.length > 0 
      ? collection.customOrder 
      : collection?.defaultOrder || [];

    // الترتيب وفق القائمة المحفوظة
    collectionItems.sort((a, b) => {
      let indexA = orderList.indexOf(a.id);
      let indexB = orderList.indexOf(b.id);
      if (indexA === -1) indexA = 9999;
      if (indexB === -1) indexB = 9999;
      return indexA - indexB;
    });

    return collectionItems;
  }

  /**
   * حفظ ترتيب مخصص للأذكار داخل المجموعة
   */
  static async saveCollectionOrder(collectionId, orderedIds) {
    const col = await db.get('collections', collectionId);
    if (!col) return false;

    col.customOrder = orderedIds;
    await db.put('collections', col);
    return true;
  }

  /**
   * استعادة الترتيب الافتراضي لمجموعة معينة
   */
  static async resetCollectionOrder(collectionId) {
    const col = await db.get('collections', collectionId);
    if (!col) return false;

    col.customOrder = [...col.defaultOrder];
    await db.put('collections', col);
    return true;
  }

  /**
   * جلب ذكر واحد بمعرفه
   */
  static async getZikrById(id) {
    await this.initDefaults();
    return await db.get('items', id);
  }

  /**
   * جلب الذكر السابق واللاحق وفق ترتيب المجموعة الحالي
   */
  static async getAdjacentAzkar(collectionId, currentId) {
    const list = await this.getAzkarByCollection(collectionId);
    const index = list.findIndex(item => item.id === currentId);

    if (index === -1) {
      return { prev: null, next: null, currentIndex: 0, total: list.length };
    }

    const prev = index > 0 ? list[index - 1] : null;
    const next = index < list.length - 1 ? list[index + 1] : null;

    return {
      prev,
      next,
      currentIndex: index + 1,
      total: list.length
    };
  }

  /**
   * تبديل حالة المفضلة
   */
  static async toggleFavorite(id) {
    const item = await db.get('items', id);
    if (!item) return false;

    item.isFavorite = !item.isFavorite;
    item.updatedAt = Date.now();
    await db.put('items', item);
    return item.isFavorite;
  }

  /**
   * جلب جميع الأذكار المفضلة
   */
  static async getFavorites() {
    await this.initDefaults();
    const allItems = await db.getAll('items');
    return allItems.filter(item => item.isFavorite);
  }

  /**
   * إضافة ذكر شخصي جديد
   */
  static async addCustomZikr(data) {
    const now = Date.now();
    const id = 'custom_' + now + '_' + Math.random().toString(36).substr(2, 6);

    const newItem = {
      id,
      collectionId: data.collectionId || 'general',
      order: 999,
      title: data.title.trim(),
      text: data.text.trim(),
      source: data.source ? data.source.trim() : 'دعاء خاص أضافه المستخدم',
      hadithGrade: data.hadithGrade ? data.hadithGrade.trim() : 'محتوى شخصي',
      repetitions: parseInt(data.repetitions, 10) || 1,
      isCustom: true,
      isModified: false,
      isFavorite: !!data.isFavorite,
      createdAt: now,
      updatedAt: now
    };

    await db.put('items', newItem);

    // إضافة الذكر إلى نهاية ترتيب المجموعة
    const col = await db.get('collections', newItem.collectionId);
    if (col) {
      if (!col.customOrder) col.customOrder = [...col.defaultOrder];
      col.customOrder.push(id);
      await db.put('collections', col);
    }

    return newItem;
  }

  /**
   * تعديل ذكر (مع الحفاظ على النص الأصلي في حال كان ذكراً افتراضياً)
   */
  static async updateZikr(id, updateData) {
    const item = await db.get('items', id);
    if (!item) return null;

    const now = Date.now();

    if (!item.isCustom) {
      // ذكر افتراضي: الاحتفاظ بالنص والمرجع الأصلي
      if (!item.isModified) {
        item.originalText = item.text;
        item.originalSource = item.source;
        item.originalGrade = item.hadithGrade;
      }
      item.isModified = true;
    }

    item.title = updateData.title ? updateData.title.trim() : item.title;
    item.text = updateData.text ? updateData.text.trim() : item.text;
    if (updateData.source !== undefined) item.source = updateData.source.trim();
    if (updateData.hadithGrade !== undefined) item.hadithGrade = updateData.hadithGrade.trim();
    if (updateData.repetitions !== undefined) item.repetitions = parseInt(updateData.repetitions, 10) || 1;
    if (updateData.collectionId && updateData.collectionId !== item.collectionId) {
      // إزالة من ترتيب المجموعة السابقة وإضافة للمجموعة الجديدة
      const oldCol = await db.get('collections', item.collectionId);
      if (oldCol && oldCol.customOrder) {
        oldCol.customOrder = oldCol.customOrder.filter(itemId => itemId !== id);
        await db.put('collections', oldCol);
      }
      item.collectionId = updateData.collectionId;
      const newCol = await db.get('collections', item.collectionId);
      if (newCol) {
        if (!newCol.customOrder) newCol.customOrder = [...newCol.defaultOrder];
        newCol.customOrder.push(id);
        await db.put('collections', newCol);
      }
    }
    item.updatedAt = now;

    await db.put('items', item);
    return item;
  }

  /**
   * حذف ذكر شخصي
   */
  static async deleteCustomZikr(id) {
    const item = await db.get('items', id);
    if (!item || !item.isCustom) {
      // الأذكار الافتراضية لا تُحذف منعاً لفقدان المحتوى الأساسي
      return false;
    }

    // إزالة من ترتيب المجموعة
    const col = await db.get('collections', item.collectionId);
    if (col && col.customOrder) {
      col.customOrder = col.customOrder.filter(itemId => itemId !== id);
      await db.put('collections', col);
    }

    // إزالة من جدول الأذكار
    await db.delete('items', id);
    await db.delete('learning_states', id);
    await db.delete('review_schedules', id);
    await db.delete('custom_segments', id);

    return true;
  }

  /**
   * البحث في الأذكار بالعنوان أو جزء من النص مع تطبيع التشكيل
   */
  static async searchAzkar(query) {
    if (!query || !query.trim()) return [];

    await this.initDefaults();
    const allItems = await db.getAll('items');
    const normalizedQuery = ArabicSegmenter.stripTashkeel(query).toLowerCase();

    return allItems.filter(item => {
      const cleanTitle = ArabicSegmenter.stripTashkeel(item.title).toLowerCase();
      const cleanText = ArabicSegmenter.stripTashkeel(item.text).toLowerCase();
      const cleanSource = ArabicSegmenter.stripTashkeel(item.source || '').toLowerCase();

      return cleanTitle.includes(normalizedQuery) ||
             cleanText.includes(normalizedQuery) ||
             cleanSource.includes(normalizedQuery);
    });
  }
}
