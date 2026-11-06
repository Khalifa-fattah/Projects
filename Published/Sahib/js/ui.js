/*
 * ui.js — مكوّنات واجهة مشتركة: الإشعارات، نافذة الاختيار/التأكيد، الوضع الليلي.
 */
(function (g) {
  'use strict';
  const NS = (g.Sahib = g.Sahib || {});
  const { Utils, Storage } = NS;
  const $ = (id) => document.getElementById(id);

  // ---------- الإشعار المؤقت ----------
  // الأيقونة النصية (✓ / ⚠) تضمن ألا تعتمد الرسالة على اللون وحده.
  let toastTimer = null;
  function toast(message, kind) {
    const t = $('toast');
    const isError = kind === 'error';
    t.textContent = `${isError ? '⚠ ' : kind === 'success' ? '✓ ' : ''}${message}`;
    t.classList.toggle('error', isError);
    t.classList.add('show');
    clearTimeout(toastTimer); // إلغاء المؤقت السابق عند استبدال الإشعار
    toastTimer = setTimeout(() => t.classList.remove('show'), isError ? 4000 : 2000);
  }

  // ---------- نافذة الاختيار ----------
  // choice(message, actions) تعيد Promise بقيمة الإجراء المختار، أو null عند الإلغاء (Esc أو الخلفية).
  // actions: [{ label, value, kind: 'primary' | 'danger' | 'ghost', focus: true, validate?: () => boolean }]
  //   validate: إن أعادت false تبقى النافذة مفتوحة (للنماذج داخل النافذة).
  // options: { icon, content: عقدة DOM تُعرض تحت الرسالة (نموذج مثلًا), focus: عنصر يأخذ التركيز }
  let resolveCurrent = null;
  let lastFocus = null;

  function choiceOpen() {
    return $('choiceModal').classList.contains('active');
  }
  function sheetOpen() {
    return $('selectSheet').classList.contains('active');
  }
  // أي نافذة فوق الشاشة (رسالة أو قائمة اختيار): تمنع الشاشات الأخرى من التقاط Esc.
  function isModalOpen() {
    return choiceOpen() || sheetOpen();
  }

  function closeModal(value) {
    if (!resolveCurrent) return;
    const resolve = resolveCurrent;
    resolveCurrent = null;
    $('choiceModal').classList.remove('active');
    $('choiceContent').replaceChildren();
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    lastFocus = null;
    resolve(value);
  }

  function choice(message, actions, options) {
    if (resolveCurrent) closeModal(null); // لا نترك نافذة سابقة معلّقة
    const modal = $('choiceModal');
    $('choiceIcon').textContent = (options && options.icon) || '﴾ ! ﴿';
    $('choiceMsg').textContent = message;
    const content = $('choiceContent');
    content.replaceChildren();
    if (options && options.content) content.append(options.content);
    const box = $('choiceActions');
    box.replaceChildren();
    let focusBtn = null;
    actions.forEach((a, i) => {
      const btn = Utils.el('button', {
        type: 'button',
        class: `btn ${a.kind === 'danger' ? 'btn-danger' : a.kind === 'primary' ? 'btn-primary' : 'btn-ghost'}`,
        text: a.label,
        onClick: () => { if (a.validate && !a.validate()) return; closeModal(a.value); }
      });
      box.append(btn);
      if (a.focus || (!focusBtn && i === 0)) focusBtn = btn;
    });
    lastFocus = document.activeElement;
    modal.classList.add('active');
    return new Promise((resolve) => {
      resolveCurrent = resolve;
      const target = options && options.focus;
      if (target && typeof target.focus === 'function') target.focus();
      else if (focusBtn) focusBtn.focus();
    });
  }

  // يغلق نافذة الرسالة الحالية إن كانت مفتوحة (تُحلّ وعدها بـ null).
  function dismiss() { if (choiceOpen()) closeModal(null); }

  // تأكيد بسيط (إلغاء / تأكيد). النقر على "إلغاء" أو Esc يعيد false.
  async function confirm(message, okLabel) {
    const v = await choice(
      message,
      [
        { label: 'إلغاء', value: false, kind: 'ghost', focus: true },
        { label: okLabel || 'حذف', value: true, kind: 'danger' }
      ]
    );
    return v === true;
  }

  function initModal() {
    const modal = $('choiceModal');
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(null);
    });
    initSheet();
    document.addEventListener('keydown', (e) => {
      if (!choiceOpen() || sheetOpen()) return; // القائمة المنسدلة فوق النافذة تلتقط مفاتيحها بنفسها
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        closeModal(null);
      } else if (e.key === 'Tab') {
        // حبس التركيز داخل النافذة (الأزرار وحقول النموذج)
        const btns = Array.from($('choiceModal').querySelectorAll('button, input, select, textarea, [tabindex="0"]'))
          .filter((n) => !n.disabled && !n.hidden && n.getAttribute('aria-hidden') !== 'true' && n.tabIndex >= 0);
        if (btns.length === 0) return;
        const first = btns[0], last = btns[btns.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }, true);
  }


  // ---------- قائمة الاختيار المخصصة (بدل قائمة النظام) ----------
  // enhanceSelect(select): يُبقي <select> الأصلي مخفيًا (مصدر القيمة وحدث change) ويضيف زرًا بتصميم التطبيق
  // يفتح ورقة سفلية بخيارات قابلة للبحث (للقوائم الطويلة). تعيين select.value برمجيًا يحدّث الزر تلقائيًا.
  const enhancedSelects = new WeakMap();
  const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  let sheetState = null; // { select, trigger, items, visible }
  const SEARCH_MIN_OPTIONS = 12;

  function enhanceSelect(select, opts) {
    if (!select) return null;
    if (enhancedSelects.has(select)) return enhancedSelects.get(select);
    const options = opts || {};
    const label = select.id ? document.querySelector(`label[for="${select.id}"]`) : null;
    const title = options.title || (label && label.textContent.trim()) || 'اختر';

    const valueText = Utils.el('span', { class: 'select-value' });
    const trigger = Utils.el('button', {
      type: 'button', class: 'select-trigger', 'aria-haspopup': 'listbox', 'aria-expanded': 'false',
      id: select.id ? `${select.id}Btn` : null
    }, valueText, Utils.el('span', { class: 'select-chevron', 'aria-hidden': 'true', text: '▾' }));

    function refresh() {
      const opt = select.options[select.selectedIndex];
      const text = opt ? opt.textContent : '—';
      valueText.textContent = text;
      trigger.setAttribute('aria-label', `${title}: ${text}`);
      trigger.disabled = select.disabled;
    }
    select.classList.add('native-hidden');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    select.after(trigger);
    Object.defineProperty(select, 'value', {
      configurable: true,
      get() { return valueDescriptor.get.call(this); },
      set(v) { valueDescriptor.set.call(this, v); refresh(); }
    });
    select.addEventListener('change', refresh);
    trigger.addEventListener('click', () => openSheet(select, trigger, title));
    if (label) label.addEventListener('click', (e) => { e.preventDefault(); trigger.click(); });
    refresh();
    const api = { refresh, trigger };
    enhancedSelects.set(select, api);
    return api;
  }

  function sheetOptionNodes() {
    return Array.from($('sheetList').querySelectorAll('[role="option"]'));
  }

  function openSheet(select, trigger, title) {
    const items = Array.from(select.options).filter((o) => !o.disabled);
    sheetState = { select, trigger };
    $('sheetTitle').textContent = title;
    const search = $('sheetSearch');
    search.value = '';
    search.hidden = items.length <= SEARCH_MIN_OPTIONS;
    const list = $('sheetList');
    list.replaceChildren(...items.map((o) => {
      const selected = o.value === select.value;
      return Utils.el('button', {
        type: 'button', class: `sheet-option${selected ? ' selected' : ''}`, role: 'option',
        'aria-selected': selected ? 'true' : 'false', 'data-value': o.value
      }, Utils.el('span', { class: 'sheet-option-text', text: o.textContent }),
         Utils.el('span', { class: 'sheet-check', 'aria-hidden': 'true', text: selected ? '✓' : '' }));
    }));
    $('sheetEmpty').hidden = true;
    lastSheetFocus = document.activeElement;
    $('selectSheet').classList.add('active');
    trigger.setAttribute('aria-expanded', 'true');
    const current = list.querySelector('.selected') || list.querySelector('[role="option"]');
    if (current) {
      current.focus({ preventScroll: true });
      current.scrollIntoView({ block: 'center' });
    }
  }
  let lastSheetFocus = null;

  function closeSheet() {
    if (!sheetState) return;
    const { trigger } = sheetState;
    sheetState = null;
    $('selectSheet').classList.remove('active');
    trigger.setAttribute('aria-expanded', 'false');
    const back = lastSheetFocus && document.contains(lastSheetFocus) ? lastSheetFocus : trigger;
    lastSheetFocus = null;
    if (back && typeof back.focus === 'function') back.focus();
  }

  function chooseSheetValue(value) {
    if (!sheetState) return;
    const { select } = sheetState;
    const changed = select.value !== value;
    if (changed) {
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    closeSheet();
  }

  function filterSheet() {
    const norm = NS.Memorization ? NS.Memorization.normalizeArabic : (x) => String(x).toLowerCase();
    const q = norm($('sheetSearch').value.trim());
    let shown = 0;
    sheetOptionNodes().forEach((n) => {
      const match = !q || norm(n.textContent).includes(q);
      n.hidden = !match;
      if (match) shown++;
    });
    $('sheetEmpty').hidden = shown > 0;
  }

  function initSheet() {
    const sheet = $('selectSheet');
    sheet.addEventListener('click', (e) => {
      if (e.target === sheet) { closeSheet(); return; }
      const opt = e.target.closest && e.target.closest('[role="option"]');
      if (opt) chooseSheetValue(opt.dataset.value);
    });
    $('sheetSearch').addEventListener('input', filterSheet);
    document.addEventListener('keydown', (e) => {
      if (!sheetOpen()) return;
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        closeSheet();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const nodes = sheetOptionNodes().filter((n) => !n.hidden);
        if (!nodes.length) return;
        const i = nodes.indexOf(document.activeElement);
        const next = e.key === 'ArrowDown' ? (i + 1) % nodes.length : (i <= 0 ? nodes.length - 1 : i - 1);
        nodes[next].focus();
      } else if (e.key === 'Tab') {
        const f = [$('sheetSearch'), ...sheetOptionNodes()].filter((n) => !n.hidden);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }, true);
  }

  // ---------- الوضع الليلي ----------
  const MOON_ICON = '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>';
  const SUN_ICON = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';

  function applyTheme(isDark, persist) {
    document.body.classList.toggle('dark-theme', isDark);
    $('themeIcon').innerHTML = isDark ? SUN_ICON : MOON_ICON; // ثوابت داخلية فقط، لا بيانات مستخدم
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#141F1C' : '#1F3D3A');
    if (persist) Storage.setTheme(isDark ? 'dark' : 'light');
  }

  function initTheme() {
    applyTheme(Storage.getTheme() === 'dark', false);
    $('themeToggleBtn').addEventListener('click', () => {
      applyTheme(!document.body.classList.contains('dark-theme'), true);
    });
  }

  NS.UI = { toast, choice, confirm, dismiss, isModalOpen, initModal, initTheme, applyTheme, enhanceSelect };
})(globalThis);
