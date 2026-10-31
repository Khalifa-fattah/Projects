import { countUniqueAyahs, uniqueAyahMap } from './memorization.js';
import { buildSchedule, latestEntryReview } from './review-scheduler.js';
import { compareDateKeys, localDateKey, rollingDateKeys, validTimestamp } from './utils.js';

export function validCompletedReviews(reviews, now = new Date()) {
  const today = localDateKey(now);
  return reviews.filter((review) => review.status === 'completed'
    && validTimestamp(review.completedAt || review.startedAt, { now: now.getTime() }) !== null
    && (!review.localDate || compareDateKeys(review.localDate, today) <= 0));
}

export function activeStreak(reviews, now = new Date()) {
  const days = new Set(validCompletedReviews(reviews, now).map((review) => review.localDate).filter(Boolean));
  const keys = rollingDateKeys(3660, now).reverse();
  let streak = 0;
  for (const key of keys) {
    if (!days.has(key)) break;
    streak += 1;
  }
  return streak;
}

export function activityForLastDays(reviews, now = new Date(), count = 7) {
  const keys = rollingDateKeys(count, now);
  const totals = new Map(keys.map((key) => [key, 0]));
  validCompletedReviews(reviews, now).forEach((review) => {
    if (totals.has(review.localDate)) totals.set(review.localDate, totals.get(review.localDate) + 1);
  });
  return keys.map((date) => ({ date, count: totals.get(date) }));
}

export function testedAyahCount(reviews, now = new Date()) {
  const map = new Map();
  validCompletedReviews(reviews, now).filter((review) => review.mode === 'test' || review.tested === true)
    .forEach((review) => {
      const { surah, from, to } = review.snapshot;
      if (!map.has(surah)) map.set(surah, new Set());
      for (let number = from; number <= to; number += 1) map.get(surah).add(number);
    });
  let total = 0;
  map.forEach((set) => { total += set.size; });
  return total;
}

export function computeStats(entries, reviews, settings, now = new Date()) {
  const completed = validCompletedReviews(reviews, now);
  const today = localDateKey(now);
  const schedule = buildSchedule(entries, reviews, settings, now);
  const scheduleValues = [...schedule.values()];
  const covered = uniqueAyahMap(entries);
  const mastered = entries.filter((entry) => {
    const latest = latestEntryReview(reviews, entry.id, now.getTime());
    return latest ? latest.rating === 'mastered' : entry.mastery === 'mastered';
  }).length;
  const lastReviewedAt = completed.map((review) => review.completedAt || review.startedAt).sort().at(-1) || null;
  const todayCount = completed.filter((review) => review.localDate === today).length;
  const weekKeys = new Set(rollingDateKeys(7, now));
  const weekCount = completed.filter((review) => weekKeys.has(review.localDate)).length;
  return {
    surahCount: covered.size,
    uniqueAyahs: countUniqueAyahs(entries),
    entryCount: entries.length,
    completedSessions: completed.length,
    testedAyahs: testedAyahCount(reviews, now),
    masteredEntries: mastered,
    dueCount: scheduleValues.filter((item) => item.isDue).length,
    overdueCount: scheduleValues.filter((item) => item.isOverdue).length,
    lastReviewedAt,
    streak: activeStreak(reviews, now),
    activity: activityForLastDays(reviews, now),
    todayCount,
    dailyGoal: settings.dailyGoal,
    dailyProgress: Math.min(1, todayCount / settings.dailyGoal),
    weekCount,
    weeklyGoal: settings.weeklyGoal,
    weeklyProgress: Math.min(1, weekCount / settings.weeklyGoal),
    schedule,
  };
}
