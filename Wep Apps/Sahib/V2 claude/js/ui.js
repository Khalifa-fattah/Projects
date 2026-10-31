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
  // actions: [{ label, value, kind: 'primary' | 'danger' | 'ghost', focus: true }]
  let resolveCurrent = null;
  let lastFocus = null;

  function isModalOpen() {
    return $('choiceModal').classList.contains('active');
  }

  function closeModal(value) {
    if (!resolveCurrent) return;
    const resolve = resolveCurrent;
    resolveCurrent = null;
    $('choiceModal').classList.remove('active');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    lastFocus = null;
    resolve(value);
  }

  function choice(message, actions, options) {
    if (resolveCurrent) closeModal(null); // لا نترك نافذة سابقة معلّقة
    const modal = $('choiceModal');
    $('choiceIcon').textContent = (options && options.icon) || '﴾ ! ﴿';
    $('choiceMsg').textContent = message;
    const box = $('choiceActions');
    box.replaceChildren();
    let focusBtn = null;
    actions.forEach((a, i) => {
      const btn = Utils.el('button', {
        type: 'button',
        class: `btn ${a.kind === 'danger' ? 'btn-danger' : a.kind === 'primary' ? 'btn-primary' : 'btn-ghost'}`,
        text: a.label,
        onClick: () => closeModal(a.value)
      });
      box.append(btn);
      if (a.focus || (!focusBtn && i === 0)) focusBtn = btn;
    });
    lastFocus = document.activeElement;
    modal.classList.add('active');
    return new Promise((resolve) => {
      resolveCurrent = resolve;
      if (focusBtn) focusBtn.focus();
    });
  }

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
    document.addEventListener('keydown', (e) => {
      if (!isModalOpen()) return;
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        closeModal(null);
      } else if (e.key === 'Tab') {
        // حبس التركيز داخل النافذة
        const btns = Array.from($('choiceActions').querySelectorAll('button'));
        if (btns.length === 0) return;
        const first = btns[0], last = btns[btns.length - 1];
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

  NS.UI = { toast, choice, confirm, isModalOpen, initModal, initTheme, applyTheme };
})(globalThis);
