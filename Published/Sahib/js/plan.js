/*
 * plan.js — تبويب «المراجعة»: الجدولة، جلسة اليوم، المراجعة العشوائية، مراجعة سورة/نطاق، قائمة المواعيد.
 *
 * قاعدة الجدولة (بسيطة وواضحة، قابلة للتعديل من الإعدادات):
 *   موعد المراجعة التالي = تاريخ آخر مراجعة + الفترة المقابلة لآخر تقييم (متقن/جيد/قريبة/لم أتمكن/بلا تقييم).
 *   مقطع لم يُراجَع قط: موعده يوم إضافته.
 *   «المستحقة اليوم» = موعدها اليوم أو قبله (تشمل المتأخرة). «المتأخرة» = موعدها قبل اليوم. «القادمة» = بعد اليوم.
 */
(function (g) {
  'use strict';
  const NS = (g.Sahib = g.Sahib || {});
  const { Quran, Utils, Memorization, Settings, Review, ReviewLog, UI } = NS;
  const { el } = Utils;
  const $ = (id) => document.getElementById(id);

  const FILTERS = Object.freeze({
    due: 'المستحقة اليوم',
    overdue: 'المتأخرة',
    upcoming: 'القادمة',
    all: 'الكل'
  });
  const EMPTY_TEXT = Object.freeze({
    due: 'لا توجد مقاطع مستحقة اليوم. أحسنت، أنت على الموعد!',
    overdue: 'لا توجد مقاطع متأخرة.',
    upcoming: 'لا توجد مقاطع قادمة بعد.',
    all: 'لا توجد مقاطع بعد. أضف محفوظاتك من تبويب «إضافة».'
  });
  const RATING_WEIGHT = { failed: 3, soon: 2, good: 1, mastered: 0 };

  let filter = 'due';
  let skeletonReady = false;

  // ---------- الجدولة (دوال نقية قابلة للاختبار) ----------
  function intervalFor(entry, intervals) {
    const iv = intervals || Settings.get('intervals');
    return iv[entry.lastRating] || iv.unrated;
  }

  // تاريخ الاستحقاق (YYYY-MM-DD). تاريخ فاسد يجعل المقطع مستحقًا اليوم بدل أن يختفي.
  function dueDate(entry, today, intervals) {
    if (Utils.isValidDateStr(entry.lastReviewed)) {
      return Utils.addDays(entry.lastReviewed, intervalFor(entry, intervals));
    }
    return Utils.isValidDateStr(entry.dateAdded) ? entry.dateAdded : today;
  }

  // يعيد [{ entry, due, diff, bucket }] مرتبة: الأشد تأخرًا ثم الأضعف تقييمًا ثم الأقرب موعدًا.
  function schedule(entries, today, intervals) {
    return entries.map((entry) => {
      const due = dueDate(entry, today, intervals);
      const diff = Utils.daysBetween(today, due); // سالب = متأخر
      return { entry, due, diff, bucket: diff < 0 ? 'overdue' : diff === 0 ? 'today' : 'upcoming' };
    }).sort((a, b) =>
      a.diff - b.diff ||
      (RATING_WEIGHT[b.entry.lastRating] || 1) - (RATING_WEIGHT[a.entry.lastRating] || 1) ||
      a.entry.surah - b.entry.surah || a.entry.from - b.entry.from
    );
  }

  function filterSchedule(items, which) {
    switch (which) {
      case 'due': return items.filter((i) => i.diff <= 0);
      case 'overdue': return items.filter((i) => i.diff < 0);
      case 'upcoming': return items.filter((i) => i.diff > 0);
      default: return items;
    }
  }

  // طابور جلسة اليوم: المستحقة فقط، الأشد تأخرًا أولًا، بحد أقصى حجم الجلسة.
  function buildQueue(entries, today, size, intervals) {
    return filterSchedule(schedule(entries, today, intervals), 'due').slice(0, size).map((i) => i.entry);
  }

  // اختيار عشوائي بلا تكرار حتى تُستنفد كل المقاطع، ولا يتكرر آخر مقطع عند بدء دورة جديدة.
  function createRandomPicker(rng) {
    const random = rng || Math.random;
    let bag = [];
    let last = null;
    return function pick(entries) {
      const ids = entries.map((e) => e.id);
      if (ids.length === 0) return null;
      bag = bag.filter((id) => ids.includes(id));
      if (bag.length === 0) {
        bag = ids.length > 1 ? ids.filter((id) => id !== last) : ids.slice();
      }
      const i = Math.min(bag.length - 1, Math.floor(random() * bag.length));
      const id = bag.splice(i, 1)[0];
      last = id;
      return entries.find((e) => e.id === id) || null;
    };
  }

  function completedOn(log, date) {
    return (log || []).filter((r) => r && r.status === 'completed' && r.date === date).length;
  }

  // ---------- العرض ----------
  function whenLabel(item) {
    if (item.diff < 0) return { text: `متأخرة ${-item.diff} ${-item.diff === 1 ? 'يوم' : 'أيام'}`, cls: 'overdue' };
    if (item.diff === 0) return { text: 'اليوم', cls: 'today' };
    if (item.diff === 1) return { text: 'غدًا', cls: '' };
    return { text: `بعد ${item.diff} أيام`, cls: '' };
  }

  function planCard(icon, title, desc, onClick, disabled) {
    return el('button', { type: 'button', class: 'plan-card', onClick, disabled: disabled ? true : null },
      el('span', { class: 'ico', 'aria-hidden': 'true', text: icon }),
      el('span', { class: 'txt' }, el('span', { class: 't', text: title }), el('span', { class: 'd', text: desc })),
      el('span', { class: 'go', 'aria-hidden': 'true', text: '‹' })
    );
  }

  function scheduleItem(item) {
    const e = item.entry;
    const w = whenLabel(item);
    const last = e.lastReviewed ? `آخر مراجعة ${Utils.formatDate(e.lastReviewed)}` : 'لم تُراجَع بعد';
    const rating = e.lastRating ? ` · ${Review.RATING_LABELS[e.lastRating]}` : '';
    return el('button', {
      type: 'button', class: 'sched-item', 'data-id': e.id,
      'aria-label': `مراجعة ${e.surahName}، الآيات ${e.from} إلى ${e.to}، ${w.text}`,
      onClick: (ev) => Review.open(e.id, ev.currentTarget)
    },
      el('div', { class: 'sched-main' },
        el('div', { class: 'sched-title', text: e.surahName }),
        el('div', { class: 'sched-sub', text: `الآيات ${e.from} إلى ${e.to} · ${last}${rating}` })
      ),
      el('span', { class: `sched-when ${w.cls}`.trim(), text: w.text })
    );
  }

  function ensureSkeleton() {
    if (skeletonReady) return;
    const root = $('planContent');
    const select = el('select', { id: 'planFilter' },
      ...Object.entries(FILTERS).map(([v, t]) => el('option', { value: v, text: t })));
    select.value = filter;
    root.replaceChildren(
      el('div', { id: 'planTop' }),
      el('div', { class: 'plan-list-head' },
        el('h2', { id: 'planListTitle', text: 'المقاطع والمواعيد' }),
        el('label', { class: 'sr-only', for: 'planFilter', text: 'عرض' }),
        select
      ),
      el('div', { id: 'schedList' })
    );
    UI.enhanceSelect(select, { title: 'عرض' });
    select.addEventListener('change', () => { filter = select.value; renderList(); });
    skeletonReady = true;
  }

  function renderTop() {
    const entries = Memorization.all();
    const today = Utils.toLocalDateStr();
    const goal = Settings.get('dailyGoal');
    const done = completedOn(ReviewLog.all(), today);
    const pct = Math.min(100, Math.round((done / goal) * 100));
    const dueCount = filterSchedule(schedule(entries, today), 'due').length;
    const size = Settings.get('sessionSize');
    const top = $('planTop');

    const goalCard = el('div', { class: 'card' },
      el('div', { class: 'goal-row' },
        el('div', { class: 'goal-head' },
          el('span', { class: 'lbl', text: 'هدف اليوم' }),
          el('span', { class: 'val', text: `${done} من ${goal} جلسة` })
        ),
        el('div', {
          class: `meter${done >= goal ? ' done' : ''}`, role: 'progressbar', 'aria-label': 'تقدم هدف اليوم',
          'aria-valuemin': '0', 'aria-valuemax': String(goal), 'aria-valuenow': String(Math.min(done, goal))
        }, el('span', { style: `width:${pct}%` }))
      ),
      el('p', { text: done >= goal ? 'أتممت هدف اليوم، بارك الله فيك.' : 'كل مراجعة تُكمل تقييمها تُحتسب جلسة في هدفك.' })
    );

    if (entries.length === 0) {
      top.replaceChildren(
        el('p', { class: 'lead', text: 'نظّم مراجعتك بجلسة يومية مختصرة، أو مراجعة عشوائية، أو اختر سورة ونطاقًا بنفسك.' }),
        goalCard,
        el('div', { class: 'plan-actions' },
          planCard('＋', 'أضف محفوظاتك أولًا', 'تبدأ الجدولة بعد تسجيل أول مقطع تحفظه.', () => NS.App.switchTab('add')),
          planCard('📖', 'سورة ونطاق محدد', 'راجع أي آيات تختارها دون ربطها بمحفوظاتك.', startRange)
        )
      );
      return;
    }
    top.replaceChildren(
      el('p', { class: 'lead', text: 'نظّم مراجعتك بجلسة يومية مختصرة، أو مراجعة عشوائية، أو اختر سورة ونطاقًا بنفسك.' }),
      goalCard,
      el('div', { class: 'plan-actions' },
        planCard('✦', 'جلسة اليوم',
          dueCount > 0 ? `${dueCount} مقطع مستحق · ستراجع ${Math.min(dueCount, size)} منها الآن` : 'لا توجد مقاطع مستحقة اليوم',
          startSession),
        planCard('⇄', 'مراجعة عشوائية', 'مقطع من محفوظاتك بلا تكرار حتى تمرّ عليها كلها.', startRandom),
        planCard('📖', 'سورة ونطاق محدد', 'اختر سورة والآيات التي تريد مراجعتها.', startRange)
      )
    );
  }

  function renderList() {
    const list = $('schedList');
    const today = Utils.toLocalDateStr();
    const items = filterSchedule(schedule(Memorization.all(), today), filter);
    if (items.length === 0) {
      list.replaceChildren(el('div', { class: 'plan-empty', text: EMPTY_TEXT[filter] }));
      return;
    }
    list.replaceChildren(...items.map(scheduleItem));
  }

  function render() {
    ensureSkeleton();
    renderTop();
    renderList();
  }

  // ---------- جلسة اليوم ----------
  function openerOf() {
    return document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
  }

  function startSession() {
    const today = Utils.toLocalDateStr();
    const queue = buildQueue(Memorization.all(), today, Settings.get('sessionSize')).map((e) => e.id);
    if (queue.length === 0) {
      UI.toast('لا توجد مقاطع مستحقة اليوم. يمكنك بدء مراجعة عشوائية.');
      return;
    }
    const opener = openerOf();
    const state = { queue, index: 0, done: 0 };
    openCurrent(state, opener);
  }

  function openCurrent(state, opener) {
    // نتجاوز مقطعًا حُذف أثناء الجلسة
    while (state.index < state.queue.length && !Memorization.find(state.queue[state.index])) state.index++;
    if (state.index >= state.queue.length) { finishSession(state); return; }
    const total = state.queue.length;
    Review.open(state.queue[state.index], opener, {
      kind: 'session',
      label: `جلسة اليوم · ${state.index + 1} من ${total}`,
      onRated: () => {
        state.done++;
        state.index++;
        openCurrent(state, opener);
      }
    });
  }

  async function finishSession(state) {
    Review.close();
    render();
    await UI.choice(
      `أتممت جلسة اليوم: ${state.done} ${state.done === 1 ? 'مقطع' : 'مقاطع'}.\nتقبّل الله منك، وثبّت حفظك.`,
      [{ label: 'حسنًا', value: 'ok', kind: 'primary', focus: true }],
      { icon: '﴾ ✓ ﴿' }
    );
  }

  // ---------- المراجعة العشوائية ----------
  const pickRandom = createRandomPicker();

  function startRandom() {
    openRandom(openerOf());
  }

  function openRandom(opener) {
    const entry = pickRandom(Memorization.all());
    if (!entry) { UI.toast('لا توجد مقاطع محفوظة بعد.'); return; }
    Review.open(entry.id, opener, {
      kind: 'random',
      label: 'مراجعة عشوائية',
      onRated: async () => {
        Review.close();
        render();
        const again = await UI.choice('أحسنت! هل تريد مقطعًا عشوائيًا آخر؟', [
          { label: 'إنهاء', value: false, kind: 'ghost', focus: true },
          { label: 'مقطع آخر', value: true, kind: 'primary' }
        ], { icon: '﴾ ؟ ﴿' });
        if (again === true) openRandom(opener);
      }
    });
  }

  // ---------- مراجعة سورة ونطاق ----------
  async function startRange() {
    const opener = openerOf();
    const surahSel = el('select', { id: 'rangeSurah' },
      ...Quran.SURAHS.map((s) => el('option', { value: String(s.n), text: `${s.n}. ${s.name}` })));
    const fromIn = el('input', { type: 'number', id: 'rangeFrom', min: '1', value: '1', inputmode: 'numeric' });
    const toIn = el('input', { type: 'number', id: 'rangeTo', min: '1', value: String(Quran.SURAHS[0].ayahs), inputmode: 'numeric' });
    const hint = el('div', { class: 'hint' });
    const error = el('p', { class: 'dlg-error', role: 'alert', hidden: true });

    function syncSurah() {
      const s = Quran.surahByNumber(parseInt(surahSel.value, 10));
      fromIn.max = toIn.max = String(s.ayahs);
      fromIn.value = '1';
      toIn.value = String(s.ayahs);
      hint.textContent = `عدد آيات هذه السورة: ${s.ayahs}`;
    }

    const form = el('div', { class: 'range-form' },
      error,
      el('div', { class: 'field' }, el('label', { for: 'rangeSurah', text: 'السورة' }), surahSel),
      el('div', { class: 'row2' },
        el('div', { class: 'field' }, el('label', { for: 'rangeFrom', text: 'من آية' }), fromIn),
        el('div', { class: 'field' }, el('label', { for: 'rangeTo', text: 'إلى آية' }), toIn)
      ),
      hint
    );
    UI.enhanceSelect(surahSel, { title: 'السورة' });
    surahSel.addEventListener('change', syncSurah);
    syncSurah();

    let range = null;
    const validate = () => {
      const v = Memorization.validateRange(surahSel.value, fromIn.value, toIn.value);
      if (!v.ok) {
        error.textContent = v.error;
        error.hidden = false;
        return false;
      }
      error.hidden = true;
      range = v;
      return true;
    };

    const pick = await UI.choice('مراجعة سورة ونطاق', [
      { label: 'إلغاء', value: null, kind: 'ghost' },
      { label: 'ابدأ المراجعة', value: 'start', kind: 'primary', focus: true, validate }
    ], { icon: '﴾ 📖 ﴿', content: form, focus: surahSel.nextElementSibling });
    if (pick !== 'start' || !range) return;
    Review.openRange({ surah: range.surah, from: range.from, to: range.to }, opener, { kind: 'range', label: 'مراجعة حرة' });
  }

  function init() {
    ensureSkeleton();
  }

  NS.Plan = {
    init, render, schedule, dueDate, filterSchedule, buildQueue, createRandomPicker, completedOn,
    intervalFor, FILTERS
  };
})(globalThis);
