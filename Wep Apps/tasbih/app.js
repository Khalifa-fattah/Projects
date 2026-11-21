(() => {
  'use strict';

  /* ===================== أدوات عامة ===================== */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const dict = () => Object.create(null);
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (n) => Number(n).toLocaleString('en-US');
  const fmtShort = (n) => {
    if (n < 1000) return String(n);
    if (n < 1e6) return `${Math.floor(n / 100) / 10} ألف`;
    return `${Math.floor(n / 1e5) / 10} مليون`;
  };
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function h(tag, props = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null) continue;
      e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return e;
  }

  const ICONS = {
    grip: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.8"/><circle cx="15" cy="6" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="18" r="1.8"/><circle cx="15" cy="18" r="1.8"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>'
  };
  const icon = (name) => {
    const t = document.createElement('template');
    t.innerHTML = ICONS[name];
    return t.content.firstChild;
  };

  /* ===================== التواريخ ===================== */
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fmtMonth = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' });
  const fmtFull = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtDow = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', { weekday: 'short' });

  /* ===================== الأذكار الافتراضية ===================== */
  const DEFAULT_ADHKAR = [
    { id: 'd-subhan', text: 'سُبْحَانَ اللَّهِ', translit: 'Subhanallah', meaning: 'تنزيه الله عن كل نقص', target: 33 },
    { id: 'd-hamd', text: 'الْحَمْدُ لِلَّهِ', translit: 'Alhamdulillah', meaning: 'الشكر لله على كل النعم', target: 33 },
    { id: 'd-akbar', text: 'اللَّهُ أَكْبَرُ', translit: 'Allahu Akbar', meaning: 'الله أعظم من كل شيء', target: 34 },
    { id: 'd-subhan-bihamdihi', text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', translit: 'Subhanallahi wa bihamdihi', meaning: 'تنزيه الله عن كل نقص مع حمده والثناء عليه', target: 100 },
    { id: 'd-azim', text: 'سُبْحَانَ اللَّهِ الْعَظِيمِ', translit: 'Subhanallahil Azim', meaning: 'تنزيه الله العظيم عن كل نقص', target: 100 },
    { id: 'd-istighfar', text: 'أَسْتَغْفِرُ اللَّهَ الْعَظِيمَ وَأَتُوبُ إِلَيْهِ', translit: 'Astaghfirullah alazim wa atwb alih', meaning: 'طلب المغفرة من الله', target: 100 },
    { id: 'd-tawhid', text: 'لَا إِلَٰهَ إِلَّا اللَّهُ', translit: 'La ilaha illallah', meaning: 'كلمة التوحيد', target: 100 },
    { id: 'd-hawqala', text: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ', translit: 'La hawla wa la quwwata illa billah', meaning: 'كنز من كنوز الجنة', target: 100 },
    { id: 'd-hamd-rab', text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', translit: 'Alhamdu lillahi Rabbil Alamin', meaning: 'الثناء والشكر لله خالق جميع الخلق ومالكهم ومدبّر أمرهم', target: 100 },
    { id: 'd-salawat', text: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ', translit: 'Allahumma salli wa sallim ala nabiyyina Muhammad', meaning: 'الصلاة على النبي ﷺ', target: 100 },
    { id: 'd-yunus', text: 'لَا إِلَٰهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ', translit: 'La ilaha illa anta subhanaka inni kuntu minaz-zalimin', meaning: 'دعاء يونس عليه السلام: لا معبود بحق سواك، أنزّهك عن كل نقص، وإني كنت من الظالمين لنفسي', target: 100 },
    { id: 'd-musa', text: 'رَبِّ إِنِّي لِمَا أَنْزَلْتَ إِلَيَّ مِنْ خَيْرٍ فَقِيرٌ', translit: 'Rabbi inni lima anzalta ilayya min khayrin faqir', meaning: 'دعاء موسى عليه السلام: يا رب إني محتاج إلى أي خير تسوقه إليّ', target: 100 },
    { id: 'd-tahlil-100', text: 'لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ', translit: 'La ilaha illallahu wahdahu la sharika lah, lahul mulku wa lahul hamdu wa huwa ala kulli shayin qadir', meaning: 'إفراد الله بالعبادة والملك والحمد والقدرة', target: 100 }
  ];

  /* ===================== الحالة والتخزين ===================== */
  const KEY = 'tasbih.v1';
  const THEMES = { green: '#0a1a13', midnight: '#0a0e19', light: '#f5f0e3' };

  const clampInt = (v, min, max, def) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  };
  const str = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

  function defaultState() {
    const adhkar = DEFAULT_ADHKAR.map((a) => ({ ...a }));
    return {
      v: 1,
      adhkar,
      currentId: adhkar[0].id,
      counts: dict(),
      log: dict(),
      deleted: dict(),
      settings: { sound: false, vibrate: true, auto: true, wake: false, theme: 'green', goal: 100 }
    };
  }

  function sanitize(raw) {
    const s = defaultState();
    if (!raw || typeof raw !== 'object') return s;

    if (Array.isArray(raw.adhkar)) {
      const seen = new Set();
      const list = [];
      for (const a of raw.adhkar) {
        if (!a || typeof a !== 'object') continue;
        const id = str(a.id, 64);
        const text = str(a.text, 200);
        if (!id || !text || seen.has(id)) continue;
        seen.add(id);
        list.push({
          id, text,
          translit: str(a.translit, 100),
          meaning: str(a.meaning, 160),
          target: clampInt(a.target, 1, 99999, 33)
        });
      }
      if (list.length) s.adhkar = list;
    }

    // إضافة الذكر الجديد للبيانات القديمة، ما لم يكن المستخدم قد حذفه بنفسه.
    const newDhikr = DEFAULT_ADHKAR.find((a) => a.id === 'd-tahlil-100');
    const wasDeleted = raw.deleted &&
      Object.prototype.hasOwnProperty.call(raw.deleted, newDhikr.id);
    if (!s.adhkar.some((a) => a.id === newDhikr.id) && !wasDeleted) {
      s.adhkar.push({ ...newDhikr });
    }

    const ids = new Set(s.adhkar.map((a) => a.id));
    s.currentId = ids.has(raw.currentId) ? raw.currentId : s.adhkar[0].id;

    s.counts = dict();
    if (raw.counts && typeof raw.counts === 'object') {
      for (const a of s.adhkar) {
        const c = clampInt(raw.counts[a.id], 0, a.target, 0);
        if (c) s.counts[a.id] = c;
      }
    }

    s.log = dict();
    if (raw.log && typeof raw.log === 'object') {
      for (const [k, day] of Object.entries(raw.log)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !day || typeof day !== 'object') continue;
        const d = dict();
        for (const [id, n] of Object.entries(day)) {
          const v = clampInt(n, 0, 10000000, 0);
          if (v > 0 && id.length <= 64) d[id] = v;
        }
        if (Object.keys(d).length) s.log[k] = d;
      }
    }

    s.deleted = dict();
    if (raw.deleted && typeof raw.deleted === 'object') {
      for (const [id, t] of Object.entries(raw.deleted)) {
        const text = str(t, 200);
        if (text && id.length <= 64 && !ids.has(id)) s.deleted[id] = text;
      }
    }

    const st = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    s.settings = {
      sound: st.sound === true,
      vibrate: st.vibrate !== false,
      auto: st.auto !== false,
      wake: st.wake === true,
      theme: Object.prototype.hasOwnProperty.call(THEMES, st.theme) ? st.theme : 'green',
      goal: clampInt(st.goal, 1, 1000000, 100)
    };
    return s;
  }

  function load() {
    try {
      const txt = localStorage.getItem(KEY);
      if (txt) return sanitize(JSON.parse(txt));
    } catch (e) { /* بيانات تالفة: نبدأ من جديد */ }
    return defaultState();
  }

  let state = load();
  let saveTimer = 0;
  let saveWarned = false;

  function flush() {
    clearTimeout(saveTimer);
    saveTimer = 0;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      if (!saveWarned) { saveWarned = true; toast('تعذّر حفظ البيانات على هذا المتصفح'); }
    }
  }
  const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 200); };
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });

  /* ===================== دوال السجل ===================== */
  const cur = () => state.adhkar.find((a) => a.id === state.currentId) || state.adhkar[0];
  const curIndex = () => Math.max(0, state.adhkar.findIndex((a) => a.id === state.currentId));
  const nameOf = (id) => {
    const a = state.adhkar.find((x) => x.id === id);
    return a ? a.text : state.deleted[id] || 'ذكر محذوف';
  };

  function addLog(id, n) {
    const key = dayKey();
    let d = state.log[key];
    if (!d) d = state.log[key] = dict();
    const v = (d[id] || 0) + n;
    if (v <= 0) delete d[id]; else d[id] = v;
    if (!Object.keys(d).length) delete state.log[key];
  }
  const dayTotal = (key) => {
    const d = state.log[key];
    if (!d) return 0;
    let t = 0;
    for (const k in d) t += d[k];
    return t;
  };
  function allTotal() {
    let t = 0;
    for (const k in state.log) t += dayTotal(k);
    return t;
  }
  /* تقدّم اليوم = مجموع ما أُنجز من كل ذكر (بحدّ عدده) ÷ مجموع أعداد كل الأذكار */
  function dayProgress(key) {
    const d = state.log[key];
    let total = 0, done = 0;
    for (const a of state.adhkar) {
      total += a.target;
      done += Math.min(d ? d[a.id] || 0 : 0, a.target);
    }
    return { done, total, ratio: total ? done / total : 0 };
  }
  const pctOf = (ratio) => Math.min(100, Math.floor(ratio * 100));

  function streak() {
    let d = new Date();
    if (!dayTotal(dayKey(d))) d = addDays(d, -1);
    let n = 0;
    while (dayTotal(dayKey(d)) > 0) { n++; d = addDays(d, -1); }
    return n;
  }
  function bestStreak() {
    const keys = Object.keys(state.log).filter((k) => dayTotal(k) > 0).sort();
    let best = 0, run = 0, prev = null;
    for (const k of keys) {
      const d = parseKey(k);
      run = prev && Math.round((d - prev) / 864e5) === 1 ? run + 1 : 1;
      if (run > best) best = run;
      prev = d;
    }
    return best;
  }

  /* ===================== صوت واهتزاز ===================== */
  let actx = null;
  function audio() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function beep(freq, dur, vol = 0.15, type = 'sine', delay = 0) {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  const vib = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* غير مدعوم */ } };
  const tickFx = () => {
    if (state.settings.sound) beep(700, 0.05, 0.12, 'triangle');
    if (state.settings.vibrate) vib(12);
  };
  const doneFx = () => {
    if (state.settings.sound) { beep(660, 0.14, 0.16); beep(880, 0.22, 0.16, 'sine', 0.14); }
    if (state.settings.vibrate) vib([70, 50, 110]);
  };

  /* ===================== تنبيه (Toast) ===================== */
  let toastTimer = 0;
  function toast(msg, action) {
    const t = $('#toast');
    t.replaceChildren(h('span', { text: msg }));
    if (action) {
      t.append(h('button', {
        class: 'toast-act', type: 'button', text: action.label,
        onclick: () => { hideToast(); action.fn(); }
      }));
    }
    try { if (t.showPopover && !t.matches(':popover-open')) t.showPopover(); } catch (e) { /* ignore */ }
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, action ? 5000 : 2600);
  }
  function hideToast() {
    const t = $('#toast');
    t.classList.remove('show');
    setTimeout(() => {
      if (t.classList.contains('show')) return;
      try { if (t.hidePopover && t.matches(':popover-open')) t.hidePopover(); } catch (e) { /* ignore */ }
    }, 260);
  }

  /* ===================== نوافذ ===================== */
  let lastDragEnd = 0;
  $$('dialog').forEach((dlg) => {
    dlg.addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('[data-close]')) { dlg.close(); return; }
      if (e.target !== dlg || Date.now() - lastDragEnd < 400) return;
      const r = dlg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
    });
  });

  function confirmBox(message, okLabel = 'تأكيد', danger = false) {
    return new Promise((resolve) => {
      const dlg = $('#dlgConfirm');
      $('#confirmMsg').textContent = message;
      const ok = $('#confirmOk');
      ok.textContent = okLabel;
      ok.classList.toggle('danger', danger);
      ok.classList.toggle('gold', !danger);
      dlg.returnValue = '';
      dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
      dlg.showModal();
    });
  }

  /* ===================== شاشة العدّاد ===================== */
  const el = {
    counter: $('#counter'), num: $('#countNum'), of: $('#countOf'), ring: $('#ringProg'),
    card: $('#dhikrCard'), ar: $('#dhikrAr'), tr: $('#dhikrTr'), mean: $('#dhikrMean'),
    undo: $('#btnUndo'),
    prev: $('#btnPrevDhikr'), next: $('#btnNextDhikr')
  };
  let shownId = null;

  function renderCounter() {
    const a = cur();
    const c = Math.min(state.counts[a.id] || 0, a.target);

    el.ar.textContent = a.text;
    el.tr.textContent = a.translit;
    el.tr.hidden = !a.translit;
    el.mean.textContent = a.meaning;
    el.mean.hidden = !a.meaning;

    el.num.textContent = c;
    el.of.textContent = `/ ${a.target}`;
    el.ring.style.strokeDashoffset = String(1 - c / a.target);
    el.ring.style.opacity = c > 0 ? '1' : '0';
    el.undo.disabled = c <= 0;

    $('#stStreak').textContent = streak();
    $('#stTotal').textContent = fmt(dayTotal(dayKey()));
    $('#stGoal').textContent = `${pctOf(dayProgress(dayKey()).ratio)}%`;

    if (shownId !== null && shownId !== a.id && !reduceMotion && el.card.animate) {
      el.card.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'ease-out' });
    }
    shownId = a.id;
  }

  function pulse() {
    if (reduceMotion || !el.counter.animate) return;
    el.counter.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(.965)', offset: 0.35 }, { transform: 'scale(1)' }],
      { duration: 140, easing: 'ease-out' }
    );
  }

  function tap() {
    const a = cur();
    let c = state.counts[a.id] || 0;
    if (c >= a.target) c = 0;
    c++;
    state.counts[a.id] = c;
    addLog(a.id, 1);

    if (c >= a.target) {
      doneFx();
      el.counter.classList.remove('done');
      void el.counter.offsetWidth;
      el.counter.classList.add('done');
      setTimeout(() => el.counter.classList.remove('done'), 700);
      if (state.settings.auto) advance();
    } else {
      tickFx();
    }
    pulse();
    renderCounter();
    save();
  }

  function advance() {
    const n = state.adhkar.length;
    const i = curIndex();
    const finished = cur();
    state.counts[finished.id] = 0;
    const next = state.adhkar[(i + 1) % n];
    state.currentId = next.id;
    if (n > 1 && i === n - 1) toast('أتممت جميع الأذكار، بارك الله فيك');
    else if (n > 1) toast(`التالي: ${next.text}`);
  }

  // التنقل اليدوي يحافظ على عدد كل ذكر كما هو.
  function navigateDhikr(direction) {
    const n = state.adhkar.length;
    if (n < 2) return;
    const i = curIndex();
    const nextIndex = (i + direction + n) % n;
    state.currentId = state.adhkar[nextIndex].id;
    renderCounter();
    save();
  }

  el.prev.addEventListener('click', () => navigateDhikr(-1));
  el.next.addEventListener('click', () => navigateDhikr(1));

  el.counter.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    tap();
  });
  el.counter.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); tap(); }
  });
  el.counter.addEventListener('click', (e) => e.preventDefault());
  el.counter.addEventListener('contextmenu', (e) => e.preventDefault());

  el.undo.addEventListener('click', () => {
    const a = cur();
    const c = state.counts[a.id] || 0;
    if (c <= 0) return;
    state.counts[a.id] = c - 1;
    addLog(a.id, -1);
    vib(8);
    renderCounter();
    save();
  });

  $('#btnReset').addEventListener('click', () => {
    const a = cur();
    const prev = state.counts[a.id] || 0;
    if (!prev) { toast('العدّاد صفر بالفعل'); return; }
    state.counts[a.id] = 0;
    renderCounter();
    save();
    toast('تم التصفير', {
      label: 'تراجع',
      fn: () => {
        if (!state.adhkar.some((x) => x.id === a.id)) return;
        state.counts[a.id] = prev;
        renderCounter();
        save();
      }
    });
  });

  /* ===================== قائمة الأذكار + السحب للترتيب ===================== */
  const dzList = $('#dzList');

  function dzItem(a) {
    const c = state.counts[a.id] || 0;
    return h('li', { class: 'dz-item' + (a.id === state.currentId ? ' sel' : ''), 'data-id': a.id },
      h('button', { class: 'handle', type: 'button', 'aria-label': 'اسحب لإعادة الترتيب' }, icon('grip')),
      h('button', { class: 'dz-main', type: 'button', onclick: () => selectDhikr(a.id) },
        h('span', { class: 'dz-text', text: a.text }),
        h('span', { class: 'dz-meta', text: `${c} / ${a.target}` })),
      h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': 'تعديل', onclick: () => openEdit(a.id) }, icon('edit')),
      h('button', { class: 'icon-btn sm danger', type: 'button', 'aria-label': 'حذف', onclick: () => removeDhikr(a.id) }, icon('trash'))
    );
  }
  function renderAdhkarList() {
    dzList.replaceChildren(...state.adhkar.map(dzItem));
  }
  function openAdhkar() {
    renderAdhkarList();
    $('#dlgAdhkar').showModal();
    const sel = $('.dz-item.sel', dzList);
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'center' });
  }
  function selectDhikr(id) {
    state.currentId = id;
    save();
    renderCounter();
    $('#dlgAdhkar').close();
  }

  async function removeDhikr(id) {
    if (state.adhkar.length <= 1) { toast('لا يمكن حذف آخر ذكر'); return; }
    const a = state.adhkar.find((x) => x.id === id);
    if (!a) return;
    if (!(await confirmBox(`حذف الذكر «${a.text}»؟ سيبقى في السجل السابق.`, 'حذف', true))) return;
    const i = state.adhkar.findIndex((x) => x.id === id);
    state.deleted[id] = a.text;
    state.adhkar.splice(i, 1);
    delete state.counts[id];
    if (state.currentId === id) state.currentId = state.adhkar[Math.min(i, state.adhkar.length - 1)].id;
    save();
    renderAdhkarList();
    renderCounter();
  }

  function enableDrag(list, onDone) {
    let item = null, handle = null, pid = null, grab = 0, lastY = 0, raf = 0;

    function step() {
      if (!item) return;
      const sr = list.getBoundingClientRect();
      if (lastY < sr.top + 44) list.scrollTop -= 10;
      else if (lastY > sr.bottom - 44) list.scrollTop += 10;

      item.style.transform = 'none';
      const want = lastY - grab;
      const center = want + item.offsetHeight / 2;

      let prev = item.previousElementSibling;
      while (prev && center < prev.getBoundingClientRect().top + prev.offsetHeight / 2) {
        list.insertBefore(item, prev);
        prev = item.previousElementSibling;
      }
      let next = item.nextElementSibling;
      while (next && center > next.getBoundingClientRect().top + next.offsetHeight / 2) {
        list.insertBefore(next, item);
        next = item.nextElementSibling;
      }
      const nat = item.getBoundingClientRect().top;
      item.style.transform = `translateY(${want - nat}px)`;
      raf = requestAnimationFrame(step);
    }

    list.addEventListener('pointerdown', (e) => {
      const hd = e.target.closest('.handle');
      if (!hd || item) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      item = hd.closest('.dz-item');
      handle = hd;
      pid = e.pointerId;
      try { hd.setPointerCapture(pid); } catch (err) { /* ignore */ }
      grab = e.clientY - item.getBoundingClientRect().top;
      lastY = e.clientY;
      item.classList.add('dragging');
      list.classList.add('sorting');
      raf = requestAnimationFrame(step);
    });
    list.addEventListener('pointermove', (e) => {
      if (item && e.pointerId === pid) lastY = e.clientY;
    });
    const end = (e) => {
      if (!item || e.pointerId !== pid) return;
      cancelAnimationFrame(raf);
      item.style.transform = '';
      item.classList.remove('dragging');
      list.classList.remove('sorting');
      try { handle.releasePointerCapture(pid); } catch (err) { /* ignore */ }
      item = handle = null;
      lastDragEnd = Date.now();
      onDone($$('.dz-item', list).map((li) => li.dataset.id));
    };
    list.addEventListener('pointerup', end);
    list.addEventListener('pointercancel', end);
  }

  enableDrag(dzList, (ids) => {
    const map = new Map(state.adhkar.map((a) => [a.id, a]));
    const reordered = ids.map((id) => map.get(id)).filter(Boolean);
    if (reordered.length === state.adhkar.length) {
      state.adhkar = reordered;
      save();
    }
  });

  /* ===================== إضافة / تعديل ذكر ===================== */
  const form = $('#formDhikr');
  let editingId = null;

  function openEdit(id) {
    editingId = id || null;
    const a = id ? state.adhkar.find((x) => x.id === id) : null;
    $('#ttlEdit').textContent = a ? 'تعديل الذكر' : 'إضافة ذكر';
    form.text.value = a ? a.text : '';
    form.translit.value = a ? a.translit : '';
    form.meaning.value = a ? a.meaning : '';
    form.target.value = a ? a.target : 33;
    $('#editErr').hidden = true;
    $('#dlgEdit').showModal();
    form.text.focus();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const err = $('#editErr');
    const text = str(form.text.value, 200);
    const target = Math.floor(Number(form.target.value));
    if (!text) { err.textContent = 'اكتب نص الذكر أولاً.'; err.hidden = false; form.text.focus(); return; }
    if (!(target >= 1 && target <= 99999)) { err.textContent = 'العدد يجب أن يكون بين 1 و 99999.'; err.hidden = false; form.target.focus(); return; }
    const data = { text, translit: str(form.translit.value, 100), meaning: str(form.meaning.value, 160), target };

    if (editingId) {
      const a = state.adhkar.find((x) => x.id === editingId);
      if (a) {
        Object.assign(a, data);
        if ((state.counts[a.id] || 0) > a.target) state.counts[a.id] = 0;
      }
    } else {
      state.adhkar.push({ id: uid(), ...data });
    }
    save();
    $('#dlgEdit').close();
    renderAdhkarList();
    renderCounter();
    if (!editingId) {
      dzList.scrollTop = dzList.scrollHeight;
      toast('تمت إضافة الذكر');
    }
  });

  $('#btnAddDhikr').addEventListener('click', () => openEdit(null));
  el.card.addEventListener('click', openAdhkar);

  /* ===================== شاشة الخطط ===================== */
  function renderPlans() {
    const key = dayKey();
    const p = dayProgress(key);
    const pct = pctOf(p.ratio);

    $('#plToday').textContent = `${pct}%`;
    $('#plGoalTxt').textContent = `${fmt(p.done)} من ${fmt(p.total)} تسبيحة`;
    $('#plMeter').style.width = `${pct}%`;
    $('#plMeterWrap').setAttribute('aria-valuenow', String(pct));

    const todayD = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(todayD, -i);
      days.push({ d, pct: pctOf(dayProgress(dayKey(d)).ratio), today: i === 0 });
    }
    $('#plPlot').replaceChildren(
      ...days.map((x) => h('div', { class: 'col' },
        h('span', { class: 'val', text: x.pct ? `${x.pct}%` : '' }),
        h('div', { class: 'bar' + (x.pct >= 100 ? ' hit' : ''), style: `height:${x.pct}%` })))
    );
    $('#plLabels').replaceChildren(
      ...days.map((x) => h('span', { class: x.today ? 'today' : '', text: fmtDow.format(x.d) }))
    );

    const todayLog = state.log[key] || dict();
    const rows = state.adhkar.map((a) => ({ name: a.text, n: todayLog[a.id] || 0, target: a.target }));
    for (const id in todayLog) {
      if (!state.adhkar.some((a) => a.id === id)) rows.push({ name: nameOf(id), n: todayLog[id], target: 0 });
    }
    $('#plList').replaceChildren(...rows.map((r) => {
      const rounds = r.target ? Math.floor(r.n / r.target) : 0;
      const done = r.target && r.n >= r.target;
      return h('li', { class: r.n ? '' : 'dim' },
        h('span', { class: 'nm' }, r.name,
          rounds > 1 ? h('span', { class: 'sub', text: `${rounds} جولات كاملة` }) : null),
        h('span', { class: 'ct', style: done ? 'color:var(--gold)' : '', text: r.target ? `${fmt(Math.min(r.n, r.target))}/${fmt(r.target)}` : fmt(r.n) }));
    }));
  }

  /* ===================== شاشة السجل ===================== */
  let logY = null, logM = null, logSel = null;

  function renderLog() {
    const now = new Date();
    if (logY === null) { logY = now.getFullYear(); logM = now.getMonth(); logSel = dayKey(now); }

    const first = new Date(logY, logM, 1);
    const dim = new Date(logY, logM + 1, 0).getDate();
    const lead = (first.getDay() + 1) % 7;
    const isCurrentMonth = logY === now.getFullYear() && logM === now.getMonth();
    const todayKey = dayKey(now);

    $('#monthTitle').textContent = fmtMonth.format(first);
    $('#monthNext').disabled = isCurrentMonth;

    const sat = new Date(2024, 0, 6);
    const cells = [];
    for (let i = 0; i < 7; i++) cells.push(h('span', { class: 'dow', text: fmtDow.format(addDays(sat, i)) }));
    for (let i = 0; i < lead; i++) cells.push(h('span'));

    let monthSum = 0, active = 0, best = 0, bestKey = null;
    for (let d = 1; d <= dim; d++) {
      const key = `${logY}-${pad(logM + 1)}-${pad(d)}`;
      const total = dayTotal(key);
      const future = key > todayKey;
      if (total) { monthSum += total; active++; if (total > best) { best = total; bestKey = key; } }
      const r = dayProgress(key).ratio;
      const lv = !total ? 0 : r < 0.25 ? 1 : r < 0.5 ? 2 : r < 1 ? 3 : 4;
      cells.push(h('button', {
        type: 'button',
        class: `day lv${lv}${key === todayKey ? ' today' : ''}${key === logSel ? ' sel' : ''}`,
        disabled: future,
        'aria-label': `${fmtFull.format(parseKey(key))}: ${total}`,
        onclick: () => { logSel = key; renderLog(); }
      }, String(d)));
    }
    $('#cal').replaceChildren(...cells);

    const detail = $('#dayDetail');
    const selTotal = logSel ? dayTotal(logSel) : 0;
    const parts = [h('h3', { class: 'detail-title', text: logSel ? fmtFull.format(parseKey(logSel)) : 'اختر يومًا' })];
    if (!selTotal) {
      parts.push(h('p', { class: 'muted', style: 'margin:4px 0 0', text: 'لا يوجد تسبيح مسجّل في هذا اليوم.' }));
    } else {
      parts.push(h('div', { class: 'detail-total', text: fmt(selTotal) }));
      const entries = Object.entries(state.log[logSel]).sort((a, b) => b[1] - a[1]);
      parts.push(h('ul', { class: 'list' }, entries.map(([id, n]) =>
        h('li', {}, h('span', { class: 'nm', text: nameOf(id) }), h('span', { class: 'ct', text: fmt(n) })))));
    }
    detail.replaceChildren(...parts);

    const tile = (k, v) => h('div', { class: 'tile' }, h('div', { class: 'k', text: k }), h('div', { class: 'v', text: v }));
    const grand = tile('إجمالي الأذكار منذ بدء الاستخدام', fmtShort(allTotal()));
    grand.classList.add('grand');
    $('#logTiles').replaceChildren(
      tile('إجمالي الشهر', fmt(monthSum)),
      tile('أيام نشطة', `${active} / ${dim}`),
      tile('أفضل يوم', best ? `${fmt(best)} (${Number(bestKey.slice(8))})` : '—'),
      tile('أطول تتابع', `${bestStreak()} ${bestStreak() === 1 ? 'يوم' : 'أيام'}`),
      grand
    );
  }

  $('#monthPrev').addEventListener('click', () => {
    logM--; if (logM < 0) { logM = 11; logY--; }
    logSel = null; renderLog();
  });
  $('#monthNext').addEventListener('click', () => {
    logM++; if (logM > 11) { logM = 0; logY++; }
    logSel = null; renderLog();
  });

  /* ===================== التنقل بين الشاشات ===================== */
  let view = 'counter';
  function showView(v) {
    view = v;
    $$('.view').forEach((s) => { s.hidden = s.id !== `view-${v}`; });
    $$('.tab').forEach((b) => {
      const on = b.dataset.view === v;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (v === 'counter') renderCounter();
    if (v === 'plans') renderPlans();
    if (v === 'log') renderLog();
    $('#main').scrollTop = 0;
  }
  $$('.tab').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));

  /* ===================== الإعدادات ===================== */
  function applyTheme() {
    const t = state.settings.theme;
    document.documentElement.dataset.theme = t;
    const m = $('meta[name="theme-color"]');
    if (m) m.setAttribute('content', THEMES[t]);
  }

  function syncSettingsUI() {
    const s = state.settings;
    $('#setSound').checked = s.sound;
    $('#setVibrate').checked = s.vibrate;
    $('#setAuto').checked = s.auto;
    $('#setWake').checked = s.wake;
    $$('input[name="theme"]').forEach((r) => { r.checked = r.value === s.theme; });
    const canVibrate = typeof navigator.vibrate === 'function';
    $('#setVibrate').disabled = !canVibrate;
    $('#vibNote').hidden = canVibrate;
    $('#setWake').disabled = !('wakeLock' in navigator);
  }

  [['setSound', 'sound'], ['setVibrate', 'vibrate'], ['setAuto', 'auto'], ['setWake', 'wake']].forEach(([id, key]) => {
    $('#' + id).addEventListener('change', (e) => {
      state.settings[key] = e.target.checked;
      if (key === 'sound' && e.target.checked) beep(700, 0.05, 0.12, 'triangle');
      if (key === 'vibrate' && e.target.checked) vib(20);
      if (key === 'wake') updateWake();
      save();
    });
  });
  $$('input[name="theme"]').forEach((r) => r.addEventListener('change', (e) => {
    state.settings.theme = e.target.value;
    applyTheme();
    save();
  }));

  $('#btnSettings').addEventListener('click', () => { syncSettingsUI(); $('#dlgSettings').showModal(); });

  /* إبقاء الشاشة مضيئة */
  let wakeLock = null;
  async function updateWake() {
    try {
      const want = state.settings.wake && 'wakeLock' in navigator && document.visibilityState === 'visible';
      if (want && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!want && wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch (e) { wakeLock = null; }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      updateWake();
      showView(view);
    }
  });

  /* نسخ احتياطي */
  $('#btnExport').addEventListener('click', () => {
    flush();
    const blob = new Blob([JSON.stringify({ app: 'tasbih', exported: new Date().toISOString(), data: state }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: `tasbih-backup-${dayKey()}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('تم تصدير النسخة الاحتياطية');
  });

  $('#btnImport').addEventListener('click', () => $('#fileImport').click());
  $('#fileImport').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('الملف كبير جدًا'); return; }
    try {
      const raw = JSON.parse(await file.text());
      const data = raw && raw.data ? raw.data : raw;
      if (!data || !Array.isArray(data.adhkar)) throw new Error('bad');
      if (!(await confirmBox('سيتم استبدال بياناتك الحالية بمحتوى النسخة الاحتياطية. متابعة؟', 'استيراد'))) return;
      state = sanitize(data);
      flush();
      afterDataChange();
      toast('تم استيراد البيانات');
    } catch (err) {
      toast('ملف النسخة الاحتياطية غير صالح');
    }
  });

  $('#btnRestore').addEventListener('click', () => {
    const have = new Set(state.adhkar.map((a) => a.id));
    let n = 0;
    for (const d of DEFAULT_ADHKAR) {
      if (!have.has(d.id)) { state.adhkar.push({ ...d }); delete state.deleted[d.id]; n++; }
    }
    save();
    renderCounter();
    toast(n ? `تمت استعادة ${n} من الأذكار الافتراضية` : 'كل الأذكار الافتراضية موجودة');
  });

  $('#btnClear').addEventListener('click', async () => {
    if (!(await confirmBox('سيتم حذف كل الأذكار المضافة والسجل والإعدادات نهائيًا. هل أنت متأكد؟', 'مسح الكل', true))) return;
    state = defaultState();
    flush();
    afterDataChange();
    toast('تم مسح البيانات');
  });

  function afterDataChange() {
    applyTheme();
    syncSettingsUI();
    logY = logM = logSel = null;
    shownId = null;
    renderCounter();
    showView(view);
    updateWake();
  }

  /* ===================== PWA: تثبيت + العمل بدون إنترنت ===================== */
  let installEvt = null;
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvt = e;
    $('#installCard').hidden = false;
  });
  addEventListener('appinstalled', () => { installEvt = null; $('#installCard').hidden = true; });
  $('#btnInstall').addEventListener('click', async () => {
    if (!installEvt) return;
    installEvt.prompt();
    try { await installEvt.userChoice; } catch (e) { /* ignore */ }
    installEvt = null;
    $('#installCard').hidden = true;
  });

  const offlineEl = $('#offlineStatus');
  const setOffline = (ok) => {
    offlineEl.textContent = ok ? 'يعمل بدون إنترنت ✓' : 'جارٍ تجهيز العمل بدون إنترنت…';
  };
  if ('serviceWorker' in navigator) {
    setOffline(false);
    addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        offlineEl.textContent = 'تعذّر تفعيل العمل بدون إنترنت (يتطلب HTTPS أو localhost).';
      });
      navigator.serviceWorker.ready.then(() => setOffline(true));
    });
  } else {
    offlineEl.textContent = 'هذا المتصفح لا يدعم العمل بدون إنترنت.';
  }

  /* ===================== البدء ===================== */
  applyTheme();
  syncSettingsUI();
  showView('counter');
  updateWake();
})();