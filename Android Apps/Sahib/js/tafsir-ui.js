/*
 * tafsir-ui.js — عرض التفسير بالضغط المطول على الآية (فأرة ولمس) وببديل لوحة المفاتيح.
 *
 * المبادئ:
 *  - أحداث Pointer فقط (حدث واحد لكل تفاعل فلا يتكرر مع touch/mouse).
 *  - المؤقت يُلغى عند الحركة (> MOVE_TOLERANCE) أو التمرير أو pointercancel أو رفع الإصبع.
 *  - لا نستخدم preventDefault على pointerdown ولا touch-action:none، فيبقى التمرير الطبيعي.
 *  - عنصر تفسير واحد فقط يُعاد استخدامه (لا نوافذ متراكمة).
 *  - ردّ يصل بعد انتهاء التفاعل أو بعد الانتقال إلى آية أخرى لا يُعرض (يبقى في الذاكرة المؤقتة فقط).
 *  - النافذة تبقى ثابتة بعد رفع الإصبع (وضع pin دائمًا)، قابلة للتمرير إن طال النص، وتُغلق بالنقر/اللمس
 *    في أي مكان خارجها أو بزر ✕ أو بـ Esc. النقرة التي أغلقتها لا تُنفَّذ على ما تحتها.
 *  - الوصول البديل: زر رقم الآية يفتح التفسير نفسه.
 *  - كل آية تُعرَّف بـ data-surah و data-ayah ولا نعتمد على ترتيب DOM.
 */
