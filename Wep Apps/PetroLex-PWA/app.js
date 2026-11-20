'use strict';

/* =========================================================
   PetroLex — app.js
   ========================================================= */

const APP_VERSION = '3.0.0';
const BASE_SPECIALTIES = (window.PETRO_DATA && window.PETRO_DATA.specialties) || [];
const BASE_ITEMS = (window.PETRO_DATA && window.PETRO_DATA.items) || [];
const MAX_BASE_ID = BASE_ITEMS.reduce((m, i) => Math.max(m, i.id), 0);
const CUSTOM_ID_START = 1000000;
const NEW_SPEC = '__new__';

const KEYS = {
  progress: 'petro_progress',
  goal: 'petro_goal',
  streak: 'petro_streak',
  lastDay: 'petro_last_day',
  theme: 'petro_theme',
  customItems: 'petro_custom_items',
  customSpecs: 'petro_custom_specs',
  overrides: 'petro_overrides',
  hidden: 'petro_hidden',
  activity: 'petro_activity',
  quizLen: 'petro_quiz_len',
  nextId: 'petro_next_id'
};

const ICONS = {
  edit: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  del: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/></svg>'
};

const $ = (id) => document.getElementById(id);

/* ---------- DOM / text helpers ---------- */
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
  }
  const add = (c) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  children.forEach(add);
  return node;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Normalizes Arabic/English text for forgiving search & duplicate detection
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

function highlight(text, q) {
  const s = String(text || '');
  if (!q) return esc(s);
  const i = s.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(s);
  return esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + q.length)) + '</mark>' + esc(s.slice(i + q.length));
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/* ---------- Safe storage ---------- */
let storageWarned = false;
function warnStorage() {
  if (storageWarned) return;
  storageWarned = true;
  showToast('تعذّر حفظ البيانات في هذا المتصفح، لن يُحفظ تقدمك بعد إغلاق التطبيق.', { duration: 6000 });
}
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const v = JSON.parse(raw);
    return v === null || v === undefined ? fallback : v;
  } catch (e) {
    return fallback;
  }
}
function writeJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { warnStorage(); return false; }
}
function readRaw(key, fallback = '') {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; }
}
function writeRaw(key, val) {
  try { localStorage.setItem(key, String(val)); return true; } catch (e) { warnStorage(); return false; }
}
function removeKey(key) {
  try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
}

/* ---------- Dates (local time, not UTC) ---------- */
function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

/* =========================================================
   State
   ========================================================= */
function asObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}
function asArray(v) {
  return Array.isArray(v) ? v : [];
}

const state = {
  customSpecs: asArray(readJSON(KEYS.customSpecs, [])).filter(s => s && typeof s.id === 'string' && typeof s.nameAr === 'string'),
  customItems: asArray(readJSON(KEYS.customItems, [])).filter(i => i && Number.isFinite(i.id) && typeof i.term === 'string' && typeof i.meaning === 'string'),
  overrides: asObject(readJSON(KEYS.overrides, {})),
  hidden: asArray(readJSON(KEYS.hidden, [])).filter(Number.isFinite),
  progress: asObject(readJSON(KEYS.progress, {})),
  activity: asObject(readJSON(KEYS.activity, {})),
  dailyGoal: clamp(Math.round(Number(readRaw(KEYS.goal)) || 15), 5, 100),
  quizLen: [5, 10, 15, 20].includes(Number(readRaw(KEYS.quizLen))) ? Number(readRaw(KEYS.quizLen)) : 10,
  streak: Number(readRaw(KEYS.streak)) || 0,
  lastActiveDay: readRaw(KEYS.lastDay, ''),
  specs: [],
  items: [],
  itemById: new Map(),
  studySpec: 'all',
  studyMode: 'normal',
  quizSpec: 'all',
  quizScope: 'studied',
  quizMode: 'en2ar',
  dictSpec: 'all',
  dictQuery: '',
  dictLimit: 50
};

let dailyBatch = [];
let currentIndex = 0;
let batchResults = [];
let quizState = { questions: [], index: 0, score: 0, mode: 'en2ar', wrong: [], answered: false };
let quizTimer = null;
let currentTab = 'dashboard';

/* ---------- Custom ids (never collide with data.js) ---------- */
let idCounter = Math.max(
  CUSTOM_ID_START,
  MAX_BASE_ID,
  Number(readRaw(KEYS.nextId)) || 0,
  ...state.customItems.map(i => i.id)
);
function allocId() {
  idCounter += 1;
  writeRaw(KEYS.nextId, idCounter);
  return idCounter;
}

function migrateCustomIds() {
  // Older versions assigned ids = max+1 which can collide with future data.js entries.
  const seen = new Set();
  let changed = false;
  state.customItems.forEach((item) => {
    if (item.id <= MAX_BASE_ID || seen.has(item.id)) {
      item.id = allocId();
      changed = true;
    }
    seen.add(item.id);
  });
  if (changed) writeJSON(KEYS.customItems, state.customItems);
}

function persistCustom() {
  writeJSON(KEYS.customItems, state.customItems);
  writeJSON(KEYS.customSpecs, state.customSpecs);
  writeJSON(KEYS.overrides, state.overrides);
  writeJSON(KEYS.hidden, state.hidden);
}

function saveProgress() {
  writeJSON(KEYS.progress, state.progress);
}

function rebuild() {
  state.specs = [...BASE_SPECIALTIES, ...state.customSpecs.map(s => ({ ...s, custom: true }))];
  const specIds = new Set(state.specs.map(s => s.id));
  const hidden = new Set(state.hidden);

  const base = BASE_ITEMS.filter(i => !hidden.has(i.id)).map((i) => {
    const o = state.overrides[i.id];
    if (!o) return i;
    const specId = o.specId && specIds.has(o.specId) ? o.specId : i.specId;
    return { ...i, ...o, specId, edited: true };
  });
  const custom = state.customItems
    .filter(i => specIds.has(i.specId))
    .map(i => ({ ...i, abbr: i.abbr || '', section: i.section || 'عام', custom: true }));

  state.items = [...base, ...custom];
  state.itemById = new Map(state.items.map(i => [i.id, i]));

  ['studySpec', 'quizSpec', 'dictSpec'].forEach((k) => {
    if (state[k] !== 'all' && !specIds.has(state[k])) state[k] = 'all';
  });
}

function specById(id) {
  return state.specs.find(s => s.id === id);
}

/* =========================================================
   Toasts & modals
   ========================================================= */
function showToast(message, opts = {}) {
  const host = $('toastHost');
  if (!host) return null;
  const { duration = 3200, action = null, dismissible = false } = opts;
  if (duration > 0) host.querySelectorAll('.toast:not(.persistent)').forEach(t => t.remove()); // one transient toast at a time
  const toast = el('div', { class: 'toast' + (duration > 0 ? '' : ' persistent') }, el('span', { class: 'toast-text' }, message));
  if (action) {
    toast.appendChild(el('button', {
      type: 'button', class: 'toast-action',
      onclick: () => { toast.remove(); action.onClick(); }
    }, action.label));
  }
  if (dismissible) {
    toast.appendChild(el('button', {
      type: 'button', class: 'toast-close', 'aria-label': 'إغلاق',
      onclick: () => toast.remove()
    }, '×'));
  }
  host.appendChild(toast);
  if (duration > 0) setTimeout(() => toast.remove(), duration);
  return toast;
}

