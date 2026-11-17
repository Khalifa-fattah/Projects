/**
 * تطبيق وِرد | Wird
 * خدمة النسخ الاحتياطي والاستعادة الآمنة
 */

import { db } from '../db.js';

export class BackupService {
  /**
   * حساب بصمة تدقيقية سريعة وموثوقة لمحتوى النسخة الاحتياطية
   */
  static generateChecksum(dataStr) {
    let hash = 5381;
    for (let i = 0; i < dataStr.length; i++) {
      hash = ((hash << 5) + hash) + dataStr.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * تصدير جميع بيانات التطبيق إلى كائن JSON متكامل
   */
  static async exportData() {
    const allItems = await db.getAll('items');
    const personalAzkar = allItems.filter(i => i.isCustom);
    const modifiedAzkar = allItems.filter(i => !i.isCustom && i.isModified);
    const favorites = allItems.filter(i => i.isFavorite).map(i => i.id);

    const collections = await db.getAll('collections');
    const learningStates = await db.getAll('learning_states');
    const customSegments = await db.getAll('custom_segments');
    const reviewLogs = await db.getAll('review_logs');
    const reviewSchedules = await db.getAll('review_schedules');
    const settings = await db.getAll('settings');

    const payload = {
      app: 'Wird',
      appNameAr: 'وِرد للأذكار والأدعية',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      data: {
        personalAzkar,
        modifiedAzkar,
        favorites,
        collections,
        learningStates,
        customSegments,
        reviewLogs,
        reviewSchedules,
        settings
      }
    };

    const serializedData = JSON.stringify(payload.data);
    payload.checksum = this.generateChecksum(serializedData);

    return payload;
  }

  /**
   * تنزيل ملف النسخة الاحتياطية كملف JSON
   */
  static async downloadBackupFile() {
    const backupData = await this.exportData();
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const dateStr = new Date().toISOString().split('T')[0];
    const link = document.createElement('a');
    link.href = url;
    link.download = `wird-backup-${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * فحص والتحقق من صحة ملف النسخة الاحتياطية قبل الاستعادة
   */
  static validateBackup(backupJson) {
    if (!backupJson || typeof backupJson !== 'object') {
      return { isValid: false, error: 'صيغة الملف غير صحيحة أو تالفة.' };
    }

    if (backupJson.app !== 'Wird') {
      return { isValid: false, error: 'هذا الملف لا ينتمي لتطبيق «وِرد».' };
    }

    if (!backupJson.version || !backupJson.data) {
      return { isValid: false, error: 'بيانات النسخة الاحتياطية غير مكتملة أو تفتقر إلى الإصدار.' };
    }

    // التحقق من البصمة الرقمية
    if (backupJson.checksum) {
      const serialized = JSON.stringify(backupJson.data);
      const computedChecksum = this.generateChecksum(serialized);
      if (computedChecksum !== backupJson.checksum) {
        return { isValid: false, error: 'الملف تالف أو تم تعديله بصورة غير متوافقة (فشل فحص البصمة).' };
      }
    }

    const { personalAzkar, collections, reviewLogs } = backupJson.data;

    // التحقق من الحقول الإلزامية للأذكار الشخصية
    if (personalAzkar && Array.isArray(personalAzkar)) {
      for (const item of personalAzkar) {
        if (!item.id || !item.title || !item.text) {
          return { isValid: false, error: 'يحتوي الملف على أذكار تفتقر للحقول الأساسية (المعرف، العنوان، النص).' };
        }
      }
    }

    const summary = {
      personalCount: Array.isArray(personalAzkar) ? personalAzkar.length : 0,
      modifiedCount: Array.isArray(backupJson.data.modifiedAzkar) ? backupJson.data.modifiedAzkar.length : 0,
      favoritesCount: Array.isArray(backupJson.data.favorites) ? backupJson.data.favorites.length : 0,
      collectionsCount: Array.isArray(collections) ? collections.length : 0,
      reviewsCount: Array.isArray(reviewLogs) ? reviewLogs.length : 0,
      exportedAt: backupJson.exportedAt
    };

    return { isValid: true, summary, validatedData: backupJson.data };
  }

  /**
   * تطبيق الاستعادة الآمنة للبيانات
   */
  static async restoreBackup(validatedData) {
    try {
      // 1. استعادة الأذكار الشخصية والمعدلة
      if (Array.isArray(validatedData.personalAzkar)) {
        for (const item of validatedData.personalAzkar) {
          // تطهير المدخلات والتأكد من أنها نصوص فقط
          await db.put('items', {
            id: String(item.id),
            collectionId: String(item.collectionId || 'general'),
            order: Number(item.order) || 999,
            title: String(item.title).slice(0, 300),
            text: String(item.text).slice(0, 10000),
            source: String(item.source || '').slice(0, 500),
            hadithGrade: String(item.hadithGrade || '').slice(0, 200),
            repetitions: Number(item.repetitions) || 1,
            isCustom: true,
            isModified: false,
            isFavorite: Boolean(item.isFavorite),
            createdAt: Number(item.createdAt) || Date.now(),
            updatedAt: Date.now()
          });
        }
      }

      if (Array.isArray(validatedData.modifiedAzkar)) {
        for (const item of validatedData.modifiedAzkar) {
          const current = await db.get('items', item.id);
          if (current) {
            current.title = String(item.title || current.title);
            current.text = String(item.text || current.text);
            current.source = String(item.source || current.source);
            current.hadithGrade = String(item.hadithGrade || current.hadithGrade);
            current.repetitions = Number(item.repetitions) || current.repetitions;
            current.isModified = true;
            current.originalText = item.originalText || current.originalText;
            current.originalSource = item.originalSource || current.originalSource;
            current.originalGrade = item.originalGrade || current.originalGrade;
            await db.put('items', current);
          }
        }
      }

      // 2. استعادة المفضلة
      if (Array.isArray(validatedData.favorites)) {
        for (const favId of validatedData.favorites) {
          const item = await db.get('items', favId);
          if (item) {
            item.isFavorite = true;
            await db.put('items', item);
          }
        }
      }

      // 3. استعادة ترتيب المجموعات
      if (Array.isArray(validatedData.collections)) {
        for (const col of validatedData.collections) {
          const existingCol = await db.get('collections', col.id);
          if (existingCol && Array.isArray(col.customOrder)) {
            existingCol.customOrder = col.customOrder;
            await db.put('collections', existingCol);
          }
        }
      }

      // 4. استعادة حالات التعلم
      if (Array.isArray(validatedData.learningStates)) {
        for (const st of validatedData.learningStates) {
          await db.put('learning_states', st);
        }
      }

      // 5. استعادة المقاطع المخصصة
      if (Array.isArray(validatedData.customSegments)) {
        for (const seg of validatedData.customSegments) {
          await db.put('custom_segments', seg);
        }
      }

      // 6. استعادة المراجعات وجدول المراجعات
      if (Array.isArray(validatedData.reviewSchedules)) {
        for (const sch of validatedData.reviewSchedules) {
          await db.put('review_schedules', sch);
        }
      }

      if (Array.isArray(validatedData.reviewLogs)) {
        for (const log of validatedData.reviewLogs) {
          await db.put('review_logs', log);
        }
      }

      // 7. استعادة الإعدادات
      if (Array.isArray(validatedData.settings)) {
        for (const s of validatedData.settings) {
          await db.put('settings', s);
        }
      }

      return { success: true };
    } catch (err) {
      console.error('فشل استعادة النسخة الاحتياطية:', err);
      return { success: false, error: err.message };
    }
  }
}
