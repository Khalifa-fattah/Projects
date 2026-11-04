/*
 * review.js — شاشة المراجعة: عرض الآيات، وضع الاختبار، التفسير، تقييم المراجعة، سجل المراجعات.
 *
 * فصل المراحل: فتح الجلسة (تحميل النص) ← عرض محتوى صالح ← طلب الإتمام ← اختيار التقييم ← تسجيل.
 * لا تُسجَّل مراجعة إلا بعد عرض النص فعليًا، ولا عند فشل التحميل أو فشل الحفظ.
 */
(function (g) {
  'use strict';
  const NS = (g.Sahib = g.Sahib || {});
  const { Quran, Utils, Storage, Memorization, QuranApi, TafsirApi, TafsirUI, Settings, UI } = NS;
  const { el } = Utils;
  const $ = (id) => document.getElementById(id);

  const config = {
    // بعد تسجيل مراجعة ناجحة يُعطَّل الزر هذه المدة لمنع النقر المزدوج غير المقصود.
    // لا يوجد حد على عدد المراجعات المستقلة في اليوم.
    cooldownMs: 1200
  };

  const RATING_LABELS = Object.freeze({
    mastered: 'متقن',
    good: 'جيد مع بعض الأخطاء',
    soon: 'يحتاج إلى مراجعة قريبة',
    failed: 'لم أتمكن من التسميع'
  });

  // ---------- سجل المراجعات ----------
  const ReviewLog = (function () {
    let records = Storage.loadReviewLog();
    function all() { return records; }
    function append(record) {
      const next = [...records, record];
      const result = Storage.saveReviewLog(next);
      if (result.ok) records = next;
      return result;
    }
    function setAll(next) { records = next; } // للاستعادة فقط: تحديث الذاكرة بعد نجاح الحفظ
    return { all, append, setAll };
  })();

  // ---------- حالة الجلسة الحالية ----------
  // entryId = null للمراجعة الحرة لنطاق (سورة + آيات) غير مرتبط بمقطع محفوظ.
  let session = null; // { token, entryId, surah, from, to, kind, ctx, spec, status, openedAt, ayahs, marking }
  let tokenCounter = 0;
  let abortController = null;
  let openerFocus = null;
  let onCloseCb = null;
  let offlineJob = null; // { cancelled, controller }

  function rangeLabel(entry) {
    return `الآيات ${entry.from} إلى ${entry.to}`;
  }

  // العنوان الفرعي: النطاق + (اختياريًا) موضع الجلسة مثل «جلسة اليوم · 2 من 3»
  function subtitleText(extra) {
    const base = session ? rangeLabel(session) : '';
    const ctxLabel = session && session.ctx && session.ctx.label ? session.ctx.label : '';
    return [base, ctxLabel, extra].filter(Boolean).join(' · ');
  }

  function setToolbar({ canMark, canToggle }) {
    $('markReviewedBtn').disabled = !canMark;
    $('toggleHideBtn').disabled = !canToggle;
    $('downloadTafsirBtn').disabled = !canToggle || !!offlineJob;
  }

  function showLoading() {
    $('reviewBody').replaceChildren(el('div', { class: 'review-loading', role: 'status', text: 'جارٍ تحميل الآيات…' }));
    $('reviewBody').setAttribute('aria-busy', 'true');
  }

  function errorMessage(err) {
    const code = err && err.code;
    if (code === 'invalid') {
      return 'وصلت بيانات غير صالحة من مصدر النص، فلم نعرضها حفاظًا على سلامة النص. حاول مرة أخرى لاحقًا.';
    }
    if (code === 'http') return 'تعذّر جلب نص الآيات من المصدر الآن. حاول مرة أخرى لاحقًا.';
    if (code === 'timeout') return 'انتهت مهلة الاتصال أثناء جلب نص الآيات. تحقق من الإنترنت وحاول مرة أخرى.';
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return (offline ? 'لا يوجد اتصال بالإنترنت حاليًا.' : 'تعذّر الاتصال بالإنترنت لجلب نص الآيات.') +
      ' تحتاج شبكة إنترنت أول مرة لعرض كل سورة، وبعدها تُحفظ نصوصها على جهازك لاستخدامها لاحقًا دون اتصال.';
  }

  function showError(err, spec, opener, ctx) {
    const body = $('reviewBody');
    body.removeAttribute('aria-busy');
    body.replaceChildren(
      el('div', { class: 'review-error', role: 'alert' },
        el('p', { text: errorMessage(err) }),
        el('button', { type: 'button', class: 'btn btn-ghost retry-btn', text: 'إعادة المحاولة', onClick: () => begin(spec, opener, ctx) })
      )
    );
    setToolbar({ canMark: false, canToggle: false });
  }

  // ---------- عرض الآيات ووضع الاختبار ----------
  // وضع الاختبار: يبقى نص الآية بحجمه كما هو ويُموَّه بصريًا فقط (CSS blur). هذا إجراء واجهة وليس حماية بيانات:
  // النص يبقى في الصفحة ويمكن لمن يفحصها قراءته.
  function paintAyah(node, ayah) {
    node.textContent = ayah.text;
    node.classList.toggle('is-hidden', !ayah.shown);
    if (ayah.shown) node.removeAttribute('aria-label'); // النص ظاهر ويُقرأ بنفسه
    else node.setAttribute('aria-label', `الآية رقم ${ayah.num} مخفية. اضغط لإظهارها`);
  }

  // بنية كل آية: <span class="ayah"> نص الآية (data-surah/data-ayah) + زر رقم الآية </span>
  // ربط الآية بالتفسير يعتمد على data-* وليس على ترتيب العناصر.
  function renderAyahs(surah, ayahs, hasBasmala) {
    const body = $('reviewBody');
    body.removeAttribute('aria-busy');
    TafsirUI.reset();
    const flow = el('div', { class: 'ayah-flow', lang: 'ar', dir: 'rtl' });
    ayahs.forEach((ayah) => {
      const node = el('span', {
        class: 'ayah-text', role: 'button', tabindex: '0',
        'data-surah': String(surah), 'data-ayah': String(ayah.num)
      });
      const toggle = () => {
        ayah.shown = !ayah.shown;
        paintAyah(node, ayah);
        syncToggleButton();
      };
      node.addEventListener('click', toggle);
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      });
      ayah.node = node;
      paintAyah(node, ayah);
      const num = el('button', {
        type: 'button', class: 'ayah-num',
        'data-surah': String(surah), 'data-ayah': String(ayah.num),
        'aria-label': `عرض تفسير الآية ${ayah.num}`, title: 'عرض التفسير',
        text: ayah.num.toLocaleString('ar-EG') // أرقام هندية كالمصحف (١٢٣)
      });
      flow.append(el('span', { class: 'ayah' }, node, ' ', num), ' ');
    });
    body.replaceChildren(...(hasBasmala ? [el('div', { class: 'basmala', lang: 'ar', dir: 'rtl', text: QuranApi.BASMALA })] : []), flow);
  }

  function syncToggleButton() {
    if (!session) return;
    const anyHidden = session.ayahs.some((a) => !a.shown);
    const btn = $('toggleHideBtn');
    btn.classList.toggle('on', anyHidden);
    btn.textContent = anyHidden ? 'إظهار كل النص' : 'إخفاء النص للاختبار';
  }

  function toggleAll() {
    if (!session || session.status !== 'ready') return;
    const anyHidden = session.ayahs.some((a) => !a.shown);
    session.ayahs.forEach((a) => {
      a.shown = anyHidden; // إن وُجد مخفي أظهر الكل، وإلا أخفِ الكل
      paintAyah(a.node, a);
    });
    syncToggleButton();
  }

  // ---------- وضع القراءة: إخفاء الشريط العلوي وشريط الأدوات السفلي لمساحة أكبر للآيات ----------
  function setReading(on) {
    $('reviewOverlay').classList.toggle('reading', on);
    $('readExitBtn').hidden = !on;
    if (on) TafsirUI.hide();
    TafsirUI.position();
    if (on) $('readExitBtn').focus(); else if (isOpen()) $('readModeBtn').focus();
  }

  // ---------- اختيار التفسير والخط ----------
  function renderTafsirSwitch() {
    const active = Settings.get('tafsirId');
    const box = $('tafsirSwitch');
    box.replaceChildren(
      ...TafsirApi.TAFSIR_IDS.map((id) => el('button', {
        type: 'button',
        class: `tafsir-opt${id === active ? ' on' : ''}`,
        'data-tafsir': id,
        'aria-pressed': id === active ? 'true' : 'false',
        text: TafsirApi.TAFSIRS[id].name,
        onClick: () => chooseTafsir(id)
      }))
    );
    $('tafsirActiveLabel').textContent = `التفسير النشط: ${TafsirApi.TAFSIRS[active].name}`;
  }

  function chooseTafsir(id) {
    if (id === Settings.get('tafsirId')) return;
    TafsirUI.hide(); // لا نترك تفسيرًا قديمًا ظاهرًا بعد تغيير الاختيار؛ البيانات المخزنة لا تُمس
    const r = Settings.set('tafsirId', id);
    renderTafsirSwitch();
    if (!r.ok) UI.toast('تعذّر حفظ اختيارك للتفسير، وسيبقى مفعّلًا حتى إغلاق التطبيق.', 'error');
  }

  function applyFont() {
    $('reviewBody').style.setProperty('--ayah-scale', String(Settings.get('fontScale')));
  }
  function changeFont(dir) {
    const { result } = Settings.changeFont(dir);
    applyFont();
    TafsirUI.position();
    if (!result.ok) UI.toast('تعذّر حفظ حجم الخط.', 'error');
  }

  // ---------- تنزيل تفسير المقطع للاستخدام دون اتصال ----------
  async function downloadTafsirForEntry() {
    if (!session || session.status !== 'ready' || offlineJob) return;
    const entry = { surah: session.surah, from: session.from, to: session.to };
    const tafsirId = Settings.get('tafsirId');
    const name = TafsirApi.TAFSIRS[tafsirId].name;
    const job = { cancelled: false, controller: new AbortController() };
    offlineJob = job;
    const btn = $('downloadTafsirBtn');
    btn.disabled = true;
    const total = entry.to - entry.from + 1;
    let done = 0, skipped = 0, failure = null;
    try {
      for (let a = entry.from; a <= entry.to; a++) {
        if (job.cancelled) break;
        btn.textContent = `${done + skipped + 1}/${total}`;
        try {
          const r = await TafsirApi.fetchTafsir(tafsirId, entry.surah, a, { signal: job.controller.signal, persist: true });
          if (r.storageError) { failure = { code: 'storage' }; break; }
          done++;
        } catch (err) {
          if (err.code === 'aborted') break;
          if (err.code === 'notfound' || err.code === 'empty') { skipped++; continue; } // آية بلا نص متاح: نتابع
          failure = err;
          break;
        }
      }
    } finally {
      offlineJob = null;
      btn.textContent = '⬇';
      if (session) btn.disabled = false;
    }
    if (job.cancelled) return;
    if (failure && failure.code === 'storage') {
      UI.toast(`توقف الحفظ: التخزين ممتلئ أو غير متاح. حُفظ ${done} من ${total}.`, 'error');
    } else if (failure) {
      UI.toast(`توقف الحفظ (${TafsirApi.describeError(failure, name)}) حُفظ ${done} من ${total}.`, 'error');
    } else {
      const extra = skipped ? ` (${skipped} آية بلا نص متاح)` : '';
      UI.toast(`حُفظ ${name} لهذا المقطع على جهازك: ${done} من ${total}${extra}.`, 'success');
    }
  }

  // ---------- فتح الجلسة ----------
  // ctx (اختياري): { kind: 'session'|'random'|'range', label, onRated(info) } — سياق قادم من تبويب المراجعة.
  function open(entryId, opener, ctx) {
    const entry = Memorization.find(entryId);
    if (!entry) return Promise.resolve();
    return begin({
      entryId: entry.id, surah: entry.surah, from: entry.from, to: entry.to, title: entry.surahName,
      kind: (ctx && ctx.kind) || 'normal'
    }, opener, ctx);
  }

  // مراجعة حرة لنطاق غير مرتبط بمحفوظ: { surah, from, to } بعد التحقق منه من الاستدعاء.
  function openRange(range, opener, ctx) {
    const s = Quran.surahByNumber(range.surah);
    if (!s) return Promise.resolve();
    return begin({
      entryId: null, surah: s.n, from: range.from, to: range.to, title: s.name,
      kind: (ctx && ctx.kind) || 'range'
    }, opener, ctx);
  }

  async function begin(spec, opener, ctx) {
    if (opener) openerFocus = opener;
    if (abortController) abortController.abort(); // إلغاء أي طلب سابق غير لازم
    cancelOfflineJob();
    TafsirUI.reset();
    hideRatePanel();
    abortController = new AbortController();
    const token = ++tokenCounter;
    session = {
      token, entryId: spec.entryId, surah: spec.surah, from: spec.from, to: spec.to, kind: spec.kind,
      ctx: ctx || null, spec, status: 'loading', openedAt: Utils.now().toISOString(), ayahs: [], marking: false
    };

    $('reviewTitle').textContent = spec.title;
    $('reviewSubtitle').textContent = subtitleText();
    $('toggleHideBtn').classList.remove('on');
    $('toggleHideBtn').textContent = 'إخفاء النص للاختبار';
    renderTafsirSwitch();
    applyFont();
    setToolbar({ canMark: false, canToggle: false });
    showLoading();
    setReading(false);
    $('reviewOverlay').classList.add('active');
    $('reviewCloseBtn').focus();

    let all;
    try {
      all = await QuranApi.fetchSurahAyahs(spec.surah, { signal: abortController.signal });
    } catch (err) {
      if (!session || session.token !== token) return; // طلب قديم وصل بعد إغلاق الشاشة أو فتح مقطع آخر
      if (err && err.code === 'aborted') return;
      session.status = 'error';
      showError(err, spec, opener, ctx);
      return;
    }
    if (!session || session.token !== token) return;

    const slice = [];
    let hasBasmala = false;
    for (let i = spec.from; i <= spec.to; i++) {
      let text = all[i - 1];
      if (typeof text !== 'string' || !text.trim()) {
        session.status = 'error';
        showError(new QuranApi.ApiError('invalid'), spec, opener, ctx);
        return;
      }
      const split = QuranApi.splitBasmala(spec.surah, i, text);   // البسملة سطر مستقل فوق السورة كالمصحف
      if (split.basmala && split.text) { text = split.text; hasBasmala = true; }
      slice.push({ num: i, text, shown: true });
    }
    session.ayahs = slice;
    session.status = 'ready';
    renderAyahs(spec.surah, slice, hasBasmala);
    setToolbar({ canMark: true, canToggle: true });
  }

  function cancelOfflineJob() {
    if (offlineJob) {
      offlineJob.cancelled = true;
      offlineJob.controller.abort();
    }
  }

  function close() {
    if (abortController) abortController.abort();
    abortController = null;
    cancelOfflineJob();
    session = null;
    tokenCounter++; // يبطل أي ردّ متأخر
    TafsirUI.reset();
    hideRatePanel();
    $('reviewOverlay').classList.remove('active');
    $('reviewBody').replaceChildren(); // لا نترك نص الآيات في DOM بعد الإغلاق
    if (openerFocus && typeof openerFocus.focus === 'function' && document.contains(openerFocus)) {
      openerFocus.focus();
    }
    openerFocus = null;
    if (onCloseCb) onCloseCb();
  }

  function isOpen() {
    return $('reviewOverlay').classList.contains('active');
  }

  // ---------- لوحة التقييم ----------
  function showRatePanel() {
    if (!session || session.status !== 'ready') return;
    const panel = $('ratePanel');
    $('rateNote').value = '';
    panel.hidden = false;
    panel.querySelector('[data-rating]').focus();
  }
  function hideRatePanel() {
    const panel = $('ratePanel');
    if (panel) panel.hidden = true;
  }
  function isRatePanelOpen() {
    return !$('ratePanel').hidden;
  }

  // ---------- تسجيل الإتمام ----------
  // rating: أحد Storage.RATINGS أو undefined (حفظ دون تقييم). note: ملاحظة اختيارية.
  function markReviewed(rating, note) {
    if (!session || session.status !== 'ready' || session.marking) return;
    const current = session;
    const entry = current.entryId ? Memorization.find(current.entryId) : null;
    if (current.entryId && !entry) return; // المقطع حُذف أثناء الجلسة
    const cleanRating = Storage.RATINGS.includes(rating) ? rating : null;
    const cleanNote = typeof note === 'string' ? note.trim().slice(0, 300) : '';
    current.marking = true;
    const btn = $('markReviewedBtn');
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    let succeeded = false;
    try {
      const now = Utils.now();
      const date = Utils.toLocalDateStr(now);
      // المراجعة الحرة لنطاق لا تغيّر أي مقطع محفوظ؛ تُسجَّل في السجل فقط.
      const result = entry
        ? Memorization.update(entry.id, (e) => ({
          ...e,
          lastReviewed: date,
          reviewCount: (e.reviewCount || 0) + 1,
          lastRating: cleanRating || e.lastRating || null
        }))
        : { ok: true, entry: null };
      if (!result.ok) {
        UI.toast(Storage.describeError(result) || 'تعذّر تسجيل المراجعة.', 'error');
        return;
      }
      succeeded = true;
      hideRatePanel();
      const logResult = ReviewLog.append({
        id: Utils.generateId('r'),
        entryId: entry ? entry.id : null,
        surah: current.surah,
        from: current.from,
        to: current.to,
        type: current.kind,
        status: 'completed',
        rating: cleanRating,
        note: cleanNote,
        openedAt: current.openedAt,
        completedAt: now.toISOString(),
        durationSec: Math.max(0, Math.round((now.getTime() - new Date(current.openedAt).getTime()) / 1000)),
        date
      });
      if (logResult.ok) UI.toast('أحسنت! سجّلنا مراجعتك اليوم', 'success');
      else UI.toast('سُجّلت المراجعة على المقطع، لكن تعذّر حفظ سجل المراجعات التفصيلي.', 'error');
      if (session === current) {
        $('reviewSubtitle').textContent = subtitleText(result.entry ? `رُوجعت ${result.entry.reviewCount} مرة` : '');
      }
      if (current.ctx && typeof current.ctx.onRated === 'function') {
        const cb = current.ctx.onRated;
        // مهلة قصيرة ليرى المستخدم رسالة النجاح قبل الانتقال
        setTimeout(() => { if (session === current) cb({ entryId: current.entryId, rating: cleanRating, kind: current.kind }); }, 900);
      }
    } finally {
      current.marking = false;
      btn.removeAttribute('aria-busy');
      if (!succeeded) {
        if (session === current) btn.disabled = false; // فشلت العملية: أعد تفعيل الزر فورًا
      } else {
        // نجحت: فترة تهدئة قصيرة ضد النقر المزدوج ثم يعود الزر
        setTimeout(() => {
          if (session === current && current.status === 'ready') btn.disabled = false;
        }, config.cooldownMs);
      }
    }
  }

  function init(onClose) {
    onCloseCb = onClose;
    // الآيات المرتبطة بمحفوظات تُخزَّن تفاسيرها محليًا عند عرضها؛ غيرها يبقى في ذاكرة الجلسة فقط.
    TafsirUI.init($('reviewBody'), (surah, ayah) =>
      Memorization.all().some((e) => e.surah === surah && ayah >= e.from && ayah <= e.to));

    $('reviewCloseBtn').addEventListener('click', close);
    $('readModeBtn').addEventListener('click', () => setReading(true));
    $('readExitBtn').addEventListener('click', () => setReading(false));
    $('toggleHideBtn').addEventListener('click', toggleAll);
    $('markReviewedBtn').addEventListener('click', showRatePanel);
    $('fontDownBtn').addEventListener('click', () => changeFont(-1));
    $('fontUpBtn').addEventListener('click', () => changeFont(1));
    $('downloadTafsirBtn').addEventListener('click', downloadTafsirForEntry);

    $('ratePanel').querySelectorAll('[data-rating]').forEach((b) => {
      b.addEventListener('click', () => markReviewed(b.dataset.rating, $('rateNote').value));
    });
    $('rateSkipBtn').addEventListener('click', () => markReviewed(undefined, $('rateNote').value));
    $('rateCancelBtn').addEventListener('click', hideRatePanel);

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !isOpen() || UI.isModalOpen()) return;
      if (isRatePanelOpen()) hideRatePanel();
      else close();
    });
    renderTafsirSwitch();
  }

  NS.Review = { init, open, openRange, close, isOpen, markReviewed, config, RATING_LABELS };
  NS.ReviewLog = ReviewLog;
})(globalThis);
