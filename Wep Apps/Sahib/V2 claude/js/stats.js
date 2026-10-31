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
    const masteredByRating = entries.filter((e) => e.lastRating === 'mastered').length;
    const dueNow = entries.filter((e) => Memorization.needsReview(e, today)).length;

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
      dueNow
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
  function renderStatsView(container, s) {
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
      el('div', { class: 'entry-card static' },
        el('div', { class: 'entry-body' },
          el('div', { class: 'entry-range', text: `راجعت ${s.reviewedLast7} مقطعًا خلال آخر ٧ أيام` }),
          el('div', {
            class: 'entry-meta',
            text: s.neverReviewed > 0
              ? `${s.neverReviewed} مقطعًا لم تُراجَع بعد منذ إضافتها`
              : 'أحسنت! كل المقاطع رُوجعت مرة على الأقل'
          }),
          el('div', { class: 'entry-meta', text: 'الأيام السبعة: اليوم وستة أيام قبله. الآيات المتداخلة تُعدّ مرة واحدة. «متقن» حسب تقييمك اليدوي لآخر مراجعة، و«مستحق» = لم يُراجع أو مضى عليه 7 أيام أو تقييمه ضعيف.' })
        )
      )
    );
  }

  NS.Stats = { compute, renderListStrip, renderStatsView, WINDOW_DAYS };
})(globalThis);
