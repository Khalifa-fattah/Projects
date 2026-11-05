// focus.js - Pomodoro focus timer. Completed focus sessions are added to the learning hours.
(function(window) {
  'use strict';

  const KEY = 'my_learning_journey_timer_v1';
  const MODES = ['focus', 'short', 'long'];
  const MODE_LABELS = { focus: 'تركيز', short: 'استراحة قصيرة', long: 'استراحة طويلة' };
  const CYCLES_BEFORE_LONG = 4;

  const Focus = {
    MODES,
    MODE_LABELS,
    state: { mode: 'focus', running: false, endAt: 0, remainingMs: 0, domainId: '', cycle: 0 },
    timerId: null,
    listeners: [],

    init() {
      try {
        const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (saved && MODES.includes(saved.mode)) {
          this.state = {
            mode: saved.mode,
            running: !!saved.running,
            endAt: Number(saved.endAt) || 0,
            remainingMs: Number(saved.remainingMs) || 0,
            domainId: typeof saved.domainId === 'string' ? saved.domainId : '',
            cycle: Number(saved.cycle) || 0
          };
        }
      } catch (e) { /* ignore: start with defaults */ }

      if (!this.state.remainingMs) this.state.remainingMs = this.durationMs(this.state.mode);
      if (this.state.running) {
        this.schedule();
        this.tick(); // completes immediately if the time passed while the page was closed
      }
      this.updateDisplay();
    },

    subscribe(cb) { this.listeners.push(cb); },
    emit() { this.listeners.forEach(cb => { try { cb(this.state); } catch (e) { console.error(e); } }); },

    persist() {
      try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) { /* ignore */ }
    },

    durationMs(mode) {
      const p = LearningStore.getPomodoroSettings();
      return Math.max(1, Number(p[mode]) || 25) * 60000;
    },

    getRemainingMs() {
      if (this.state.running) return Math.max(0, this.state.endAt - Date.now());
      return this.state.remainingMs;
    },

    getProgressPct() {
      const total = this.durationMs(this.state.mode);
      return Math.min(100, Math.max(0, Math.round((1 - this.getRemainingMs() / total) * 100)));
    },

    format(ms) {
      const totalSec = Math.ceil(ms / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    },

    setDomain(domainId) {
      this.state.domainId = domainId || '';
      this.persist();
    },

    setMode(mode) {
      if (this.state.running || !MODES.includes(mode)) return;
      this.state.mode = mode;
      this.state.remainingMs = this.durationMs(mode);
      this.persist();
      this.updateDisplay();
      this.emit();
    },

    start() {
      if (this.state.running) return;
      if (!this.state.remainingMs) this.state.remainingMs = this.durationMs(this.state.mode);
      this.state.running = true;
      this.state.endAt = Date.now() + this.state.remainingMs;
      this.persist();
      this.schedule();
      this.requestNotificationPermission();
      this.updateDisplay();
      this.emit();
    },

    pause() {
      if (!this.state.running) return;
      this.state.remainingMs = this.getRemainingMs();
      this.state.running = false;
      this.state.endAt = 0;
      this.unschedule();
      this.persist();
      this.updateDisplay();
      this.emit();
    },

    reset() {
      this.unschedule();
      this.state.running = false;
      this.state.endAt = 0;
      this.state.remainingMs = this.durationMs(this.state.mode);
      this.persist();
      this.updateDisplay();
      this.emit();
    },

    // Skip the current break (focus sessions can only be reset, never counted unfinished).
    skipBreak() {
      if (this.state.mode === 'focus') return;
      this.unschedule();
      this.state.running = false;
      this.state.mode = 'focus';
      this.state.remainingMs = this.durationMs('focus');
      this.persist();
      this.updateDisplay();
      this.emit();
    },

    schedule() {
      this.unschedule();
      this.timerId = setInterval(() => this.tick(), 500);
    },

    unschedule() {
      if (this.timerId) { clearInterval(this.timerId); this.timerId = null; }
    },

    tick() {
      if (!this.state.running) return;
      if (Date.now() >= this.state.endAt) {
        this.complete();
      } else {
        this.updateDisplay();
      }
    },

    complete() {
      this.unschedule();
      const finishedMode = this.state.mode;
      this.state.running = false;
      this.state.endAt = 0;

      let message;
      if (finishedMode === 'focus') {
        const minutes = Math.round(this.durationMs('focus') / 60000);
        this.state.cycle += 1;
        this.state.mode = this.state.cycle % CYCLES_BEFORE_LONG === 0 ? 'long' : 'short';
        message = `انتهت جلسة التركيز (${minutes} دقيقة) وأُضيفت إلى ساعات التعلم. خذ استراحة!`;
        this.state.remainingMs = this.durationMs(this.state.mode);
        this.persist();
        LearningStore.addFocusSession({ minutes, domainId: this.state.domainId }); // triggers re-render
      } else {
        this.state.mode = 'focus';
        message = 'انتهت الاستراحة. هل أنت مستعد لجلسة تركيز جديدة؟';
        this.state.remainingMs = this.durationMs('focus');
        this.persist();
      }

      this.beep();
      this.notify(message);
      UI.showToast(message, 'celebrate', 7000);
      this.updateDisplay();
      this.emit();
    },

    // ---- feedback ---- //
    beep() {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        [0, 0.3, 0.6].forEach(offset => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const t = ctx.currentTime + offset;
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.25);
        });
        setTimeout(() => ctx.close(), 1500);
      } catch (e) { /* audio not available */ }
    },

    requestNotificationPermission() {
      try {
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }
      } catch (e) { /* ignore */ }
    },

    notify(message) {
      try {
        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
          new Notification('رحلتي التعليمية', { body: message });
        }
      } catch (e) { /* ignore */ }
    },

    // Update only the live nodes (the full view is not re-rendered every tick).
    updateDisplay() {
      const ms = this.getRemainingMs();
      const text = this.format(ms);
      const timeEl = document.getElementById('pomo-time');
      if (timeEl) timeEl.textContent = text;
      const bar = document.getElementById('pomo-progress');
      if (bar) {
        const pct = this.getProgressPct();
        const fill = bar.querySelector('.progress-bar-fill');
        if (fill) fill.style.width = pct + '%';
        bar.setAttribute('aria-valuenow', String(pct));
      }
      const mini = document.getElementById('pomo-mini');
      if (mini) {
        const show = this.state.running;
        mini.classList.toggle('hidden', !show);
        const miniTime = document.getElementById('pomo-mini-time');
        if (miniTime) miniTime.textContent = text;
      }
      document.title = this.state.running
        ? `${text} • ${MODE_LABELS[this.state.mode]} | رحلة التعلم`
        : 'رحلة التعلم | My Learning Journey';
    }
  };

  window.Focus = Focus;

})(window);
