/*
 * stats.js — حساب الإحصائيات وعرضها.
 *
 * تعريفات (موحّدة في كل التطبيق):
 *  - آيات فريدة: عدد الآيات المختلفة المسجّلة؛ لا تُعدّ الآية مرتين عند تداخل النطاقات.
 *  - مقاطع مسجّلة: عدد سجلات المحفوظات (يختلف عن عدد الآيات).
 *  - "آخر ٧ أيام": سبعة أيام متحركة = اليوم و٦ أيام قبله (بالتاريخ المحلي).
 *    التواريخ المستقبلية والأقدم من الفترة وغير الصالحة لا تُحتسب.
 */
(function (g) {
  'use strict';
  const NS = (g.Sahib = g.Sahib || {});
  const { Quran, Utils, Memorization } = NS;
  const { el } = Utils;

  const WINDOW_DAYS = 7;

  // «متقن»: آخر تقييم لك «متقن»، أو إتقانك المسجَّل «قوي» إن لم تُقيّم المقطع بعد. ليس قياسًا آليًا للحفظ.
  function isMastered(e) {
    return e.lastRating === 'mastered' || (!e.lastRating && e.mastery === 'strong');
  }

  // نشاط آخر 7 أيام: عدد الجلسات المكتملة في كل يوم (من أقدم يوم إلى اليوم). تُهمل السجلات خارج الفترة.
  function activityLast7(reviewLog, today) {
    const days = [];
    for (let i = WINDOW_DAYS - 1; i >= 0; i--) days.push({ date: Utils.addDays(today, -i), count: 0 });
    const idx = new Map(days.map((d, i) => [d.date, i]));
    for (const r of reviewLog || []) {
      if (r && r.status === 'completed' && idx.has(r.date)) days[idx.get(r.date)].count++;
    }
    return days;
  }

  function compute(entries, reviewLog, today) {
    const cov = Memorization.coveredMap(entries);
    let uniqueAyat = 0;
    let completedSurahs = 0;
    cov.forEach((set, surahNum) => {
      uniqueAyat += set.size;
      const s = Quran.surahByNumber(surahNum);
      if (s && set.size >= s.ayahs) completedSurahs++;
    });

    const todayNum = Utils.dayNumber(today);
    let reviewedLast7 = 0;
    let neverReviewed = 0;
    for (const e of entries) {
      const dn = Utils.dayNumber(e.lastReviewed);
      if (Number.isNaN(dn)) {
        neverReviewed++;
        continue;
      }
      const diff = todayNum - dn;
      if (diff >= 0 && diff < WINDOW_DAYS) reviewedLast7++;
    }

    const completedSessions = (reviewLog || []).filter((r) => r && r.status === 'completed').length;
    // "متقن" هنا = تقييم المستخدم اليدوي لآخر مراجعة؛ ليس قياسًا آليًا للحفظ.
    const masteredByRating = entries.filter(isMastered).length;
    const dueNow = entries.filter((e) => Memorization.needsReview(e, today)).length;
    const activity = activityLast7(reviewLog, today);
    const todayCount = activity[activity.length - 1].count;
    const last7Count = activity.reduce((n, d) => n + d.count, 0);

    return {
      uniqueAyat,
      completedSurahs,
      surahsInProgress: cov.size,
      percentOfQuran: (uniqueAyat / Quran.TOTAL_AYAHS) * 100,
      entryCount: entries.length,
      reviewedLast7,
      neverReviewed,
      completedSessions,
      masteredByRating,
      dueNow,
      activity,
      todayCount,
      last7Count
    };
  }

  function statBox(num, label) {
    return el('div', { class: 'stat-box' },
      el('span', { class: 'num', text: String(num) }),
      el('span', { class: 'lbl', text: label })
    );
  }

  // الشريط الصغير أعلى قائمة المحفوظات
  function renderListStrip(container, s) {
    container.replaceChildren(
      statBox(s.uniqueAyat, 'آية محفوظة'),
      statBox(s.completedSurahs, 'سورة كاملة'),
      statBox(s.surahsInProgress, 'سورة قيد الحفظ')
    );
  }

  // صفحة الإحصائيات الكاملة
  function goalRow(label, value, goal) {
    const pct = Math.min(100, Math.round((value / goal) * 100));
    return el('div', { class: 'goal-row' },
      el('div', { class: 'goal-head' },
        el('span', { class: 'lbl', text: label }),
        el('span', { class: 'val', text: `${value} من ${goal}` })
      ),
      el('div', {
        class: `meter${value >= goal ? ' done' : ''}`, role: 'progressbar', 'aria-label': label,
        'aria-valuemin': '0', 'aria-valuemax': String(goal), 'aria-valuenow': String(Math.min(value, goal))
      }, el('span', { style: `width:${pct}%` }))
    );
  }

  function activityCard(s) {
    const max = Math.max(1, ...s.activity.map((d) => d.count));
    const last = s.activity.length - 1;
    return el('div', { class: 'card' },
      el('h2', { text: 'النشاط خلال آخر 7 أيام' }),
      el('div', { class: 'activity', role: 'img', 'aria-label': `جلسات المراجعة في آخر 7 أيام: ${s.last7Count}` },
        s.activity.map((d, i) => el('div', { class: `col${i === last ? ' today' : ''}` },
          el('span', { class: 'n', text: String(d.count) }),
          el('span', {
            class: `bar${d.count === 0 ? ' zero' : ''}`,
            style: `height:${d.count === 0 ? 3 : Math.max(8, Math.round((d.count / max) * 80))}px`
          }),
          el('span', { class: 'd', text: i === last ? 'اليوم' : Utils.weekdayName(d.date) })
        ))
      ),
      el('p', { class: 'chart-cap', text: s.last7Count > 0
        ? `أنجزت ${s.last7Count} ${s.last7Count === 1 ? 'جلسة مراجعة' : 'جلسات مراجعة'} خلال آخر 7 أيام.`
        : 'لم تُسجَّل جلسات مراجعة خلال آخر 7 أيام بعد.' })
    );
  }

  function goalsCard(s, goals) {
    return el('div', { class: 'card' },
      el('h2', { text: 'الأهداف' }),
      goalRow('هدف اليوم (جلسات)', s.todayCount, goals.daily),
      goalRow('آخر 7 أيام (جلسات)', s.last7Count, goals.weekly),
      el('p', { class: 'chart-cap', text: 'يمكنك تغيير الهدفين من تبويب الإعدادات.' })
    );
  }

  function renderStatsView(container, s, goals) {
    const g2 = goals || { daily: 3, weekly: 15 };
    if (s.entryCount === 0) {
      container.replaceChildren(
        el('div', { class: 'empty-state' },
          el('div', { class: 'glyph', 'aria-hidden': 'true', text: '﴿ ﴾' }),
          el('p', { text: 'أضف أول محفوظاتك لتظهر إحصائياتك هنا.' })
        )
      );
      return;
    }
    container.replaceChildren(
      el('div', { class: 'stats-strip' },
        statBox(s.uniqueAyat, 'آية محفوظة'),
        statBox(s.completedSurahs, 'سورة كاملة'),
        statBox(`${s.percentOfQuran.toFixed(2)}%`, 'من القرآن')
      ),
      el('div', { class: 'stats-strip' },
        statBox(s.entryCount, 'مقطع مسجَّل'),
        statBox(s.completedSessions, 'جلسة مراجعة مكتملة')
      ),
      el('div', { class: 'stats-strip' },
        statBox(s.masteredByRating, 'مقطع متقن (تقييمك)'),
        statBox(s.dueNow, 'مقطع مستحق للمراجعة')
      ),
      activityCard(s),
      goalsCard(s, g2),
      el('div', { class: 'entry-card static' },
        el('div', { class: 'entry-body' },
          el('div', { class: 'entry-range', text: `راجعت ${s.reviewedLast7} مقطعًا خلال آخر ٧ أيام` }),
          el('div', {
            class: 'entry-meta',
            text: s.neverReviewed > 0
              ? `${s.neverReviewed} مقطعًا لم تُراجَع بعد منذ إضافتها`
              : 'أحسنت! كل المقاطع رُوجعت مرة على الأقل'
          }),
          el('div', { class: 'entry-meta', text: 'الأيام السبعة: اليوم وستة أيام قبله. الآيات المتداخلة تُعدّ مرة واحدة. «متقن»: آخر تقييم لك «متقن»، أو إتقانك «قوي» إن لم تُقيّم المقطع بعد. «مستحق» هنا = لم يُراجع أو مضى عليه 7 أيام أو تقييمه ضعيف؛ أما مواعيد تبويب «المراجعة» فتتبع الفترات المضبوطة في الإعدادات.' })
        )
      )
    );
  }

  NS.Stats = { compute, renderListStrip, renderStatsView, isMastered, activityLast7, WINDOW_DAYS };
})(globalThis);