function openModal({ title, body, actions = [], onClose = null }) {
  const previousFocus = document.activeElement;
  const titleId = 'modalTitle' + Date.now();
  const actionsEl = el('div', { class: 'modal-actions' });
  const modal = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    el('h3', { class: 'modal-title', id: titleId }, title),
    el('div', { class: 'modal-body' }, body),
    actionsEl);
  const backdrop = el('div', { class: 'modal-backdrop' }, modal);
  let closed = false;

  function focusables() {
    return Array.from(modal.querySelectorAll('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])'))
      .filter(n => !n.disabled && n.offsetParent !== null);
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables();
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function close() {
    if (closed) return;
    closed = true;
    backdrop.remove();
    document.removeEventListener('keydown', onKey, true);
    if (!document.querySelector('.modal-backdrop')) document.body.classList.remove('modal-open');
    if (previousFocus && previousFocus.focus) previousFocus.focus();
    if (onClose) onClose();
  }

  actions.forEach((a) => {
    const cls = a.kind === 'green' ? 'btn-green' : a.kind === 'danger' ? 'btn-danger' : 'btn-ghost';
    const btn = el('button', { type: 'button', class: cls }, a.label);
    btn.addEventListener('click', async () => {
      const r = a.onClick ? await a.onClick() : undefined;
      if (r !== false) close();
    });
    actionsEl.appendChild(btn);
  });

  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.classList.add('modal-open');
  document.body.appendChild(backdrop);

  const firstField = modal.querySelector('input:not([type="hidden"]), select, textarea');
  (firstField || focusables()[0] || modal).focus();
  return { close, modal };
}

function confirmModal({ title, message, confirmLabel = 'تأكيد', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    openModal({
      title,
      body: el('p', { class: 'modal-text' }, message),
      actions: [
        { label: confirmLabel, kind: danger ? 'danger' : 'green', onClick: () => { result = true; } },
        { label: 'إلغاء' }
      ],
      onClose: () => resolve(result)
    });
  });
}

function field(labelText, input, hint) {
  const id = input.id || ('f' + Math.random().toString(36).slice(2, 8));
  input.id = id;
  return el('div', { class: 'form-field' },
    el('label', { for: id }, labelText),
    input,
    hint ? el('div', { class: 'form-hint' }, hint) : null);
}

/* =========================================================
   Custom dropdown (accessible)
   ========================================================= */
function closeAllDropdowns() {
  document.querySelectorAll('.custom-select-menu').forEach(m => m.classList.add('hidden'));
  document.querySelectorAll('.custom-select-btn').forEach((b) => {
    b.classList.remove('open');
    b.setAttribute('aria-expanded', 'false');
  });
}

function createCustomDropdown(containerId, options, selectedValue, onChange, ariaLabel) {
  const container = $(containerId);
  if (!container) return;
  const current = options.find(o => o.value === selectedValue) || options[0];
  container.textContent = '';

  const btn = el('button', {
    type: 'button', class: 'custom-select-btn', 'aria-haspopup': 'listbox', 'aria-expanded': 'false',
    'aria-label': ariaLabel ? `${ariaLabel}: ${current ? current.label : ''}` : null
  }, el('span', null, current ? current.label : ''), el('span', { class: 'chevron', 'aria-hidden': 'true' }, '▼'));

  const menu = el('div', { class: 'custom-select-menu hidden', role: 'listbox', 'aria-label': ariaLabel || null },
    options.map((opt) => {
      const sel = opt.value === (current && current.value);
      return el('div', {
        class: 'custom-select-option' + (sel ? ' selected' : ''), role: 'option',
        'aria-selected': String(sel), 'data-val': opt.value, tabindex: '-1'
      }, el('span', null, opt.label), opt.badge ? el('span', { class: 'opt-badge' }, opt.badge) : null);
    }));

  const wrap = el('div', { class: 'custom-select-wrap' }, btn, menu);
  container.appendChild(wrap);

  function openMenu() {
    closeAllDropdowns();
    menu.classList.remove('hidden', 'up');
    btn.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    const rect = menu.getBoundingClientRect();
    if (rect.bottom > window.innerHeight - 76 && btn.getBoundingClientRect().top > rect.height + 20) menu.classList.add('up');
    const target = menu.querySelector('.selected') || menu.firstElementChild;
    if (target) { target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'nearest' }); }
  }
  function choose(val) {
    closeAllDropdowns();
    onChange(val);
    createCustomDropdown(containerId, options, val, onChange, ariaLabel);
    const nb = container.querySelector('.custom-select-btn');
    if (nb) nb.focus();
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.classList.contains('hidden')) openMenu(); else closeAllDropdowns();
  });
  btn.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openMenu(); }
  });
  menu.addEventListener('click', (e) => {
    e.stopPropagation();
    const opt = e.target.closest('.custom-select-option');
    if (opt) choose(opt.dataset.val);
  });
  menu.addEventListener('keydown', (e) => {
    const items = Array.from(menu.querySelectorAll('.custom-select-option'));
    const idx = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(items.length - 1, idx + 1)].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[Math.max(0, idx - 1)].focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (idx >= 0) choose(items[idx].dataset.val); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeAllDropdowns(); btn.focus(); }
    else if (e.key === 'Tab') { closeAllDropdowns(); }
  });
}

document.addEventListener('click', closeAllDropdowns);

function specOptions() {
  return [
    { value: 'all', label: 'كل التخصصات', badge: String(state.items.length) },
    ...state.specs.map(s => ({ value: s.id, label: s.nameAr, badge: String(state.items.filter(i => i.specId === s.id).length) }))
  ];
}

function initDropdowns() {
  const specOpts = specOptions();

  createCustomDropdown('studySpecDropdown', specOpts, state.studySpec, (val) => {
    state.studySpec = val;
    loadDailyBatch();
  }, 'التخصص');

  createCustomDropdown('studyModeDropdown', [
    { value: 'normal', label: 'جلسة عادية (جديد + مستحق)' },
    { value: 'due', label: 'المراجعة المستحقة فقط' },
    { value: 'weak', label: 'المصطلحات المتعثرة فقط' }
  ], state.studyMode, (val) => {
    state.studyMode = val;
    loadDailyBatch();
  }, 'نوع الجلسة');

  createCustomDropdown('quizSpecDropdown', specOpts, state.quizSpec, (val) => { state.quizSpec = val; }, 'التخصص');

  createCustomDropdown('quizScopeDropdown', [
    { value: 'studied', label: 'المصطلحات المعروضة والقديمة' },
    { value: 'all', label: 'كل مصطلحات القاموس' }
  ], state.quizScope, (val) => { state.quizScope = val; }, 'نطاق الاختبار');

  createCustomDropdown('quizModeDropdown', [
    { value: 'en2ar', label: 'إنجليزي ← عربي' },
    { value: 'ar2en', label: 'عربي ← إنجليزي' }
  ], state.quizMode, (val) => { state.quizMode = val; }, 'نوع الاختبار');

  createCustomDropdown('dictSpecDropdown', specOpts, state.dictSpec, (val) => {
    state.dictSpec = val;
    renderDictionary();
  }, 'التخصص');
}

/* =========================================================
   Streak, activity, goal
   ========================================================= */
function updateStreak() {
  const today = dayKey();
  if (state.lastActiveDay === today) return;
  state.streak = state.lastActiveDay === yesterdayKey() ? state.streak + 1 : 1;
  state.lastActiveDay = today;
  writeRaw(KEYS.streak, state.streak);
  writeRaw(KEYS.lastDay, state.lastActiveDay);
}

function currentStreak() {
  if (!state.lastActiveDay) return 0;
  return state.lastActiveDay === dayKey() || state.lastActiveDay === yesterdayKey() ? state.streak : 0;
}

function recordActivity() {
  const today = dayKey();
  state.activity[today] = (state.activity[today] || 0) + 1;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  const cutKey = dayKey(cutoff);
  Object.keys(state.activity).forEach((k) => { if (k < cutKey) delete state.activity[k]; });
  writeJSON(KEYS.activity, state.activity);
}

function markActive() {
  updateStreak();
  recordActivity();
}

function setDailyGoal(value) {
  const v = clamp(Math.round(Number(value)) || state.dailyGoal, 5, 100);
  state.dailyGoal = v;
  writeRaw(KEYS.goal, v);
  const a = $('dailyGoalInput'), b = $('settingsGoal');
  if (a) a.value = v;
  if (b) b.value = v;
  return v;
}

