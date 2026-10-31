import { STORAGE_KEYS } from './storage.js';
import { clamp } from './utils.js';

export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'light',
  dailyGoal: 3,
  weeklyGoal: 15,
  suggestedCount: 5,
  defaultSort: 'surah',
  quranFontSize: 26,
  notifications: true,
  intervals: Object.freeze({ mastered: 21, good: 7, soon: 2, failed: 0, newEntry: 1 }),
});

function integer(value, fallback, min, max) {
  return Number.isInteger(value) ? clamp(value, min, max) : fallback;
}

export function validateSettings(value = {}) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const intervals = input.intervals && typeof input.intervals === 'object' ? input.intervals : {};
  return {
    theme: input.theme === 'dark' ? 'dark' : 'light',
    dailyGoal: integer(input.dailyGoal, DEFAULT_SETTINGS.dailyGoal, 1, 50),
    weeklyGoal: integer(input.weeklyGoal, DEFAULT_SETTINGS.weeklyGoal, 1, 200),
    suggestedCount: integer(input.suggestedCount, DEFAULT_SETTINGS.suggestedCount, 1, 20),
    defaultSort: ['surah', 'dateAdded', 'lastReviewed', 'priority'].includes(input.defaultSort)
      ? input.defaultSort : DEFAULT_SETTINGS.defaultSort,
    quranFontSize: integer(input.quranFontSize, DEFAULT_SETTINGS.quranFontSize, 20, 40),
    notifications: input.notifications !== false,
    intervals: {
      mastered: integer(intervals.mastered, DEFAULT_SETTINGS.intervals.mastered, 1, 365),
      good: integer(intervals.good, DEFAULT_SETTINGS.intervals.good, 1, 180),
      soon: integer(intervals.soon, DEFAULT_SETTINGS.intervals.soon, 0, 60),
      failed: integer(intervals.failed, DEFAULT_SETTINGS.intervals.failed, 0, 30),
      newEntry: integer(intervals.newEntry, DEFAULT_SETTINGS.intervals.newEntry, 0, 30),
    },
  };
}

export function loadSettings(storage) {
  try {
    const result = storage.readJson(STORAGE_KEYS.settings);
    if (result.value) return validateSettings(result.value);
    const legacyTheme = storage.getRaw(STORAGE_KEYS.legacyTheme);
    return validateSettings({ theme: legacyTheme === 'dark' ? 'dark' : 'light' });
  } catch {
    return validateSettings();
  }
}

export function saveSettings(storage, settings) {
  const valid = validateSettings(settings);
  storage.writeJson(STORAGE_KEYS.settings, valid);
  return valid;
}
