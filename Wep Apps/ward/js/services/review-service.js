/**
 * تطبيق وِرد | Wird
 * نظام وخوارزمية المراجعة المتباعدة (Spaced Repetition Algorithm)
 * 
 * القواعد الصارمة:
 * 1. "لم أتذكر":
 *    - إعادة الذكر بعد 10 دقائق ضمن الجلسة الحالية.
 *    - إعادة الذكر إلى مرحلة التعلم (learning).
 *    - إذا أُغلقت الجلسة، يُدرج فوراً للمراجعة في اليوم التالي بفاصل 0-1 يوم.
 * 2. "تذكرت بصعوبة":
 *    - أول مراجعة بعد 1 يوم.
 *    - المراجعات التالية: الفاصل السابق × 1.5 مع التقريب لأيام كاملة.
 * 3. "أتقنت الحفظ":
 *    - أول مراجعة بعد 2 يومين.
 *    - المراجعات التالية: الفاصل السابق × 2.0 مع التقريب لأيام كاملة.
 * 
 * الحد الأقصى للفاصل هو 90 يوماً.
 * جميع الحسابات حتمية واضحة ومخزنة محلياً.
 */

import { db } from '../db.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const MAX_INTERVAL_DAYS = 90;

export class ReviewService {
  /**
   * حساب موعد وفاصل المراجعة التالي بناءً على التقييم والفاصل السابق
   * دالة حتمية ونقية (Pure Function)
   */
  static calculateNextInterval(currentIntervalDays, rating) {
    let nextInterval = 0;

    switch (rating) {
      case 'forgot': // لم أتذكر
        nextInterval = 0; // سيُعاد خلال 10 دقائق أو في الغد
        break;

      case 'hard': // تذكرت بصعوبة
        if (!currentIntervalDays || currentIntervalDays <= 0) {
          nextInterval = 1; // أول مراجعة بعد يوم واحد
        } else {
          nextInterval = Math.round(currentIntervalDays * 1.5);
        }
        break;

      case 'mastered': // أتقنت الحفظ
        if (!currentIntervalDays || currentIntervalDays <= 0) {
          nextInterval = 2; // أول مراجعة بعد يومين
        } else {
          nextInterval = Math.round(currentIntervalDays * 2.0);
        }
        break;

      default:
        nextInterval = 1;
    }

    // الالتزام بالحد الأقصى (90 يوماً)
    if (nextInterval > MAX_INTERVAL_DAYS) {
      nextInterval = MAX_INTERVAL_DAYS;
    }

    return nextInterval;
  }

  /**
   * تسجيل نتيجة مراجعة لذكر معين وتحديث الجدول وسجل المراجعة
   */
  static async recordReview(itemId, rating, isInSession = false) {
    const now = Date.now();
    let schedule = await db.get('review_schedules', itemId);
    let learningState = await db.get('learning_states', itemId);

    if (!schedule) {
      schedule = {
        itemId,
        intervalDays: 0,
        lastReviewDate: 0,
        nextReviewDate: now,
        ratingHistory: [],
        reviewCount: 0,
        state: 'scheduled'
      };
    }

    if (!learningState) {
      learningState = {
        itemId,
        status: 'learning',
        startedAt: now,
        currentMode: 'learn',
        currentSegmentIndex: 0,
        recallLevel: 1,
        consecutiveMasteredCount: 0,
        lastStudiedAt: now
      };
    }

    const prevInterval = schedule.intervalDays || 0;
    const nextInterval = this.calculateNextInterval(prevInterval, rating);

    let nextReviewDate = now;
    if (rating === 'forgot') {
      // بعد 10 دقائق إذا كان في الجلسة، أو غداً
      nextReviewDate = isInSession ? (now + TEN_MINUTES_MS) : (now + DAY_MS);
      learningState.status = 'learning';
      learningState.consecutiveMasteredCount = 0;
    } else {
      nextReviewDate = now + (nextInterval * DAY_MS);
      if (rating === 'mastered') {
        learningState.consecutiveMasteredCount = (learningState.consecutiveMasteredCount || 0) + 1;
        // إذا أتقن مرتين متتاليتين يعتبر متقناً
        if (learningState.consecutiveMasteredCount >= 2) {
          learningState.status = 'mastered';
        } else {
          learningState.status = 'reviewing';
        }
      } else {
        // تذكرت بصعوبة
        learningState.consecutiveMasteredCount = 0;
        learningState.status = 'reviewing';
      }
    }

    // تحديث الجدولة
    schedule.intervalDays = nextInterval;
    schedule.lastReviewDate = now;
    schedule.nextReviewDate = nextReviewDate;
    schedule.ratingHistory.push(rating);
    schedule.reviewCount = (schedule.reviewCount || 0) + 1;
    schedule.state = 'scheduled';

    // حفظ في السجل التاريخي
    const logEntry = {
      id: 'rev_' + now + '_' + Math.random().toString(36).substr(2, 6),
      itemId,
      evaluatedAt: now,
      rating,
      intervalDays: nextInterval,
      nextReviewDate
    };

    await db.put('review_schedules', schedule);
    await db.put('learning_states', learningState);
    await db.put('review_logs', logEntry);

    return { schedule, learningState, logEntry };
  }

  /**
   * جلب الأذكار المستحقة للمراجعة اليوم
   */
  static async getDueReviews() {
    const allSchedules = await db.getAll('review_schedules');
    const now = Date.now();
    // المستحق: أي ذكر موعد مراجعته الآن أو قبل نهاية اليوم الحالي
    const endOfToday = new Date().setHours(23, 59, 59, 999);

    const dueList = [];
    for (const schedule of allSchedules) {
      if (schedule.nextReviewDate <= endOfToday) {
        dueList.push(schedule);
      }
    }

    return dueList.sort((a, b) => a.nextReviewDate - b.nextReviewDate);
  }

  /**
   * تأجيل مراجعة ذكر لعدد من الأيام
   */
  static async postponeReview(itemId, days = 1) {
    const schedule = await db.get('review_schedules', itemId);
    if (!schedule) return null;

    const addedMs = days * DAY_MS;
    schedule.nextReviewDate = Math.max(Date.now(), schedule.nextReviewDate) + addedMs;
    schedule.state = 'postponed';

    await db.put('review_schedules', schedule);
    return schedule;
  }

  /**
   * تعديل موعد المراجعة يدوياً بواسطة المستخدم
   */
  static async setManualReviewDate(itemId, targetDateTimestamp) {
    const schedule = await db.get('review_schedules', itemId);
    if (!schedule) return null;

    schedule.nextReviewDate = targetDateTimestamp;
    schedule.state = 'scheduled';

    await db.put('review_schedules', schedule);
    return schedule;
  }

  /**
   * جلب إحصائيات المراجعات الحقيقية
   */
  static async getReviewStats() {
    const allLogs = await db.getAll('review_logs');
    const allSchedules = await db.getAll('review_schedules');
    const allLearningStates = await db.getAll('learning_states');

    const dueList = await this.getDueReviews();

    const startedCount = allLearningStates.filter(s => s.status !== 'not_started').length;
    const masteredCount = allLearningStates.filter(s => s.status === 'mastered').length;
    const totalReviewsCompleted = allLogs.length;

    // آخر نشاط
    let lastActivity = null;
    if (allLogs.length > 0) {
      const sortedLogs = [...allLogs].sort((a, b) => b.evaluatedAt - a.evaluatedAt);
      lastActivity = sortedLogs[0];
    }

    return {
      dueCount: dueList.length,
      startedCount,
      masteredCount,
      totalReviewsCompleted,
      lastActivity
    };
  }
}
