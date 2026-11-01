/*
 * utils.js — أدوات عامة: التواريخ المحلية، بناء عناصر DOM بأمان، معرّفات.
 *
 * ملاحظة التواريخ: جميع التواريخ تُخزَّن كنص YYYY-MM-DD بالتوقيت المحلي للجهاز.
 * لا نستخدم toISOString() للتاريخ لأنه يعيد تاريخ UTC وقد يختلف عن يوم المستخدم.
 */
(function (g) {
  'use strict';
  const NS = (g.Sahib = g.Sahib || {});

  const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  const MS_PER_DAY = 86400000;
  const pad2 = (n) => String(n).padStart(2, '0');

  // نقطة واحدة للحصول على "الآن" (تسهّل الاختبار).
  function now() {
    return new Date();
  }

  // تاريخ اليوم المحلي بصيغة YYYY-MM-DD.
  function toLocalDateStr(d) {
    const x = d || now();
    return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
  }

  // رقم اليوم (عدد الأيام منذ 1970) لتاريخ نصي؛ NaN إن كان غير صالح.
  // الحساب بتوقيت UTC لتفادي أخطاء التوقيت الصيفي عند طرح التواريخ.
  function dayNumber(str) {
    if (typeof str !== 'string') return NaN;
    const m = DATE_RE.exec(str);
    if (!m) return NaN;
    const y = +m[1], mo = +m[2], d = +m[3];
    const t = Date.UTC(y, mo - 1, d);
    const back = new Date(t);
    if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return NaN;
    return t / MS_PER_DAY;
  }

  function isValidDateStr(str) {
    return !Number.isNaN(dayNumber(str));
  }

  // عدد الأيام من a إلى b (موجب إذا كان b بعد a).
  function daysBetween(a, b) {
    return dayNumber(b) - dayNumber(a);
  }

  // تنسيق تاريخ للعرض؛ يعيد نصًا فارغًا إذا كان التاريخ غائبًا أو غير صالح.
  function formatDate(str) {
    if (!isValidDateStr(str)) return '';
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('ar-EG-u-nu-latn', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  // إضافة أيام إلى تاريخ نصي YYYY-MM-DD (بحساب UTC لتفادي التوقيت الصيفي). تعيد null إن كان التاريخ غير صالح.
  function addDays(str, n) {
    const dn = dayNumber(str);
    if (Number.isNaN(dn)) return null;
    const d = new Date((dn + n) * MS_PER_DAY);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }

  // اسم اليوم بالعربية لتاريخ نصي.
  function weekdayName(str) {
    if (!isValidDateStr(str)) return '';
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long' });
  }

  function generateId(prefix) {
    return (prefix || 'e') + Date.now() + Math.floor(Math.random() * 1000);
  }

  // إنشاء عنصر DOM بأمان: النصوص تُضاف كـ textNode ولا تُفسَّر كـ HTML أبدًا.
  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.length > 2 && k.startsWith('on') && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else node.setAttribute(k, v === true ? '' : String(v));
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      node.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  NS.Utils = {
    now, toLocalDateStr, dayNumber, isValidDateStr, daysBetween, addDays, weekdayName, formatDate, generateId, el
  };
})(globalThis);
