/*
 * settings-ui.js — تبويب «الإعدادات». يُبنى مرة واحدة ثم تُحدَّث قيمه عبر refresh().
 * «إعادة ضبط الإعدادات» تمس الإعدادات فقط، لا المحفوظات ولا سجل المراجعات ولا النصوص ولا التفاسير.
 */
(function (g) {
  'use strict';
  const NS = (g.Sahib = g.Sahib || {});
  const { Utils, Settings, UI, Offline, QuranApi, TafsirApi, Storage, Memorization } = NS;
  const { el } = Utils;
  const $ = (id) => document.getElementById(id);

  const VERSION = '1.4.1';
  const SORT_LABELS = { surah: 'حسب السورة', added: 'الأحدث إضافة', reviewed: 'الأقدم مراجعة', priority: 'أولوية المراجعة' };
  const INTERVAL_ROWS = [
    ['mastered', 'بعد تقييم «متقن»', 'أيام'],
    ['good', 'بعد «جيد مع بعض الأخطاء»', 'أيام'],
    ['soon', 'بعد «يحتاج مراجعة قريبة»', 'أيام'],
    ['failed', 'بعد «لم أتمكن من التسميع»', 'أيام'],
    ['unrated', 'بعد مراجعة بلا تقييم', 'أيام']
  ];

  const refreshers = [];
  let job = null; // { controller } مهمة تنزيل جارية

  function saveCheck(result) {
    if (result && result.ok === false) UI.toast('تعذّر حفظ الإعداد (التخزين ممتلئ أو غير متاح). سيبقى مفعّلًا حتى إغلاق التطبيق.', 'error');
  }

  function row(label, desc, control, cls) {
    return el('div', { class: `set-row${cls ? ' ' + cls : ''}` },
      el('div', { class: 'set-label' }, el('span', { class: 't', text: label }), desc ? el('span', { class: 'd', text: desc }) : null),
      control
    );
  }
  function group(title, ...rows) {
    return el('section', { class: 'set-group' }, el('h2', { text: title }), el('div', { class: 'set-card' }, rows));
  }

  function switchRow(label, desc, get, set) {
    const btn = el('button', { type: 'button', class: 'switch', role: 'switch', 'aria-label': label });
    const sync = () => btn.setAttribute('aria-checked', get() ? 'true' : 'false');
    btn.addEventListener('click', () => { set(!get()); sync(); });
    refreshers.push(sync); sync();
    return row(label, desc, btn);
  }

  function selectRow(id, label, desc, options, get, set) {
    const select = el('select', { id }, ...options.map(([v, t]) => el('option', { value: v, text: t })));
    const labelEl = el('label', { class: 'sr-only', for: id, text: label });
    const wrap = el('div', {}, labelEl, select);
    const api = UI.enhanceSelect(select, { title: label });
    select.addEventListener('change', () => set(select.value));
    refreshers.push(() => { select.value = get(); api.refresh(); });
    select.value = get(); api.refresh();
    return row(label, desc, wrap);
  }

  function stepperRow(label, desc, { min, max, step, unit, get, set }) {
    const out = el('output', { 'aria-live': 'polite' });
    const minus = el('button', { type: 'button', 'aria-label': `إنقاص ${label}`, text: '−' });
    const plus = el('button', { type: 'button', 'aria-label': `زيادة ${label}`, text: '+' });
    const sync = () => {
      const v = get();
      out.textContent = `${v} ${unit === 'أيام' && v === 1 ? 'يوم' : unit === 'أيام' && v === 2 ? 'يومان' : unit}`;
      minus.disabled = v <= min;
      plus.disabled = v >= max;
    };
    const bump = (dir) => { set(Math.min(max, Math.max(min, get() + dir * step))); sync(); };
    minus.addEventListener('click', () => bump(-1));
    plus.addEventListener('click', () => bump(1));
    refreshers.push(sync); sync();
    return row(label, desc, el('div', { class: 'stepper' }, minus, out, plus));
  }

  const setting = (key) => ({
    get: () => Settings.get(key),
    set: (v) => saveCheck(Settings.set(key, v))
  });

  // ---------- قسم العمل دون اتصال ----------
  function offlineSection() {
    const status = el('div', { class: 'set-row col' });
    const usage = el('div', { class: 'set-row col' });
    const progress = el('div', { class: 'set-progress', role: 'status', hidden: true });
    const btnTexts = el('button', { type: 'button', class: 'btn btn-primary', text: 'تنزيل نصوص سور محفوظاتي' });
    const btnTafsir = el('button', { type: 'button', class: 'btn btn-ghost' });
    const btnStop = el('button', { type: 'button', class: 'btn btn-ghost', text: 'إيقاف التنزيل', hidden: true });

    function paintStatus() {
      const s = Offline.state;
      const files = s.sw === 'ready' ? 'جاهزة: تُفتح ملفات التطبيق دون إنترنت'
        : s.sw === 'registering' ? 'جارٍ التجهيز…'
        : 'غير مفعّلة';
      status.replaceChildren(
        el('div', { class: 'kv' }, el('span', { text: 'ملفات التطبيق' }), el('b', { text: files })),
        el('div', { class: 'kv' }, el('span', { text: 'نصوص السور المحفوظة' }), el('b', { text: `${QuranApi.cachedSurahCount()} من 114` })),
        el('div', { class: 'kv' }, el('span', { text: 'تفاسير محفوظة على جهازك' }), el('b', { text: String(TafsirApi.persistedCount()) })),
        s.reason ? el('div', { class: 'd', style: 'font-size:12px;color:var(--ink-soft);line-height:1.8', text: s.reason }) : null
      );
      const u = Offline.storageBreakdown();
      usage.replaceChildren(
        el('div', { class: 'kv' }, el('span', { text: 'مساحة النصوص' }), el('b', { text: Offline.formatBytes(u.texts) })),
        el('div', { class: 'kv' }, el('span', { text: 'مساحة التفاسير' }), el('b', { text: Offline.formatBytes(u.tafsir) })),
        el('div', { class: 'kv' }, el('span', { text: 'محفوظاتك وسجلك وإعداداتك' }), el('b', { text: Offline.formatBytes(u.data) })),
        el('div', { class: 'kv' }, el('span', { text: 'المجموع في التخزين المحلي' }), el('b', { text: Offline.formatBytes(u.total) }))
      );
      btnTafsir.textContent = `تنزيل ${TafsirApi.TAFSIRS[Settings.get('tafsirId')].name} لكل محفوظاتي`;
    }
    refreshers.push(paintStatus);
    Offline.onChange(paintStatus);

    function setBusy(busy) {
      btnTexts.disabled = busy; btnTafsir.disabled = busy;
      btnStop.hidden = !busy;
    }

    async function run(kind) {
      if (job) return;
      if (Memorization.all().length === 0) { UI.toast('أضف محفوظاتك أولًا ثم نزّل ما تحتاجه.'); return; }
      if (!Offline.isOnline()) { UI.toast('لا يوجد اتصال بالإنترنت حاليًا.', 'error'); return; }
      job = { controller: new AbortController() };
      setBusy(true);
      progress.hidden = false;
      const onProgress = (d, t) => { progress.textContent = `جارٍ التنزيل… ${d} من ${t}`; };
      const name = TafsirApi.TAFSIRS[Settings.get('tafsirId')].name;
      let res;
      try {
        res = kind === 'texts'
          ? await Offline.downloadTexts({ signal: job.controller.signal, onProgress })
          : await Offline.downloadTafsir({ signal: job.controller.signal, onProgress });
      } finally {
        job = null; setBusy(false);
      }
      paintStatus();
      if (res.aborted) { progress.textContent = `أُوقف التنزيل: ${res.done} من ${res.total}.`; return; }
      if (res.failure) {
        const why = res.failure.code === 'storage' ? 'التخزين ممتلئ أو غير متاح' : kind === 'texts' ? 'تعذّر الاتصال بمصدر النصوص' : TafsirApi.describeError(res.failure, name);
        progress.textContent = `توقف التنزيل (${why}). تم ${res.done} من ${res.total}.`;
        UI.toast('توقف التنزيل قبل اكتماله.', 'error');
        return;
      }
      const extra = res.skipped ? ` (${res.skipped} آية بلا نص متاح)` : '';
      progress.textContent = kind === 'texts'
        ? `اكتمل: ${res.done} من ${res.total} سورة جاهزة دون اتصال.`
        : `اكتمل: ${name} لـ ${res.done} من ${res.total} آية${extra}.`;
      UI.toast('اكتمل التنزيل', 'success');
    }

    btnTexts.addEventListener('click', () => run('texts'));
    btnTafsir.addEventListener('click', () => run('tafsir'));
    btnStop.addEventListener('click', () => { if (job) job.controller.abort(); });

    async function clearThing(label, fn) {
      if (job) { UI.toast('أوقف التنزيل الجاري أولًا.'); return; }
      const ok = await UI.confirm(`${label}\nلن يُحذف أي من محفوظاتك أو سجلك أو إعداداتك، ويمكن تنزيله مجددًا عند توفر الإنترنت.`, 'مسح');
      if (!ok) return;
      const r = await fn();
      paintStatus();
      if (r && r.ok === false) UI.toast('تعذّر المسح.', 'error'); else UI.toast('تم المسح', 'success');
    }

    return group('العمل دون اتصال',
      status, usage,
      progress,
      el('div', { class: 'set-actions' },
        btnTexts, btnTafsir, btnStop,
        el('button', { type: 'button', class: 'btn btn-ghost', text: 'مسح نصوص السور المحفوظة',
          onClick: () => clearThing('سيُمسح نص السور المحفوظ على الجهاز.', () => QuranApi.clearCache()) }),
        el('button', { type: 'button', class: 'btn btn-ghost', text: 'مسح التفاسير المحفوظة',
          onClick: () => clearThing('ستُمسح التفاسير المحفوظة على الجهاز.', () => TafsirApi.clearStore()) }),
        el('button', { type: 'button', class: 'btn btn-ghost', text: 'مسح ملفات التطبيق المخزّنة',
          onClick: () => clearThing('ستُمسح نسخة ملفات التطبيق المخزّنة للعمل دون اتصال؛ تُعاد تلقائيًا عند الفتح التالي بالإنترنت.', () => Offline.clearShellCache().then(() => ({ ok: true }))) })
      )
    );
  }

  async function onCheckUpdate(btn) {
    btn.disabled = true;
    try {
      const r = await Offline.checkForUpdate();
      if (!r.ok) {
        UI.toast(r.reason === 'offline' ? 'لا يوجد اتصال بالإنترنت للتحقق.' : r.reason === 'unavailable' ? 'التحقق متاح عند فتح التطبيق عبر رابط https.' : 'تعذّر التحقق من التحديث الآن.', 'error');
      } else if (r.changed > 0) {
        const pick = await UI.choice('تم تنزيل تحديث للتطبيق. أعد تحميل الصفحة لتطبيقه؟', [
          { label: 'لاحقًا', value: false, kind: 'ghost' },
          { label: 'إعادة التحميل', value: true, kind: 'primary', focus: true }
        ], { icon: '﴾ ✓ ﴿' });
        if (pick === true) location.reload();
      } else {
        UI.toast('أنت على أحدث إصدار.', 'success');
      }
    } finally { btn.disabled = false; }
  }

  function build() {
    const root = $('settingsContent');
    const tafsirOptions = TafsirApi.TAFSIR_IDS.map((id) => [id, TafsirApi.TAFSIRS[id].name]);

    const updateBtn = el('button', { type: 'button', class: 'btn btn-ghost', text: 'التحقق من وجود تحديث' });
    updateBtn.addEventListener('click', () => onCheckUpdate(updateBtn));

    root.replaceChildren(
      group('المظهر والقراءة',
        switchRow('الوضع الليلي', 'يريح العين في الإضاءة المنخفضة.',
          () => document.body.classList.contains('dark-theme'), (v) => UI.applyTheme(v, true)),
        stepperRow('حجم خط الآيات', 'يطبَّق في شاشة المراجعة.', {
          min: Math.round(Settings.FONT_MIN * 100), max: Math.round(Settings.FONT_MAX * 100), step: 10, unit: '%',
          get: () => Math.round(Settings.get('fontScale') * 100),
          set: (v) => saveCheck(Settings.set('fontScale', v / 100))
        }),
        selectRow('setTafsir', 'التفسير الافتراضي', 'يُعرض عند الضغط المطول على الآية.', tafsirOptions,
          () => Settings.get('tafsirId'), (v) => saveCheck(Settings.set('tafsirId', v))),
        stepperRow('مدة الضغط المطول', 'المدة اللازمة لإظهار التفسير.', {
          min: 300, max: 1200, step: 50, unit: 'م.ث', ...setting('holdMs')
        })
      ),
      group('الأهداف والجلسات',
        stepperRow('هدف اليوم', 'عدد جلسات المراجعة المكتملة يوميًا.', { min: 1, max: 50, step: 1, unit: 'جلسة', ...setting('dailyGoal') }),
        stepperRow('هدف الأسبوع', 'عدد الجلسات في آخر 7 أيام.', { min: 1, max: 350, step: 1, unit: 'جلسة', ...setting('weeklyGoal') }),
        stepperRow('حجم جلسة اليوم', 'عدد المقاطع المقترحة في كل جلسة.', { min: 1, max: 30, step: 1, unit: 'مقطع', ...setting('sessionSize') })
      ),
      group('قائمة المحفوظات',
        selectRow('setSort', 'الترتيب الافتراضي', 'يُطبَّق عند فتح التطبيق وعند مسح البحث والتصفية.',
          Settings.SORTS.map((k) => [k, SORT_LABELS[k]]),
          () => Settings.get('defaultSort'),
          (v) => { saveCheck(Settings.set('defaultSort', v)); if (NS.App) NS.App.applyDefaultSort(); })
      ),
      group('مواعيد المراجعة',
        ...INTERVAL_ROWS.map(([k, label, unit]) => stepperRow(label, k === 'mastered' ? 'تُحسب من آخر مراجعة لتحديد موعد التالية.' : null, {
          min: 1, max: 365, step: 1, unit,
          get: () => Settings.get('intervals')[k],
          set: (v) => saveCheck(Settings.set('intervals', { ...Settings.get('intervals'), [k]: v }))
        }))
      ),
      offlineSection(),
      group('إعدادات التطبيق',
        el('div', { class: 'set-actions' },
          el('button', {
            type: 'button', class: 'btn btn-ghost', text: 'إعادة ضبط الإعدادات',
            onClick: async () => {
              const ok = await UI.confirm('ستعود الإعدادات (الأهداف، الفترات، الخط، التفسير…) إلى قيمها الأصلية.\nلن تتأثر محفوظاتك ولا سجل مراجعاتك ولا النصوص والتفاسير المحفوظة.', 'إعادة الضبط');
              if (!ok) return;
              saveCheck(Settings.reset());
              if (NS.App) NS.App.applyDefaultSort();
              refresh();
              UI.toast('أُعيدت الإعدادات', 'success');
            }
          }),
          updateBtn
        )
      ),
      group('عن التطبيق',
        el('div', { class: 'about' },
          el('div', { class: 'kv' }, el('span', { text: 'الإصدار' }), el('b', { text: VERSION })),
          el('p', { text: 'تُحفظ بياناتك على هذا الجهاز فقط. نص القرآن من api.alquran.cloud (رواية حفص، الرسم العثماني)، والتفاسير (الميسر والسعدي) من مشروع tafsir_api عبر jsDelivr. النسخ الاحتياطي والاستعادة في تبويب «الإحصائيات».' })
        )
      )
    );
  }

  function refresh() { refreshers.forEach((fn) => fn()); }

  function init() { build(); }

  NS.SettingsUI = { init, refresh, VERSION };
})(globalThis);
