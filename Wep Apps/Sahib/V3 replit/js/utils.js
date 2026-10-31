export const APP_VERSION = '2.0.0';
export const SCHEMA_VERSION = 2;

export function pad2(value) {
  return String(value).padStart(2, '0');
}

/** مفتاح اليوم بحسب التقويم المحلي للجهاز، لا بحسب UTC. */
export function localDateKey(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseDateKey(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function isValidDateKey(key) {
  return parseDateKey(key) !== null;
}

export function addDays(key, amount) {
  const date = parseDateKey(key);
  if (!date) return null;
  date.setDate(date.getDate() + amount);
  return localDateKey(date);
}

export function compareDateKeys(a, b) {
  if (!isValidDateKey(a) || !isValidDateKey(b)) return null;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function daysBetween(fromKey, toKey) {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  if (!from || !to) return null;
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUtc - fromUtc) / 86400000);
}

/** آخر سبعة أيام متحركة، وتشمل اليوم والأيام الستة السابقة. */
export function rollingDateKeys(count = 7, now = new Date()) {
  const today = localDateKey(now);
  if (!today || !Number.isInteger(count) || count < 1) return [];
  return Array.from({ length: count }, (_, index) => addDays(today, index - count + 1));
}

export function validTimestamp(value, { allowFuture = false, now = Date.now() } = {}) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  if (!allowFuture && time > now + 60000) return null;
  return time;
}

export function formatDate(key, fallback = 'لم تُراجَع بعد') {
  const date = parseDateKey(key);
  if (!date) return fallback;
  return new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(date);
}

export function formatDateTime(value) {
  const time = validTimestamp(value, { allowFuture: true });
  if (time === null) return 'وقت غير صالح';
  return new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  }).format(new Date(time));
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return 'غير متاحة';
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  if (minutes === 0) return `${remainder} ث`;
  return `${minutes} د ${remainder} ث`;
}

export function makeId(prefix = 'id') {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeArabic(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ـ/g, '')
    .replace(/سُورَةُ?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function safeString(value, maxLength = 2000) {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

export function h(tag, options = {}, ...children) {
  const node = document.createElement(tag);
  if (options.class) node.className = options.class;
  if (options.text !== undefined) node.textContent = String(options.text);
  if (options.attrs) {
    Object.entries(options.attrs).forEach(([name, value]) => {
      if (value === false || value === null || value === undefined) return;
      if (name === 'checked' || name === 'disabled' || name === 'selected') node[name] = Boolean(value);
      else node.setAttribute(name, value === true ? '' : String(value));
    });
  }
  children.flat(Infinity).forEach((child) => {
    if (child === null || child === undefined || child === false) return;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
  return node;
}

export function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function debounce(fn, delay = 180) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}
