import { REVIEW_RATINGS } from './migrations.js';
import { localDateKey, makeId, safeString } from './utils.js';

/** دورة حياة الجلسة مستقلة عن جلب النص وعن حفظ السجل. */
export class ReviewSession {
  constructor({ entry = null, snapshot, mode = 'normal', queueId = null }) {
    if (!snapshot || !Number.isInteger(snapshot.surah) || !Number.isInteger(snapshot.from) || !Number.isInteger(snapshot.to)) {
      throw new Error('بيانات مقطع المراجعة غير صالحة.');
    }
    this.id = makeId('session');
    this.entryId = entry?.id || null;
    this.snapshot = {
      surah: snapshot.surah,
      surahName: snapshot.surahName,
      from: snapshot.from,
      to: snapshot.to,
    };
    this.mode = mode;
    this.tested = mode === 'test';
    this.queueId = queueId;
    this.startedAtMs = Date.now();
    this.startedAt = new Date(this.startedAtMs).toISOString();
    this.endedAtMs = null;
    this.pausedAtMs = null;
    this.pausedTotalMs = 0;
    this.status = 'loading';
    this.contentReady = false;
    this.ayahs = [];
    this.completionPending = false;
  }

  markReady(ayahs) {
    if (this.status !== 'loading') return false;
    if (!Array.isArray(ayahs) || ayahs.length !== this.snapshot.to - this.snapshot.from + 1
      || ayahs.some((ayah, index) => typeof ayah.text !== 'string' || !ayah.text.trim() || ayah.number !== this.snapshot.from + index)) {
      return false;
    }
    this.ayahs = ayahs;
    this.contentReady = true;
    this.status = 'ready';
    return true;
  }

  markFailed() {
    if (this.status === 'loading') this.status = 'failed';
  }

  pause() {
    if (this.pausedAtMs === null && ['loading', 'ready'].includes(this.status)) this.pausedAtMs = Date.now();
  }

  resume() {
    if (this.pausedAtMs !== null) {
      this.pausedTotalMs += Date.now() - this.pausedAtMs;
      this.pausedAtMs = null;
    }
  }

  durationSeconds(endMs = this.endedAtMs || Date.now()) {
    const currentPause = this.pausedAtMs === null ? 0 : endMs - this.pausedAtMs;
    const activeMs = Math.max(0, endMs - this.startedAtMs - this.pausedTotalMs - currentPause);
    return Math.round(activeMs / 1000);
  }

  beginCompletion(rating, notes = '') {
    if (!this.contentReady || this.status !== 'ready' || this.completionPending) return null;
    if (!REVIEW_RATINGS.includes(rating)) throw new Error('اختر نتيجة المراجعة أولًا.');
    this.completionPending = true;
    this.status = 'completing';
    this.resume();
    this.endedAtMs = Date.now();
    return this.buildRecord('completed', rating, notes);
  }

  finishCompletion() {
    if (this.status !== 'completing') return false;
    this.completionPending = false;
    this.status = 'completed';
    return true;
  }

  failCompletion() {
    if (this.status !== 'completing') return;
    this.completionPending = false;
    this.status = 'ready';
    this.endedAtMs = null;
  }

  cancel() {
    if (['completed', 'cancelled'].includes(this.status)) return null;
    this.resume();
    this.endedAtMs = Date.now();
    this.status = 'cancelled';
    this.completionPending = false;
    return this.buildRecord('incomplete', null, '');
  }

  buildRecord(status, rating, notes) {
    const completedAtMs = this.endedAtMs || Date.now();
    return {
      id: makeId('review'),
      sessionId: this.id,
      entryId: this.entryId,
      snapshot: { ...this.snapshot },
      mode: this.mode,
      tested: this.tested,
      status,
      rating,
      notes: safeString(notes, 4000),
      startedAt: this.startedAt,
      completedAt: new Date(completedAtMs).toISOString(),
      localDate: localDateKey(new Date(completedAtMs)),
      durationSeconds: this.durationSeconds(completedAtMs),
      mergedFromEntryIds: [],
    };
  }
}