(function (g) {
  'use strict';
  const NS = (g.Sahib = g.Sahib || {});
  const { Quran, Utils, TafsirApi, Settings } = NS;
  const $ = (id) => document.getElementById(id);

  const config = {
    holdMs: 500,          // الافتراضي؛ تُقرأ القيمة الفعلية من الإعدادات عند كل ضغط
    moveTolerance: 10     // بالبكسل؛ أكثر من ذلك يُعدّ تمريرًا/سحبًا
  };

  let container = null;       // عنصر الآيات (reviewBody)
  let pop = null;             // عنصر التفسير الوحيد
  let isPersistTarget = () => false; // (surah, ayah) => هل تنتمي الآية إلى مقطع محفوظ؟ يحددها review.js
  let press = null;           // { pointerId, x, y, node, timer, fired }
  let shown = null;           // { node, surah, ayah, mode:'hold'|'pin', token, tafsirId }
  let reqToken = 0;
  let abort = null;
  let suppressClick = false;

  function parseNode(node) {
    return { surah: Number(node.dataset.surah), ayah: Number(node.dataset.ayah) };
  }

  // ---------- العرض ----------
  function setBody(kind, text) {
    const body = pop.querySelector('.tafsir-body');
    body.className = `tafsir-body ${kind}`;
    body.textContent = text;
  }

  function position() {
    if (!shown || !pop || pop.hidden) return;
    const overlay = $('reviewOverlay').getBoundingClientRect();
    const margin = 12;
    const width = Math.min(overlay.width - margin * 2, 460);
    pop.style.width = `${width}px`;
    const left = Math.max(overlay.left + margin, Math.min(overlay.left + (overlay.width - width) / 2, overlay.right - width - margin));
    pop.style.left = `${left}px`;

    const rects = shown.node.getClientRects();
    const first = rects[0] || shown.node.getBoundingClientRect();
    const last = rects[rects.length - 1] || first;
    const popH = pop.offsetHeight;
    const spaceBelow = window.innerHeight - last.bottom - margin;
    const spaceAbove = first.top - margin;
    let top;
    if (popH <= spaceBelow || spaceBelow >= spaceAbove) top = last.bottom + 8;
    else top = first.top - popH - 8;
    top = Math.max(margin, Math.min(top, window.innerHeight - popH - margin));
    pop.style.top = `${top}px`;
  }

  function show(node, mode) {
    hide();
    const { surah, ayah } = parseNode(node);
    const tafsirId = Settings.get('tafsirId');
    const def = TafsirApi.TAFSIRS[tafsirId];
    const s = Quran.surahByNumber(surah);
    if (!def || !s || !Number.isInteger(ayah)) return;

    const token = ++reqToken;
    abort = new AbortController();
    shown = { node, surah, ayah, mode, token, tafsirId };
    node.classList.add('is-pressed');

    pop.hidden = false;
    pop.classList.toggle('pinned', mode === 'pin');
    pop.setAttribute('data-surah', String(surah));
    pop.setAttribute('data-ayah', String(ayah));
    pop.setAttribute('data-tafsir', tafsirId);
    pop.querySelector('.tafsir-name').textContent = def.name;
    pop.querySelector('.tafsir-ref').textContent = `${s.name} — الآية ${ayah}`;

    const cached = TafsirApi.getCachedTafsir(tafsirId, surah, ayah);
    if (cached) {
      setBody('text', TafsirApi.toPlainText(cached.text));
      position();
      return;
    }
    setBody('loading', 'جارٍ تحميل التفسير…');
    position();

    TafsirApi.fetchTafsir(tafsirId, surah, ayah, { signal: abort.signal, persist: isPersistTarget(surah, ayah) })
      .then((res) => {
        // تحقق من التطابق الكامل قبل العرض: نفس التفاعل، نفس السورة والآية والتفسير.
        if (!shown || shown.token !== token || shown.surah !== surah || shown.ayah !== ayah || shown.tafsirId !== tafsirId) return;
        setBody('text', TafsirApi.toPlainText(res.text));
        if (res.storageError) {
          const note = pop.querySelector('.tafsir-note');
          note.textContent = 'تعذّر حفظ هذا التفسير على جهازك (التخزين ممتلئ أو غير متاح)، لكن يمكنك قراءته الآن.';
          note.hidden = false;
        }
        position();
      })
      .catch((err) => {
        if (!shown || shown.token !== token) return;
        if (err && err.code === 'aborted') return;
        setBody('error', TafsirApi.describeError(err, def.name));
        position();
      });
  }

  function hide() {
    if (abort) { abort.abort(); abort = null; }
    reqToken++; // يبطل أي ردّ متأخر
    if (shown) shown.node.classList.remove('is-pressed');
    shown = null;
    if (pop) {
      pop.hidden = true;
      const note = pop.querySelector('.tafsir-note');
      if (note) note.hidden = true;
    }
  }

  function isVisible() {
    return !!shown;
  }

  // ---------- الضغط المطول ----------
  function clearPress() {
    if (press && press.timer) clearTimeout(press.timer);
    press = null;
  }

  function onPointerDown(e) {
    if (press || !e.isPrimary) return;                 // منع تداخل عمليتين
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const node = e.target.closest && e.target.closest('.ayah-text[data-ayah]');
    if (!node || !container.contains(node)) return;
    if (shown && shown.mode === 'pin') hide();
    press = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, node, timer: null, fired: false };
    press.timer = setTimeout(() => {
      if (!press) return;
      press.fired = true;
      press.timer = null;
      show(press.node, 'pin');
    }, Settings.get('holdMs') || config.holdMs);
  }

  function onPointerMove(e) {
    if (!press || e.pointerId !== press.pointerId || press.fired) return;
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > config.moveTolerance) clearPress();
  }

  function endPress(e) {
    if (!press || (e && e.pointerId !== undefined && e.pointerId !== press.pointerId)) return;
    const fired = press.fired;
    clearPress();
    if (fired) {
      // الضغط المطول انتهى: يختفي التفسير ونمنع نقرة الرفع من تبديل وضع الاختبار.
      // النافذة تبقى ظاهرة؛ نمنع فقط نقرة الرفع من تبديل وضع الاختبار.
      suppressClick = !!e && e.type === 'pointerup';
      setTimeout(() => { suppressClick = false; }, 350);
    }
  }

  function onScroll() {
    if (press && !press.fired) clearPress();
    position(); // النافذة ثابتة؛ تتبع موضع الآية فقط
  }

  // ---------- بديل لوحة المفاتيح والتقنيات المساعدة ----------
  function togglePin(node) {
    const { surah, ayah } = parseNode(node);
    if (shown && shown.mode === 'pin' && shown.surah === surah && shown.ayah === ayah) hide();
    else show(node.closest('.ayah').querySelector('.ayah-text'), 'pin');
  }

  function init(containerEl, persistPredicate) {
    container = containerEl;
    pop = $('tafsirPop');
    if (persistPredicate) isPersistTarget = persistPredicate;

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('scroll', onScroll, { passive: true });
    // pointerup/cancel على document حتى لو رُفع الإصبع/الزر خارج الآية
    document.addEventListener('pointerup', endPress, true);
    document.addEventListener('pointercancel', endPress, true);
    window.addEventListener('blur', () => endPress());

    // نقرة الرفع بعد ضغط مطول: لا تُمرَّر لمبدّل وضع الاختبار
    container.addEventListener('click', (e) => {
      if (suppressClick) {
        e.stopPropagation();
        e.preventDefault();
        suppressClick = false;
      }
    }, true);

    // منع قائمة المتصفح الناتجة عن الضغط المطول فقط (أثناء الضغط أو عرض التفسير)
    container.addEventListener('contextmenu', (e) => {
      if (press) e.preventDefault();
    });

    // زر رقم الآية (تفسير مثبّت)
    container.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest('.ayah-num[data-ayah]');
      if (btn) togglePin(btn);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && shown) {
        e.stopImmediatePropagation();
        hide();
      }
    }, true);
    // نقرة خارج التفسير المثبّت تغلقه
    document.addEventListener('pointerdown', (e) => {
      if (!shown || pop.contains(e.target)) return;
      if (e.target.closest && e.target.closest('.ayah-num')) return; // زر الرقم يبدّل بنفسه
      hide();
      // اللمسة التي أغلقت النافذة لا تُنفَّذ كنقرة على ما تحتها (مثل تبديل وضع الاختبار)
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 450);
    }, true);
    pop.querySelector('.tafsir-close').addEventListener('click', () => hide());
    pop.addEventListener('contextmenu', () => {}); // لا منع: يمكن نسخ نص التفسير
    window.addEventListener('resize', position);
  }

  // إعادة ضبط كاملة عند إغلاق المصحف أو إعادة رسم الآيات
  function reset() {
    clearPress();
    suppressClick = false;
    hide();
  }

  NS.TafsirUI = { init, show, hide, reset, isVisible, config, position };
})(globalThis);
