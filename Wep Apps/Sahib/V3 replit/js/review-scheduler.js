import { addDays, compareDateKeys, daysBetween, isValidDateKey, localDateKey, validTimestamp } from './utils.js';

export function completedReviewsForEntry(reviews, entryId, now = Date.now()) {
  return reviews.filter((review) => review.entryId === entryId
    && review.status === 'completed'
    && validTimestamp(review.completedAt || review.startedAt, { now }) !== null);
}

export function latestEntryReview(reviews, entryId, now = Date.now()) {
  return completedReviewsForEntry(reviews, entryId, now).sort((a, b) =>
    new Date(b.completedAt || b.startedAt) - new Date(a.completedAt || a.startedAt))[0] || null;
}

function legacyReviewDate(entry, today) {
  return isValidDateKey(entry.lastReviewed) && compareDateKeys(entry.lastReviewed, today) <= 0
    ? entry.lastReviewed : null;
}

export function scheduleEntry(entry, reviews, settings, now = new Date()) {
  const today = localDateKey(now);
  const latest = latestEntryReview(reviews, entry.id, now.getTime());
  const allCompleted = completedReviewsForEntry(reviews, entry.id, now.getTime());
  const failedCount = allCompleted.filter((review) => ['failed', 'soon'].includes(review.rating)).length;
  const legacyDate = latest ? null : legacyReviewDate(entry, today);
  const lastDate = isValidDateKey(latest?.localDate) && compareDateKeys(latest.localDate, today) <= 0
    ? latest.localDate : legacyDate;
  const rating = latest?.rating || null;
  let interval = settings.intervals.newEntry;
  if (rating) interval = settings.intervals[rating];
  else if (lastDate) interval = settings.intervals.good;
  else if (entry.mastery === 'mastered') interval = settings.intervals.mastered;
  else if (entry.mastery === 'good') interval = settings.intervals.good;
  else if (entry.mastery === 'learning') interval = settings.intervals.soon;
  else if (entry.mastery === 'new') interval = 0;
  const baseDate = lastDate || entry.startDate || entry.dateAdded || today;
  const calculatedDue = addDays(baseDate, interval) || today;
  const latestTime = latest ? new Date(latest.completedAt || latest.startedAt).getTime() : null;
  const manualTime = entry.updatedAt ? new Date(entry.updatedAt).getTime() : null;
  const manualScheduleIsCurrent = isValidDateKey(entry.dueDate)
    && (!latest || (Number.isFinite(manualTime) && Number.isFinite(latestTime) && manualTime >= latestTime));
  const dueDate = manualScheduleIsCurrent ? entry.dueDate : calculatedDue;
  const overdueDays = Math.max(0, daysBetween(dueDate, today) || 0);
  const ratingWeight = ({ failed: 70, soon: 45, good: 12, mastered: 0 })[rating] || 0;
  const masteryWeight = ({ learning: 18, new: 14, unrated: 8, good: 3, mastered: 0 })[entry.mastery] || 0;
  const noteWeight = latest?.notes?.trim() ? 4 : 0;
  const priority = Math.round(overdueDays * 10 + ratingWeight + masteryWeight + noteWeight
    + Math.min(failedCount, 10) * 4 + (!lastDate ? 15 : 0));
  return {
    entryId: entry.id,
    dueDate,
    isDue: compareDateKeys(dueDate, today) <= 0,
    isOverdue: compareDateKeys(dueDate, today) < 0,
    overdueDays,
    priority,
    lastReviewedAt: latest?.completedAt || latest?.startedAt || null,
    manualScheduleIsCurrent,
    lastReviewedDate: lastDate,
    lastRating: rating,
    reviewCount: allCompleted.length || entry.reviewCount || 0,
    failedCount,
  };
}

export function buildSchedule(entries, reviews, settings, now = new Date()) {
  return new Map(entries.map((entry) => [entry.id, scheduleEntry(entry, reviews, settings, now)]));
}

export function dailyCandidates(entries, schedule, count, excludeIds = new Set()) {
  return entries.filter((entry) => !excludeIds.has(entry.id)).sort((a, b) => {
    const aInfo = schedule.get(a.id);
    const bInfo = schedule.get(b.id);
    const dueDifference = Number(bInfo?.isDue) - Number(aInfo?.isDue);
    return dueDifference || (bInfo?.priority || 0) - (aInfo?.priority || 0)
      || a.surah - b.surah || a.from - b.from;
  }).slice(0, count);
}

export function weightedRandomEntry(entries, schedule, excludeIds = new Set(), random = Math.random) {
  const candidates = entries.filter((entry) => !excludeIds.has(entry.id));
  if (!candidates.length) return null;
  const weights = candidates.map((entry) => {
    const info = schedule.get(entry.id);
    return 1 + (info?.isDue ? 5 : 0) + Math.min(info?.priority || 0, 100) / 20;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = random() * total;
  for (let index = 0; index < candidates.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) return candidates[index];
  }
  return candidates.at(-1);
}

export function postponeEntry(entry, days, today = localDateKey()) {
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error('مدة التأجيل غير صالحة.');
  return {
    entry: { ...entry, dueDate: addDays(today, days), updatedAt: new Date().toISOString() },
    event: {
      id: `schedule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      entryId: entry.id,
      type: 'postponed',
      date: addDays(today, days),
      previousDate: entry.dueDate || null,
      createdAt: new Date().toISOString(),
    },
  };
}

export function rescheduleEntry(entry, date) {
  if (!isValidDateKey(date)) throw new Error('تاريخ إعادة الجدولة غير صالح.');
  return {
    entry: { ...entry, dueDate: date, updatedAt: new Date().toISOString() },
    event: {
      id: `schedule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      entryId: entry.id,
      type: 'rescheduled',
      date,
      previousDate: entry.dueDate || null,
      createdAt: new Date().toISOString(),
    },
  };
}

export function ratingLabel(rating) {
  return ({ mastered: 'متقن', good: 'جيد مع بعض الأخطاء', soon: 'يحتاج إلى مراجعة قريبة', failed: 'لم أتمكن من التسميع' })[rating] || 'دون تقييم';
}
