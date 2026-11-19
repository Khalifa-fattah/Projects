/**
 * تطبيق وِرد | Wird
 * خدمة نظام الحفظ المتقدم (أوضاع: التعلم، الاسترجاع، الربط)
 */

import { db } from '../db.js';
import { ArabicSegmenter } from './segmenter.js';

export class MemoryService {
  /**
   * جلب مقاطع الذكر (مع مراعاة التخصيص اليدوي وفحص تغير النص)
   */
  static async getSegmentsForZikr(item) {
    if (!item || !item.text) return { segments: [], needsReview: false };

    const currentHash = ArabicSegmenter.computeTextHash(item.text);
    const customRecord = await db.get('custom_segments', item.id);

    if (customRecord && Array.isArray(customRecord.segments) && customRecord.segments.length > 0) {
      const needsReview = customRecord.textHash !== currentHash;
      return {
        segments: customRecord.segments,
        needsReview,
        isCustomized: true
      };
    }

    // تقسيم تلقائي افتراضي
    const autoSegments = ArabicSegmenter.segmentText(item.text);
    return {
      segments: autoSegments,
      needsReview: false,
      isCustomized: false
    };
  }

  /**
   * حفظ تقسيم مخصص لذكر
   */
  static async saveCustomSegments(itemId, segments, text) {
    const textHash = ArabicSegmenter.computeTextHash(text);
    await db.put('custom_segments', {
      itemId,
      segments,
      textHash,
      updatedAt: Date.now()
    });
  }

  /**
   * إعادة ضبط المقاطع إلى التقسيم التلقائي
   */
  static async resetSegments(itemId, text) {
    await db.delete('custom_segments', itemId);
    return ArabicSegmenter.segmentText(text);
  }

  /**
   * جلب أو إنشاء حالة الحفظ لذكر
   */
  static async getOrCreateLearningState(itemId) {
    let state = await db.get('learning_states', itemId);
    if (!state) {
      state = {
        itemId,
        status: 'learning',
        startedAt: Date.now(),
        currentMode: 'learn', // 'learn', 'recall', 'connect'
        currentSegmentIndex: 0,
        recallLevel: 1,       // 1: سهل, 2: متوسط, 3: متقدم
        consecutiveMasteredCount: 0,
        lastStudiedAt: Date.now()
      };
      await db.put('learning_states', state);
    }
    return state;
  }

  /**
   * تحديث حالة الحفظ
   */
  static async updateLearningState(state) {
    state.lastStudiedAt = Date.now();
    await db.put('learning_states', state);
    return state;
  }

  /**
   * تحضير نص المقطع لوضع الاسترجاع بناءً على مستوى الصعوبة
   * @param {string} segment النص الأصلي للمقطع
   * @param {number} level مستوى الصعوبة 1, 2, 3
   */
  static prepareRecallSegment(segment, level = 1) {
    const words = segment.split(/\s+/).filter(Boolean);
    if (words.length <= 1) return { maskedWords: [{ word: words[0] || '', isHidden: false }] };

    const maskedWords = [];

    if (level === 1) {
      // مستوى 1 (سهل): إخفاء آخر ربع/ثلث من كلمات المقطع
      const hideCount = Math.max(1, Math.floor(words.length * 0.35));
      const startIndexToHide = words.length - hideCount;

      words.forEach((word, idx) => {
        maskedWords.push({
          word,
          isHidden: idx >= startIndexToHide
        });
      });
    } else if (level === 2) {
      // مستوى 2 (متوسط): إخفاء الكلمات المتناوبة (كلمة ظاهرة وكلمة مخفية)
      words.forEach((word, idx) => {
        maskedWords.push({
          word,
          isHidden: idx % 2 === 1
        });
      });
    } else {
      // مستوى 3 (متقدم): إخفاء المقطع كاملاً باستثناء الكلمة المفتاحية الأولى
      words.forEach((word, idx) => {
        maskedWords.push({
          word,
          isHidden: idx > 0
        });
      });
    }

    return { maskedWords };
  }
}