/* =========================================================
   Markdown import
   ========================================================= */
function stripWiki(str) {
  return str
    .replace(/\[\[([^\]|]*?)\\?\|([^\]]*)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1');
}

function cleanCell(s) {
  return stripWiki(String(s || ''))
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/(\*\*|__|==|~~|`)/g, '')
    .replace(/\u0001/g, '|')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSeparatorRow(line) {
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim());
}

function splitRow(line) {
  // wiki links contain pipes ([[a\|b]]) — resolve them first, and protect escaped pipes
  const protectedLine = line
    .replace(/\[\[[^\]]*\]\]/g, m => stripWiki(m))
    .replace(/\\\|/g, '\u0001')
    .trim()
    .replace(/^\||\|$/g, '');
  return protectedLine.split('|').map(cleanCell);
}

function detectLayout(headerCols) {
  const layout = { term: -1, meaning: -1, abbr: -1 };
  headerCols.forEach((h, i) => {
    const t = norm(h);
    if (/اختصار|abbr|acronym|رمز/.test(t)) { if (layout.abbr < 0) layout.abbr = i; }
    else if (/معني|عرب|arabic|ترجم|meaning|translation/.test(t)) { if (layout.meaning < 0) layout.meaning = i; }
    else if (/مصطلح|term|english|انجليز|اسم|name|full|word|كلم/.test(t)) { if (layout.term < 0) layout.term = i; }
  });
  return layout.term >= 0 && layout.meaning >= 0 && layout.term !== layout.meaning ? layout : null;
}

function splitTermAbbr(term, abbr) {
  if (!abbr) {
    const m = term.match(/^(.*?)\s*\(([A-Z0-9&/.+\- ]{2,14})\)\s*$/);
    if (m && m[1].trim()) return { term: m[1].trim(), abbr: m[2].trim() };
  }
  return { term, abbr };
}

function parseMarkdown(rawText, fileName) {
  let text = String(rawText || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  // YAML frontmatter
  if (/^---\s*\n/.test(text)) {
    const end = text.indexOf('\n---', 3);
    if (end > 0) text = text.slice(text.indexOf('\n', end + 1) + 1);
  }
  const lines = text.split('\n');
  const isAbbrFile = fileName.includes('اختصار');
  let section = 'عام';
  let layout = null;
  const tableItems = [];
  const listItems = [];
  let skipped = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      if (heading[1].length >= 2) section = cleanCell(heading[2]) || section;
      continue;
    }

    if (line.startsWith('|')) {
      if (isSeparatorRow(line)) continue;
      const cols = splitRow(line);
      const next = (lines[i + 1] || '').trim();
      if (next && isSeparatorRow(next)) { layout = detectLayout(cols); continue; } // header row

      let term = '', abbr = '', meaning = '';
      if (layout) {
        term = cols[layout.term] || '';
        meaning = cols[layout.meaning] || '';
        abbr = layout.abbr >= 0 ? (cols[layout.abbr] || '') : '';
      } else if (isAbbrFile && cols.length >= 3) {
        meaning = cols[0]; term = cols[1] || cols[2]; abbr = cols[2];
      } else {
        term = cols[0] || ''; meaning = cols[1] || '';
      }
      ({ term, abbr } = splitTermAbbr(term, abbr));
      if (!term || !meaning || /^[-:\s]+$/.test(term)) { skipped++; continue; }
      tableItems.push({ term, abbr, meaning, section, type: (isAbbrFile || (layout && layout.abbr >= 0)) ? 'abbr' : 'term' });
      continue;
    }

    const bullet = line.match(/^(?:[-*+]|\d+[.)])\s+(.+)$/);
    if (bullet) {
      const body = cleanCell(bullet[1]);
      const m = body.match(/^(.+?)(?:\s+[—–-]\s+|\s*[:：]\s+|\s+=\s+)(.+)$/);
      if (m) {
        let term = m[1].trim(), meaning = m[2].trim(), abbr = '';
        ({ term, abbr } = splitTermAbbr(term, abbr));
        if (term && meaning && term.length <= 120) listItems.push({ term, abbr, meaning, section, type: 'term' });
      }
    }
  }

  const useTables = tableItems.length > 0;
  return { items: useTables ? tableItems : listItems, format: useTables ? 'جدول' : 'قائمة', skipped };
}

async function importMarkdownFiles(event) {
  const files = Array.from(event.target.files || []);
  event.target.value = '';
  if (!files.length) return;

  const plans = [];
  const empty = [];
  for (const file of files) {
    let text = '';
    try { text = await file.text(); } catch (e) { empty.push(file.name); continue; }
    const parsed = parseMarkdown(text, file.name);
    if (!parsed.items.length) { empty.push(file.name); continue; }
    plans.push({ fileName: file.name, ...parsed });
  }

  if (!plans.length) {
    showToast('لم يُعثر على مصطلحات صالحة في الملف. راجع صيغة الملفات المدعومة في الإعدادات.', { duration: 5000 });
    return;
  }
  if (empty.length) showToast(`تم تجاهل ملفات بلا مصطلحات: ${empty.join('، ')}`, { duration: 5000 });
  showImportModal(plans);
}

function guessSpecForFile(fileName) {
  const base = fileName.replace(/\.(md|markdown|txt)$/i, '');
  return state.specs.find((s) => {
    const f = (s.file || s.sourceFile || '').replace(/\.(md|markdown|txt)$/i, '');
    return f && (base === f || fileName.includes(f));
  });
}

function showImportModal(plans) {
  const ui = [];
  const body = el('div', { class: 'import-list' });

  plans.forEach((plan, idx) => {
    const guessed = guessSpecForFile(plan.fileName);
    const select = el('select', { 'aria-label': 'التخصص المستهدف' },
      el('option', { value: NEW_SPEC }, '+ تخصص جديد…'),
      state.specs.map(s => el('option', { value: s.id }, s.nameAr)));
    select.value = guessed ? guessed.id : NEW_SPEC;

    const nameAr = el('input', { type: 'text', placeholder: 'اسم التخصص الجديد بالعربية (مطلوب)', 'aria-label': 'اسم التخصص بالعربية', maxlength: '60' });
    const nameEn = el('input', { type: 'text', placeholder: 'الاسم بالإنجليزية (اختياري)', 'aria-label': 'اسم التخصص بالإنجليزية', dir: 'ltr', maxlength: '60' });
    const err = el('div', { class: 'form-error', role: 'alert' });
    const newBox = el('div', { class: 'new-spec-box' }, nameAr, nameEn);
    const syncNew = () => newBox.classList.toggle('hidden', select.value !== NEW_SPEC);
    select.addEventListener('change', syncNew);
    syncNew();

    const sample = plan.items.slice(0, 3).map(it =>
      el('li', null,
        el('span', { dir: 'auto', class: 'sample-term' }, it.term + (it.abbr ? ` (${it.abbr})` : '')),
        ' ← ',
        el('span', null, it.meaning)));

    body.appendChild(el('div', { class: 'import-card' },
      el('div', { class: 'import-file', dir: 'auto' }, plan.fileName),
      el('div', { class: 'import-meta' }, `${plan.items.length} مصطلح · صيغة ${plan.format}` + (plan.skipped ? ` · ${plan.skipped} سطر متجاهَل` : '')),
      el('ul', { class: 'import-sample' }, sample),
      el('label', { class: 'import-label', for: 'impSel' + idx }, 'إضافة إلى:'),
      Object.assign(select, { id: 'impSel' + idx }),
      newBox,
      err));
    ui.push({ select, nameAr, nameEn, err });
  });

  openModal({
    title: plans.length > 1 ? `استيراد ${plans.length} ملفات` : 'استيراد مصطلحات',
    body,
    actions: [
      {
        label: 'استيراد', kind: 'green', onClick: () => {
          let ok = true;
          ui.forEach((u) => {
            u.err.textContent = '';
            if (u.select.value === NEW_SPEC && !u.nameAr.value.trim()) {
              u.err.textContent = 'اكتب اسم التخصص الجديد أو اختر تخصصاً موجوداً.';
              if (ok) u.nameAr.focus();
              ok = false;
            }
          });
          if (!ok) return false;
          commitImport(plans.map((p, i) => ({
            plan: p,
            target: ui[i].select.value,
            nameAr: ui[i].nameAr.value.trim(),
            nameEn: ui[i].nameEn.value.trim()
          })));
          return true;
        }
      },
      { label: 'إلغاء' }
    ]
  });
}

function getOrCreateSpec(nameAr, nameEn, sourceFile) {
  const existing = state.specs.find(s => norm(s.nameAr) === norm(nameAr));
  if (existing) return existing.id;
  const spec = {
    id: 'cspec_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    nameAr, nameEn: nameEn || '', sourceFile: sourceFile.replace(/\.(md|markdown|txt)$/i, ''), icon: ''
  };
  state.customSpecs.push(spec);
  state.specs.push({ ...spec, custom: true });
  return spec.id;
}

function commitImport(entries) {
  let added = 0, dup = 0;
  const touched = new Set();
  const keys = new Set(state.items.map(i => `${i.specId}|${i.term.toLowerCase()}`));

  entries.forEach(({ plan, target, nameAr, nameEn }) => {
    const specId = target === NEW_SPEC ? getOrCreateSpec(nameAr, nameEn, plan.fileName) : target;
    touched.add(specId);
    plan.items.forEach((it) => {
      const key = `${specId}|${it.term.toLowerCase()}`;
      if (keys.has(key)) { dup++; return; }
      keys.add(key);
      state.customItems.push({ id: allocId(), specId, section: it.section, type: it.type, term: it.term, abbr: it.abbr, meaning: it.meaning });
      added++;
    });
  });

  persistCustom();
  rebuild();
  initDropdowns();
  renderAll();
  const names = Array.from(touched).map(id => (specById(id) || {}).nameAr).filter(Boolean).join('، ');
  showToast(`تم استيراد ${added} مصطلح` + (names ? ` إلى: ${names}` : '') + (dup ? ` (تخطي ${dup} مكرر)` : ''), { duration: 5000 });
}

/* =========================================================
   Dashboard
   ========================================================= */
function dueCount() {
  const now = Date.now();
  let n = 0;
  state.items.forEach((i) => {
    const p = state.progress[i.id];
    if (p && p.seenCount > 0 && p.nextReview <= now) n++;
  });
  return n;
}

function renderWeekChart() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    days.push({ label: d.toLocaleDateString('ar', { weekday: 'short' }), n: state.activity[key] || 0, today: i === 0 });
  }
  const max = Math.max(1, ...days.map(d => d.n));
  const total = days.reduce((s, d) => s + d.n, 0);
  $('weekChart').innerHTML = days.map(d => `
    <div class="week-col${d.today ? ' today' : ''}">
      <span class="week-n">${d.n || ''}</span>
      <div class="week-track"><div class="week-fill" style="height:${d.n ? Math.max(8, Math.round(d.n / max * 100)) : 0}%"></div></div>
      <span class="week-day">${esc(d.label)}</span>
    </div>`).join('');
  $('weekTotal').textContent = total ? `${total} إجابة` : 'لا نشاط بعد';
  $('weekChart').setAttribute('aria-label', `نشاط آخر 7 أيام: ${total} إجابة`);
}

function renderDashboard() {
  const total = state.items.length;
  const entries = Object.entries(state.progress).filter(([id]) => state.itemById.has(Number(id))).map(([, p]) => p);
  const seen = entries.filter(p => p.seenCount > 0).length;
  const mastered = entries.filter(p => p.level >= 2).length;

  $('statTotal').textContent = total;
  $('statSeen').textContent = seen;
  $('statMastered').textContent = mastered;
  $('statStreak').textContent = currentStreak();
  $('dailyGoalInput').value = state.dailyGoal;

  const due = dueCount();
  const banner = $('dueBanner');
  banner.classList.toggle('hidden', due === 0);
  banner.textContent = `لديك ${due} مصطلح مستحق للمراجعة الآن — ابدأ المراجعة ←`;

  renderWeekChart();

  $('specGrid').innerHTML = state.specs.map((spec) => {
    const specItems = state.items.filter(i => i.specId === spec.id);
    const specMastered = specItems.filter(i => (state.progress[i.id] && state.progress[i.id].level) >= 2).length;
    const specSeen = specItems.filter(i => (state.progress[i.id] && state.progress[i.id].seenCount) > 0).length;
    const pct = specItems.length ? Math.round((specMastered / specItems.length) * 100) : 0;
    return `
      <div class="spec-card" role="button" tabindex="0" data-spec="${esc(spec.id)}" aria-label="ادرس ${esc(spec.nameAr)}، متقن ${pct}%">
        <div class="spec-top">
          <span class="spec-title">${esc(spec.nameAr)}</span>
          <span class="spec-pct">${pct}%</span>
        </div>
        ${spec.nameEn ? `<div class="spec-en">${esc(spec.nameEn)}</div>` : ''}
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="spec-meta">
          <span>متقن: ${specMastered} | معروض: ${specSeen} / ${specItems.length}</span>
          <span class="spec-go">ادرس ←</span>
        </div>
      </div>`;
  }).join('');
}

function startDailyFromDashboard() {
  setDailyGoal($('dailyGoalInput').value);
  state.studyMode = 'normal';
  initDropdowns();
  loadDailyBatch();
  switchTab('study');
}

function openSpecStudy(specId) {
  state.studySpec = specId;
  state.studyMode = 'normal';
  initDropdowns();
  loadDailyBatch();
  switchTab('study');
}

function startDueReview() {
  state.studySpec = 'all';
  state.studyMode = 'due';
  initDropdowns();
  loadDailyBatch();
  switchTab('study');
}

/* =========================================================
   Study session
   ========================================================= */
function showStudyView(view) {
  $('studyCard').classList.toggle('hidden', view !== 'card');
  $('studyEmpty').classList.toggle('hidden', view !== 'empty');
  $('studySummary').classList.toggle('hidden', view !== 'summary');
}

function buildStudyPool() {
  const now = Date.now();
  // shuffle first: the sorts below are stable, so equal-priority terms stay in random order
  let pool = shuffle(state.studySpec === 'all' ? state.items : state.items.filter(i => i.specId === state.studySpec));
  const prog = (i) => state.progress[i.id] || { level: 0, seenCount: 0, nextReview: 0 };

  if (state.studyMode === 'due') {
    pool = pool.filter(i => prog(i).seenCount > 0 && prog(i).nextReview <= now);
    pool.sort((a, b) => prog(a).nextReview - prog(b).nextReview);
  } else if (state.studyMode === 'weak') {
    pool = pool.filter(i => prog(i).seenCount > 0 && prog(i).level <= 1);
    pool.sort((a, b) => prog(a).level - prog(b).level || prog(a).nextReview - prog(b).nextReview);
  } else {
    pool.sort((a, b) => {
      const pa = prog(a), pb = prog(b);
      const dueA = pa.nextReview <= now ? 0 : 1;
      const dueB = pb.nextReview <= now ? 0 : 1;
      if (dueA !== dueB) return dueA - dueB;
      return pa.level - pb.level;
    });
  }
  return pool;
}

function loadDailyBatch() {
  // priority decides WHICH terms are picked; the order they appear in is random
  dailyBatch = shuffle(buildStudyPool().slice(0, state.dailyGoal));
  currentIndex = 0;
  batchResults = [];

  if (!dailyBatch.length) {
    const msgs = {
      due: 'لا توجد مصطلحات مستحقة للمراجعة الآن. عد لاحقاً أو ابدأ جلسة عادية.',
      weak: 'لا توجد مصطلحات متعثرة حالياً. أحسنت!',
      normal: 'لا توجد مصطلحات في هذا التخصص.'
    };
    $('studyEmptyText').textContent = msgs[state.studyMode] || msgs.normal;
    $('studyEmptyBtn').classList.toggle('hidden', state.studyMode === 'normal');
    showStudyView('empty');
    return;
  }
  showStudyView('card');
  renderCard();
}

function renderCard() {
  const item = dailyBatch[currentIndex];
  const spec = specById(item.specId);

  // specialty name only: the section title often contains the answer (e.g. an abbreviation)
  $('cardSection').textContent = spec ? spec.nameAr : '';
  $('batchCounter').textContent = `${currentIndex + 1} / ${dailyBatch.length}`;
  $('cardTerm').textContent = item.term;

  const abbrEl = $('cardAbbr');
  if (item.abbr && item.abbr !== item.term) {
    abbrEl.textContent = `الاختصار: ${item.abbr}`;
    abbrEl.classList.remove('hidden');
  } else {
    abbrEl.classList.add('hidden');
  }

  $('cardMeaning').textContent = item.meaning;
  $('revealRow').classList.remove('hidden');
  $('answerSection').classList.add('hidden');
  $('prevCardBtn').disabled = currentIndex === 0;
  // keep keyboard flow natural: Space/Enter then reveals the next answer
  if (currentTab === 'study') $('revealBtn').focus({ preventScroll: true });
}

function revealMeaning() {
  $('revealRow').classList.add('hidden');
  $('answerSection').classList.remove('hidden');
}

function prevCard() {
  if ($('studyCard').classList.contains('hidden') || currentIndex === 0) return;
  currentIndex--;
  renderCard();
}

function rateCard(ratingIndex) {
  // 0: لم أتذكر, 1: بصعوبة, 2: تذكرت, 3: بسهولة
  const item = dailyBatch[currentIndex];
  if (!item) return;
  markActive();

  const slot = batchResults[currentIndex];
  if (slot) { // re-rating after going back: restore the original state first
    if (slot.prev) state.progress[item.id] = slot.prev; else delete state.progress[item.id];
  }
  const existing = state.progress[item.id];
  const snapshot = existing ? { ...existing } : null;
  const prev = existing || { level: 0, seenCount: 0, nextReview: 0 };
  const intervals = [10 * 60 * 1000, 12 * 3600 * 1000, 3 * 24 * 3600 * 1000, 7 * 24 * 3600 * 1000];

  let newLevel = 0;
  if (ratingIndex === 0) newLevel = 0;
  else if (ratingIndex === 1) newLevel = Math.max(1, prev.level);
  else if (ratingIndex === 2) newLevel = Math.min(3, prev.level + 1);
  else newLevel = 3;

  state.progress[item.id] = { level: newLevel, seenCount: prev.seenCount + 1, nextReview: Date.now() + intervals[newLevel] };
  batchResults[currentIndex] = { rating: ratingIndex, prev: snapshot };
  saveProgress();

  if (currentIndex + 1 < dailyBatch.length) {
    currentIndex++;
    renderCard();
  } else {
    showSummary();
  }
}

function showSummary() {
  const counts = [0, 0, 0, 0];
  const weak = [];
  batchResults.forEach((r, i) => {
    if (!r) return;
    counts[r.rating]++;
    if (r.rating <= 1) weak.push(dailyBatch[i]);
  });
  const labels = ['لم أتذكر', 'بصعوبة', 'تذكرت', 'بسهولة'];
  const done = counts.reduce((a, b) => a + b, 0);
  $('summaryTitle').textContent = `راجعت ${done} مصطلحاً`;
  $('summaryGrid').innerHTML = counts.map((c, i) => `
    <div class="summary-cell"><div class="num">${c}</div><div class="lbl">${labels[i]}</div></div>`).join('');
  $('summaryWeak').innerHTML = weak.length ? `
    <div class="weak-box">
      <div class="weak-title">تحتاج مراجعة (${weak.length})</div>
      <ul class="wrong-list">${weak.slice(0, 10).map(w => `<li><span dir="auto">${esc(w.term)}</span> — ${esc(w.meaning)}</li>`).join('')}</ul>
      ${weak.length > 10 ? `<div class="form-hint">و${weak.length - 10} أخرى…</div>` : ''}
    </div>` : '';
  showStudyView('summary');
  renderDashboard();
}

function speakCurrentTerm() {
  const item = dailyBatch[currentIndex];
  if (!item || !('speechSynthesis' in window)) return;
  const utter = new SpeechSynthesisUtterance(item.term);
  utter.lang = 'en-US';
  utter.rate = 0.92;
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

/* =========================================================
   Quiz
   ========================================================= */
function buildQuestion(q, mode) {
  const en2ar = mode === 'en2ar';
  const answer = en2ar ? q.meaning : q.term;
  const used = new Set([norm(answer)]);
  const others = state.items.filter(x => x.id !== q.id);
  // prefer distractors from the same specialty, then from the rest
  const ordered = [...shuffle(others.filter(x => x.specId === q.specId)), ...shuffle(others.filter(x => x.specId !== q.specId))];
  const distractors = [];
  for (const x of ordered) {
    if (!en2ar && x.meaning === q.meaning) continue; // another valid answer
    const txt = en2ar ? x.meaning : x.term;
    const k = norm(txt);
    if (used.has(k)) continue;
    used.add(k);
    distractors.push(txt);
    if (distractors.length === 3) break;
  }
  return { item: q, options: shuffle([...distractors, answer]), answer };
}

function startQuiz(retryItems) {
  clearTimeout(quizTimer);
  let pool;
  if (retryItems) {
    pool = retryItems.filter(i => state.itemById.has(i.id));
  } else {
    pool = state.quizSpec === 'all' ? [...state.items] : state.items.filter(i => i.specId === state.quizSpec);
    if (state.quizScope === 'studied') {
      const studied = pool.filter(i => (state.progress[i.id] && state.progress[i.id].seenCount) > 0);
      if (studied.length >= 4) pool = studied;
      else if (pool.length >= 4) showToast('المصطلحات المدروسة أقل من 4، لذلك شمل الاختبار كل مصطلحات التخصص.', { duration: 4000 });
    }
    if (pool.length < 4) {
      $('quizContainer').innerHTML = '<p class="muted-note">تحتاج إلى 4 مصطلحات على الأقل لبدء الاختبار.</p>';
      return;
    }
  }
  if (!pool.length) return;

  const selected = shuffle(pool).slice(0, Math.min(state.quizLen, pool.length));
  quizState = {
    index: 0, score: 0, mode: state.quizMode, wrong: [], answered: false,
    questions: selected.map(q => buildQuestion(q, state.quizMode))
  };
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const box = $('quizContainer');
  if (quizState.index >= quizState.questions.length) {
    const total = quizState.questions.length;
    const pct = Math.round((quizState.score / total) * 100);
    const wrongHtml = quizState.wrong.length ? `
      <div class="weak-box">
        <div class="weak-title">أخطاؤك (${quizState.wrong.length})</div>
        <ul class="wrong-list">${quizState.wrong.map(w => `<li><span dir="auto">${esc(w.term)}</span>${w.abbr ? ` (${esc(w.abbr)})` : ''} — ${esc(w.meaning)}</li>`).join('')}</ul>
      </div>` : '';
    box.innerHTML = `
      <div class="quiz-result">
        <div class="session-kicker">اكتمل الاختبار</div>
        <h2 class="result-score">${quizState.score} / ${total} (${pct}%)</h2>
        <p class="muted-note flush">تم تحديث مستوى الإتقان تلقائياً.</p>
        ${wrongHtml}
        <div class="summary-actions">
          <button type="button" class="btn-green" data-quiz-act="new">اختبار جديد</button>
          ${quizState.wrong.length ? '<button type="button" class="btn-ghost" data-quiz-act="retry">أعد الأخطاء فقط</button>' : ''}
        </div>
      </div>`;
    renderDashboard();
    return;
  }

  quizState.answered = false;
  const q = quizState.questions[quizState.index];
  const isEn2Ar = quizState.mode === 'en2ar';
  const promptMain = isEn2Ar ? q.item.term : q.item.meaning;
  // never show the section title (it can contain the answer); fall back to the specialty name
  const quizSpec = specById(q.item.specId);
  const promptSub = isEn2Ar && q.item.abbr ? `الاختصار: ${q.item.abbr}` : (quizSpec ? quizSpec.nameAr : '');

  box.innerHTML = `
    <div class="learn-card-top">
      <span>النتيجة: ${quizState.score}</span>
      <span class="learn-counter">${quizState.index + 1} / ${quizState.questions.length}</span>
    </div>
    <div class="${isEn2Ar ? 'learn-term' : 'learn-meaning'} quiz-prompt" dir="auto">${esc(promptMain)}</div>
    ${promptSub ? `<div class="learn-abbr quiz-sub">${esc(promptSub)}</div>` : ''}
    <div class="options-list">
      ${q.options.map((opt, idx) => `<button type="button" class="option-btn" data-idx="${idx}" dir="auto">${esc(opt)}</button>`).join('')}
    </div>
    <div id="quizFeedback" class="quiz-feedback" aria-live="polite"></div>`;
}

function checkQuizAnswer(btn) {
  if (quizState.answered) return;
  quizState.answered = true;
  markActive();

  const q = quizState.questions[quizState.index];
  const chosen = q.options[Number(btn.dataset.idx)];
  const buttons = $('quizContainer').querySelectorAll('.option-btn');
  buttons.forEach(b => { b.disabled = true; });

  const existing = state.progress[q.item.id];
  const prev = existing || { level: 0, seenCount: 0, nextReview: 0 };
  const isLast = quizState.index + 1 >= quizState.questions.length;

  if (chosen === q.answer) {
    btn.classList.add('correct');
    quizState.score++;
    state.progress[q.item.id] = { level: Math.min(3, prev.level + 1), seenCount: prev.seenCount + 1, nextReview: Date.now() + 3 * 86400000 };
    saveProgress();
    quizTimer = setTimeout(nextQuizQuestion, 900);
  } else {
    btn.classList.add('wrong');
    buttons.forEach((b, i) => { if (q.options[i] === q.answer) b.classList.add('correct'); });
    state.progress[q.item.id] = { level: 0, seenCount: prev.seenCount + 1, nextReview: Date.now() + 600000 };
    saveProgress();
    quizState.wrong.push(q.item);
    const fb = $('quizFeedback');
    fb.innerHTML = `
      <div class="feedback-box">
        <div class="feedback-title">الإجابة الصحيحة</div>
        <div dir="auto" class="feedback-term">${esc(q.item.term)}${q.item.abbr ? ` (${esc(q.item.abbr)})` : ''}</div>
        <div>${esc(q.item.meaning)}</div>
      </div>
      <button type="button" class="btn-green" data-quiz-act="next">${isLast ? 'عرض النتيجة' : 'التالي'}</button>`;
    const nb = fb.querySelector('[data-quiz-act="next"]');
    if (nb) nb.focus();
  }
}

function nextQuizQuestion() {
  clearTimeout(quizTimer);
  quizState.index++;
  renderQuizQuestion();
}

/* =========================================================
   Dictionary
   ========================================================= */
function getDictResults() {
  const nq = norm(state.dictQuery);
  const list = state.items.filter(i => state.dictSpec === 'all' || i.specId === state.dictSpec);
  if (!nq) return list;
  const scored = [];
  for (const i of list) {
    const t = norm(i.term), a = norm(i.abbr || ''), m = norm(i.meaning);
    let score = -1;
    if (t === nq || a === nq) score = 0;
    else if (t.startsWith(nq) || a.startsWith(nq)) score = 1;
    else if (t.includes(nq) || a.includes(nq)) score = 2;
    else if (m.includes(nq)) score = 3;
    if (score >= 0) scored.push([score, i]);
  }
  scored.sort((x, y) => x[0] - y[0]);
  return scored.map(x => x[1]);
}

function renderDictionary(reset = true) {
  if (reset) state.dictLimit = 50;
  const q = state.dictQuery.trim();
  const results = getDictResults();
  const shown = results.slice(0, state.dictLimit);

  $('dictCount').textContent = results.length ? `${results.length} نتيجة` : '';
  $('dictList').innerHTML = results.length ? shown.map((item) => `
    <div class="dict-item">
      <div class="dict-main">
        <strong class="dict-term" dir="ltr">${highlight(item.term, q)}</strong>
        ${item.abbr && item.abbr !== item.term ? `<span class="dict-abbr">(${highlight(item.abbr, q)})</span>` : ''}
        ${item.custom ? '<span class="tag">مضاف</span>' : item.edited ? '<span class="tag">معدّل</span>' : ''}
        <div class="dict-meaning">${highlight(item.meaning, q)}</div>
        <div class="dict-section">${esc(item.section)}</div>
      </div>
      <div class="dict-side">
        <div class="dict-tools">
          <button type="button" class="icon-btn-sm" data-act="edit" data-id="${item.id}" aria-label="تعديل: ${esc(item.term)}" title="تعديل">${ICONS.edit}</button>
          <button type="button" class="icon-btn-sm danger" data-act="del" data-id="${item.id}" aria-label="حذف: ${esc(item.term)}" title="حذف">${ICONS.del}</button>
        </div>
      </div>
    </div>`).join('') : '<p class="muted-note">لا توجد نتائج مطابقة.</p>';

  const more = $('dictMoreBtn');
  const remaining = results.length - shown.length;
  more.classList.toggle('hidden', remaining <= 0);
  more.textContent = `عرض المزيد (${remaining})`;
}

function openTermModal(item) {
  const editing = !!item;
  const termInput = el('input', { type: 'text', dir: 'ltr', maxlength: '160', value: editing ? item.term : '' });
  const abbrInput = el('input', { type: 'text', dir: 'ltr', maxlength: '30', value: editing ? (item.abbr || '') : '' });
  const meaningInput = el('input', { type: 'text', maxlength: '300', value: editing ? item.meaning : '' });
  const sectionInput = el('input', { type: 'text', maxlength: '120', value: editing ? (item.section || '') : '' });
  const specSelect = el('select', null, state.specs.map(s => el('option', { value: s.id }, s.nameAr)));
  specSelect.value = editing ? item.specId : (state.dictSpec !== 'all' ? state.dictSpec : (state.specs[0] || {}).id);
  const err = el('div', { class: 'form-error', role: 'alert' });

  const body = el('div', null,
    field('المصطلح (إنجليزي)', termInput),
    field('الاختصار (اختياري)', abbrInput),
    field('المعنى (عربي)', meaningInput),
    field('التخصص', specSelect),
    field('القسم (اختياري)', sectionInput),
    err);

  openModal({
    title: editing ? 'تعديل المصطلح' : 'إضافة مصطلح',
    body,
    actions: [
      {
        label: 'حفظ', kind: 'green', onClick: () => {
          const term = termInput.value.trim(), meaning = meaningInput.value.trim();
          const abbr = abbrInput.value.trim(), section = sectionInput.value.trim() || 'عام';
          const specId = specSelect.value;
          if (!term || !meaning) { err.textContent = 'المصطلح والمعنى مطلوبان.'; (term ? meaningInput : termInput).focus(); return false; }
          const clash = state.items.some(i => i.id !== (item && item.id) && i.specId === specId && i.term.toLowerCase() === term.toLowerCase());
          if (clash) { err.textContent = 'هذا المصطلح موجود مسبقاً في هذا التخصص.'; termInput.focus(); return false; }

          if (!editing) {
            state.customItems.push({ id: allocId(), specId, section, type: 'term', term, abbr, meaning });
          } else if (item.custom) {
            const src = state.customItems.find(i => i.id === item.id);
            if (src) Object.assign(src, { specId, section, term, abbr, meaning });
          } else {
            state.overrides[item.id] = { specId, section, term, abbr, meaning };
          }
          persistCustom();
          rebuild();
          initDropdowns();
          renderAll();
          showToast(editing ? 'تم حفظ التعديل.' : 'تمت إضافة المصطلح.');
          return true;
        }
      },
      { label: 'إلغاء' }
    ]
  });
}

async function deleteTerm(id) {
  const item = state.itemById.get(id);
  if (!item) return;
  const ok = await confirmModal({
    title: 'حذف المصطلح',
    message: `هل تريد حذف «${item.term}»؟` + (item.custom ? '' : ' يمكنك استعادته لاحقاً من الإعدادات.'),
    confirmLabel: 'حذف', danger: true
  });
  if (!ok) return;
  if (item.custom) {
    state.customItems = state.customItems.filter(i => i.id !== id);
    delete state.progress[id];
    saveProgress();
  } else {
    if (!state.hidden.includes(id)) state.hidden.push(id);
  }
  persistCustom();
  rebuild();
  initDropdowns();
  renderAll();
  showToast('تم حذف المصطلح.');
}

/* =========================================================
   Settings
   ========================================================= */
function renderSettings() {
  $('settingsGoal').value = state.dailyGoal;
  const theme = document.body.classList.contains('light') ? 'light' : 'dark';
  document.querySelectorAll('#themeSeg button').forEach((b) => {
    const on = b.dataset.themeVal === theme;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  document.querySelectorAll('#quizLenSeg button').forEach((b) => {
    const on = Number(b.dataset.len) === state.quizLen;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });

  const list = $('customSpecList');
  if (!state.customSpecs.length) {
    list.innerHTML = '<p class="muted-note flush">لا توجد تخصصات مضافة بعد. ستظهر هنا التخصصات التي تنشئها عند الاستيراد.</p>';
  } else {
    list.innerHTML = state.customSpecs.map((s) => {
      const n = state.customItems.filter(i => i.specId === s.id).length;
      return `
        <div class="spec-row">
          <div class="spec-row-main">
            <div class="spec-row-name">${esc(s.nameAr)}</div>
            <div class="spec-row-meta">${s.nameEn ? `<span dir="ltr">${esc(s.nameEn)}</span> · ` : ''}${n} مصطلح</div>
          </div>
          <div class="dict-tools">
            <button type="button" class="icon-btn-sm" data-spec-act="rename" data-id="${esc(s.id)}" aria-label="تعديل اسم ${esc(s.nameAr)}" title="تعديل الاسم">${ICONS.edit}</button>
            <button type="button" class="icon-btn-sm danger" data-spec-act="delete" data-id="${esc(s.id)}" aria-label="حذف ${esc(s.nameAr)}" title="حذف التخصص">${ICONS.del}</button>
          </div>
        </div>`;
    }).join('');
  }

  const restorable = state.hidden.length + Object.keys(state.overrides).length;
  const rb = $('restoreBtn');
  rb.disabled = restorable === 0;
  rb.textContent = restorable ? `استعادة المصطلحات الأصلية المحذوفة والمعدّلة (${restorable})` : 'لا توجد مصطلحات أصلية محذوفة أو معدّلة';

  $('appVersion').textContent = APP_VERSION;
  updateNetStatus();
  $('settingsInstallBtn').classList.toggle('hidden', !deferredPrompt);
}

function openRenameSpec(id) {
  const spec = state.customSpecs.find(s => s.id === id);
  if (!spec) return;
  const ar = el('input', { type: 'text', maxlength: '60', value: spec.nameAr });
  const en = el('input', { type: 'text', dir: 'ltr', maxlength: '60', value: spec.nameEn || '' });
  const err = el('div', { class: 'form-error', role: 'alert' });
  openModal({
    title: 'تعديل التخصص',
    body: el('div', null, field('الاسم بالعربية', ar), field('الاسم بالإنجليزية (اختياري)', en), err),
    actions: [
      {
        label: 'حفظ', kind: 'green', onClick: () => {
          const name = ar.value.trim();
          if (!name) { err.textContent = 'الاسم بالعربية مطلوب.'; ar.focus(); return false; }
          if (state.specs.some(s => s.id !== id && norm(s.nameAr) === norm(name))) { err.textContent = 'يوجد تخصص بهذا الاسم.'; ar.focus(); return false; }
          spec.nameAr = name;
          spec.nameEn = en.value.trim();
          persistCustom();
          rebuild();
          initDropdowns();
          renderAll();
          return true;
        }
      },
      { label: 'إلغاء' }
    ]
  });
}

async function deleteCustomSpec(id) {
  const spec = state.customSpecs.find(s => s.id === id);
  if (!spec) return;
  const n = state.customItems.filter(i => i.specId === id).length;
  const ok = await confirmModal({
    title: 'حذف التخصص',
    message: `سيُحذف تخصص «${spec.nameAr}» مع ${n} مصطلح وتقدمك فيها. لا يمكن التراجع.`,
    confirmLabel: 'حذف', danger: true
  });
  if (!ok) return;
  state.customItems.filter(i => i.specId === id).forEach(i => { delete state.progress[i.id]; });
  state.customItems = state.customItems.filter(i => i.specId !== id);
  state.customSpecs = state.customSpecs.filter(s => s.id !== id);
  saveProgress();
  persistCustom();
  rebuild();
  initDropdowns();
  renderAll();
  showToast('تم حذف التخصص.');
}

async function resetProgress() {
  const ok = await confirmModal({
    title: 'إعادة ضبط التقدم',
    message: 'سيُمسح تقدمك في كل المصطلحات وأيام الاستمرار ونشاط الأسبوع. المصطلحات نفسها لن تتأثر.',
    confirmLabel: 'إعادة الضبط', danger: true
  });
  if (!ok) return;
  state.progress = {};
  state.activity = {};
  state.streak = 0;
  state.lastActiveDay = '';
  saveProgress();
  writeJSON(KEYS.activity, state.activity);
  removeKey(KEYS.streak);
  removeKey(KEYS.lastDay);
  dailyBatch = [];
  renderAll();
  showToast('تمت إعادة ضبط التقدم.');
}

async function restoreOriginals() {
  const ok = await confirmModal({
    title: 'استعادة المصطلحات الأصلية',
    message: 'ستُلغى كل التعديلات على المصطلحات الأصلية ويعود المحذوف منها.',
    confirmLabel: 'استعادة'
  });
  if (!ok) return;
  state.hidden = [];
  state.overrides = {};
  persistCustom();
  rebuild();
  initDropdowns();
  renderAll();
  showToast('تمت استعادة المصطلحات الأصلية.');
}

async function clearCustomData() {
  if (!state.customItems.length && !state.customSpecs.length) { showToast('لا توجد بيانات مضافة لحذفها.'); return; }
  const ok = await confirmModal({
    title: 'حذف كل المضاف',
    message: `سيُحذف ${state.customSpecs.length} تخصص و${state.customItems.length} مصطلح أضفتها. لا يمكن التراجع.`,
    confirmLabel: 'حذف الكل', danger: true
  });
  if (!ok) return;
  state.customItems.forEach(i => { delete state.progress[i.id]; });
  state.customItems = [];
  state.customSpecs = [];
  saveProgress();
  persistCustom();
  rebuild();
  initDropdowns();
  renderAll();
  showToast('تم حذف البيانات المضافة.');
}

/* =========================================================
   Navigation, theme & rendering
   ========================================================= */
const TABS = ['dashboard', 'study', 'quiz', 'dict', 'settings'];

function switchTab(tabName) {
  if (!TABS.includes(tabName)) return;
  currentTab = tabName;
  closeAllDropdowns();
  TABS.forEach((t) => $(`tab-${t}`).classList.toggle('hidden', t !== tabName));
  document.querySelectorAll('nav.bottom-nav button').forEach((btn) => {
    const on = btn.dataset.tab === tabName;
    btn.classList.toggle('active', on);
    if (on) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
  });
  if (tabName === 'dashboard') renderDashboard();
  if (tabName === 'study' && !dailyBatch.length) loadDailyBatch();
  if (tabName === 'dict') renderDictionary();
  if (tabName === 'settings') renderSettings();
  window.scrollTo(0, 0);
}

function renderAll() {
  renderDashboard();
  if (currentTab === 'dict') renderDictionary(false);
  if (currentTab === 'settings') renderSettings();
  if (currentTab === 'study') loadDailyBatch();
}

function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  writeRaw(KEYS.theme, theme);
  if (currentTab === 'settings') renderSettings();
}

/* ---------- Online status ---------- */
function updateNetStatus() {
  const online = navigator.onLine;
  const dot = $('netDot');
  dot.classList.toggle('offline', !online);
  dot.setAttribute('aria-label', online ? 'متصل بالإنترنت' : 'غير متصل — التطبيق يعمل بدون إنترنت');
  const s = $('netStatus');
  if (s) s.textContent = online ? 'متصل' : 'غير متصل (يعمل بدون إنترنت)';
}

/* ---------- Service worker & install ---------- */
let swReg = null;
let deferredPrompt = null;
let updateToast = null;
const hadController = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;

function promptUpdate(worker) {
  if (updateToast && updateToast.isConnected) return;
  updateToast = showToast('يتوفر تحديث جديد للتطبيق.', {
    duration: 0, dismissible: true,
    action: {
      label: 'تحديث',
      onClick: () => {
        if (worker) worker.postMessage({ type: 'SKIP_WAITING' });
        else location.reload();
      }
    }
  });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    swReg = reg;
    if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(nw);
      });
    });
  }).catch(() => { /* offline mode unavailable */ });

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'ASSETS_UPDATED') promptUpdate(null);
  });
}

async function checkForUpdate() {
  if (!swReg) { showToast('التحديثات غير متاحة في هذا المتصفح.'); return; }
  if (!navigator.onLine) { showToast('أنت غير متصل بالإنترنت.'); return; }
  try {
    await swReg.update();
    await new Promise(r => setTimeout(r, 1500));
    if (swReg.waiting) promptUpdate(swReg.waiting);
    else if (!(updateToast && updateToast.isConnected)) showToast('أنت تستخدم أحدث نسخة.');
  } catch (e) {
    showToast('تعذّر التحقق من التحديثات الآن.');
  }
}

async function runInstall() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $('installBtn').classList.add('hidden');
  $('settingsInstallBtn').classList.add('hidden');
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $('installBtn').classList.remove('hidden');
  $('settingsInstallBtn').classList.remove('hidden');
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  $('installBtn').classList.add('hidden');
  $('settingsInstallBtn').classList.add('hidden');
});

/* =========================================================
   Event wiring
   ========================================================= */
function bindEvents() {
  // Navigation
  document.querySelector('nav.bottom-nav').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) switchTab(b.dataset.tab);
  });

  // Header
  $('themeBtn').addEventListener('click', () => applyTheme(document.body.classList.contains('light') ? 'dark' : 'light'));
  $('installBtn').addEventListener('click', runInstall);
  $('settingsInstallBtn').addEventListener('click', runInstall);
  window.addEventListener('online', updateNetStatus);
  window.addEventListener('offline', updateNetStatus);

  // Dashboard
  $('startDailyBtn').addEventListener('click', startDailyFromDashboard);
  $('dailyGoalInput').addEventListener('change', (e) => setDailyGoal(e.target.value));
  $('dueBanner').addEventListener('click', startDueReview);
  const grid = $('specGrid');
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.spec-card');
    if (card) openSpecStudy(card.dataset.spec);
  });
  grid.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.spec-card');
    if (card) { e.preventDefault(); openSpecStudy(card.dataset.spec); }
  });

  // Study
  $('revealBtn').addEventListener('click', revealMeaning);
  $('speakBtn').addEventListener('click', speakCurrentTerm);
  $('prevCardBtn').addEventListener('click', prevCard);
  $('ratingRow').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-rating]');
    if (b) rateCard(Number(b.dataset.rating));
  });
  $('studyEmptyBtn').addEventListener('click', () => { state.studyMode = 'normal'; initDropdowns(); loadDailyBatch(); });
  $('summaryQuizBtn').addEventListener('click', () => switchTab('quiz'));
  $('summaryAgainBtn').addEventListener('click', loadDailyBatch);

  document.addEventListener('keydown', (e) => {
    if (document.querySelector('.modal-backdrop')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (currentTab !== 'study' || $('studyCard').classList.contains('hidden')) return;
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const revealed = !$('answerSection').classList.contains('hidden');
    const digit = { '1': 0, '2': 1, '3': 2, '4': 3, '١': 0, '٢': 1, '٣': 2, '٤': 3 }[e.key];
    if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
      if (tag === 'BUTTON') return;
      e.preventDefault();
      revealMeaning();
    } else if (revealed && digit !== undefined) {
      rateCard(digit);
    } else if (e.key === 'ArrowRight') {
      prevCard();
    }
  });

  // Quiz
  $('startQuizBtn').addEventListener('click', () => startQuiz());
  $('quizContainer').addEventListener('click', (e) => {
    const opt = e.target.closest('.option-btn');
    if (opt) { checkQuizAnswer(opt); return; }
    const act = e.target.closest('[data-quiz-act]');
    if (!act) return;
    if (act.dataset.quizAct === 'next') nextQuizQuestion();
    else if (act.dataset.quizAct === 'new') startQuiz();
    else if (act.dataset.quizAct === 'retry') startQuiz(quizState.wrong.slice());
  });

  // Dictionary
  let searchTimer = null;
  $('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.dictQuery = e.target.value; renderDictionary(); }, 200);
  });
  $('dictMoreBtn').addEventListener('click', () => { state.dictLimit += 50; renderDictionary(false); });
  $('addTermBtn').addEventListener('click', () => openTermModal(null));
  $('importBtn').addEventListener('click', () => $('mdFileInput').click());
  $('dictList').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const id = Number(b.dataset.id);
    if (b.dataset.act === 'edit') { const it = state.itemById.get(id); if (it) openTermModal(it); }
    else if (b.dataset.act === 'del') deleteTerm(id);
  });
  $('mdFileInput').addEventListener('change', importMarkdownFiles);

  // Settings
  $('themeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-theme-val]');
    if (b) applyTheme(b.dataset.themeVal);
  });
  $('quizLenSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-len]');
    if (!b) return;
    state.quizLen = Number(b.dataset.len);
    writeRaw(KEYS.quizLen, state.quizLen);
    renderSettings();
  });
  $('settingsGoal').addEventListener('change', (e) => { setDailyGoal(e.target.value); renderDashboard(); });
  $('settingsImportBtn').addEventListener('click', () => $('mdFileInput').click());
  $('settingsAddBtn').addEventListener('click', () => openTermModal(null));
  $('customSpecList').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-spec-act]');
    if (!b) return;
    if (b.dataset.specAct === 'rename') openRenameSpec(b.dataset.id);
    else deleteCustomSpec(b.dataset.id);
  });
  $('restoreBtn').addEventListener('click', restoreOriginals);
  $('resetProgressBtn').addEventListener('click', resetProgress);
  $('clearCustomBtn').addEventListener('click', clearCustomData);
  $('checkUpdateBtn').addEventListener('click', checkForUpdate);
}

/* =========================================================
   Init
   ========================================================= */
function init() {
  migrateCustomIds();
  rebuild();
  if (readRaw(KEYS.theme, 'dark') === 'light') document.body.classList.add('light');
  setDailyGoal(state.dailyGoal);
  bindEvents();
  updateNetStatus();
  initDropdowns();
  renderDashboard();
}

init();
