/*
 * app.js — ربط الواجهة: التبويبات، نموذج الإضافة، قائمة المحفوظات، تنبيهات التخزين.
 */
(function (g) {
  'use strict';
  const NS = (g.Sahib = g.Sahib || {});
  const { Quran, Utils, Storage, Memorization, Settings, UI, Review, Stats, ReviewLog, Backup, Plan, SettingsUI, Offline } = NS;
  const { el } = Utils;
  const $ = (id) => document.getElementById(id);

  const MASTERY_LABELS = { weak: 'إتقان: ضعيف', medium: 'إتقان: متوسط', strong: 'إتقان: قوي' };
  const view = { query: '', sort: Settings.get('defaultSort'), filter: 'all', masteredOpen: false };
  let editingId = null; // المقطع قيد التعديل في تبويب الإضافة (null = إضافة جديدة)

  // ---------- تنبيهات التخزين ----------
  function renderStorageBanner() {
    const box = $('storageBanner');
    box.replaceChildren();
    const notes = [];

    if (Storage.issues.unavailable) {
      notes.push(el('div', { class: 'banner-item' },
        el('p', { text: 'التخزين المحلي غير متاح في هذا المتصفح (ربما وضع التصفح الخاص)، لذلك لن تُحفظ بياناتك بعد إغلاق الصفحة.' })
      ));
    }
    Storage.issues.corrupt.forEach((c) => {
      const msg = c.backupKey
        ? `تعذّرت قراءة بيانات "${c.key}" لأنها تالفة. لم نحذف شيئًا: نُسخت البيانات الأصلية في المفتاح الاحتياطي ${c.backupKey}، ولن نحفظ فوقها حتى تختار المتابعة.`
        : `تعذّرت قراءة بيانات "${c.key}" لأنها تالفة، وتعذّر عمل نسخة احتياطية منها. لم نحذف شيئًا ولن نحفظ فوقها حتى تختار المتابعة.`;
      notes.push(el('div', { class: 'banner-item' },
        el('p', { text: msg }),
        el('button', {
          type: 'button', class: 'btn btn-ghost', text: 'المتابعة بقائمة جديدة',
          onClick: () => { Storage.allowWritesFor(c.key); Storage.issues.corrupt = Storage.issues.corrupt.filter((x) => x !== c); renderStorageBanner(); }
        })
      ));
    });
    Storage.issues.invalid.forEach((c) => {
      const msg = c.backupKey
        ? `تم تخطي ${c.count} سجلًا غير صالح من محفوظاتك المخزّنة، ونسخته الأصلية محفوظة في المفتاح ${c.backupKey}.`
        : `تم تخطي ${c.count} سجلًا غير صالح، وتعذّر حفظ نسخة منه، لذلك أُوقف الحفظ حتى تقرر المتابعة.`;
      notes.push(el('div', { class: 'banner-item' },
        el('p', { text: msg }),
        el('button', {
          type: 'button', class: 'btn btn-ghost', text: c.backupKey ? 'حسنًا' : 'المتابعة رغم ذلك',
          onClick: () => { if (!c.backupKey) Storage.allowWritesFor(c.key); Storage.issues.invalid = Storage.issues.invalid.filter((x) => x !== c); renderStorageBanner(); }
        })
      ));
    });

    box.hidden = notes.length === 0;
    box.append(...notes);
  }

  // ---------- التبويبات ----------
  function switchTab(tab) {
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    $('view-' + tab).classList.add('active');
    document.querySelectorAll('nav.bottom button').forEach((b) => {
      const active = b.dataset.tab === tab;
      b.classList.toggle('active', active);
      if (active) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    if (tab !== 'add') editingId = null;
    if (tab === 'list') renderList();
    if (tab === 'stats') renderStats();
    if (tab === 'plan') Plan.render();
    if (tab === 'settings') SettingsUI.refresh();
    if (tab === 'list' && NS.DownloadUI) NS.DownloadUI.paintButtons();
    if (tab === 'add') resetAddForm();
  }

  function startEdit(id) {
    if (!Memorization.find(id)) return;
    editingId = id;
    switchTab('add');
  }

  // ---------- تبويب الإضافة ----------
  function fillSurahSelect() {
    const select = $('surahSelect');
    Quran.SURAHS.forEach((s) => {
      select.append(el('option', { value: String(s.n), text: `${s.n}. ${s.name}` }));
    });
  }

  function showAddError(message) {
    const box = $('addError');
    box.textContent = message;
    box.classList.add('show');
  }
  function hideAddError() {
    $('addError').classList.remove('show');
  }

  function setAddMode(isEdit) {
    $('addTitle').textContent = isEdit ? 'تعديل المقطع' : 'إضافة حفظ جديد';
    $('saveEntryBtn').textContent = isEdit ? 'حفظ التعديلات' : 'حفظ في قائمة المراجعة';
    $('cancelEditBtn').hidden = !isEdit;
  }

  function resetAddForm() {
    hideAddError();
    const entry = editingId ? Memorization.find(editingId) : null;
    if (editingId && !entry) editingId = null;
    setAddMode(!!entry);
    $('wholeSurahBox').checked = false;
    $('startDate').max = Utils.toLocalDateStr();
    if (entry) {
      $('surahSelect').value = String(entry.surah);
      updateSurahHint();
      $('fromAyah').value = entry.from;
      $('toAyah').value = entry.to;
      $('startDate').value = Utils.isValidDateStr(entry.dateAdded) ? entry.dateAdded : Utils.toLocalDateStr();
      $('masterySelect').value = entry.mastery || '';
      $('notesInput').value = entry.notes || '';
    } else {
      $('fromAyah').value = 1;
      $('toAyah').value = 1;
      $('startDate').value = Utils.toLocalDateStr();
      $('masterySelect').value = '';
      $('notesInput').value = '';
      updateSurahHint();
    }
  }
  function updateSurahHint() {
    const s = Quran.surahByNumber(parseInt($('surahSelect').value, 10));
    $('surahAyahHint').textContent = s ? `عدد آيات هذه السورة: ${s.ayahs}` : '';
    $('fromAyah').max = s ? s.ayahs : 286;
    $('toAyah').max = s ? s.ayahs : 286;
    if ($('wholeSurahBox').checked && s) {
      $('fromAyah').value = 1;
      $('toAyah').value = s.ayahs;
    }
  }

  const rangeText = (e) => `الآيات ${e.from} إلى ${e.to}`;

  async function onSave() {
    const v = Memorization.validateRange($('surahSelect').value, $('fromAyah').value, $('toAyah').value);
    if (!v.ok) {
      showAddError(v.error);
      return;
    }
    const startDate = $('startDate').value;
    if (startDate && (!Utils.isValidDateStr(startDate) || Utils.daysBetween(startDate, Utils.toLocalDateStr()) < 0)) {
      showAddError('تاريخ بدء الحفظ غير صالح أو في المستقبل.');
      return;
    }
    hideAddError();
    const extra = { notes: $('notesInput').value, mastery: $('masterySelect').value || null, dateAdded: startDate || undefined };
    const surahName = Quran.surahByNumber(v.surah).name;
    const rel = Memorization.classify(Memorization.all(), v.surah, v.from, v.to, editingId);
    let result;

    if (editingId) {
      if (rel.group.length > 0) {
        const pick = await UI.choice(
          `النطاق الجديد (${rangeText(v)}) يتداخل مع مقاطع أخرى مسجّلة في ${surahName}.\nالموجود: ${rel.group.map(rangeText).join('، ')}.`,
          [
            { label: 'تعديل النطاق', value: 'cancel', kind: 'ghost', focus: true },
            { label: 'حفظ رغم التداخل', value: 'save', kind: 'primary' }
          ],
          { icon: '﴾ ؟ ﴿' }
        );
        if (pick !== 'save') return;
      }
      result = Memorization.edit(editingId, { ...v, ...extra });
    } else if (rel.group.length === 0) {
      result = Memorization.add({ ...v, ...extra });
    } else {
      // تداخل أو تكرار أو تجاور: نعرض الموجود والجديد ونترك القرار للمستخدم، دون دمج صامت.
      const existing = rel.group.map(rangeText).join('، ');
      const kind = rel.exact.length ? 'هذا المقطع مسجّل مسبقًا أو يتداخل مع مقاطع مسجّلة'
        : rel.overlapping.length ? 'المقطع الجديد يتداخل مع مقاطع مسجّلة' : 'المقطع الجديد يجاور مقاطع مسجّلة';
      const message = `${kind} في ${surahName}.\nالموجود: ${existing}.\nالجديد: ${rangeText(v)}.`;
      const actions = [{ label: 'تعديل النطاق', value: 'cancel', kind: 'ghost', focus: true }];
      actions.push({ label: 'إضافة كمقطع مستقل', value: 'separate', kind: 'ghost' });
      if (Memorization.mergeChangesRange(rel.group, v.from, v.to)) {
        actions.push({ label: 'دمج في مقطع واحد', value: 'merge', kind: 'primary' });
      }
      const pick = await UI.choice(message, actions, { icon: '﴾ ؟ ﴿' });
      if (pick === 'separate') result = Memorization.add({ ...v, ...extra });
      else if (pick === 'merge') result = Memorization.mergeAdd(rel.group.map((e) => e.id), v);
      else return; // إلغاء: يبقى النموذج كما هو ليعدّل المستخدم النطاق
    }

    if (!result.ok) {
      showAddError(Storage.describeError(result) || 'تعذّر الحفظ.');
      return;
    }
    const wasEdit = !!editingId;
    editingId = null;
    UI.toast(wasEdit ? 'تم حفظ التعديلات' : 'تم الحفظ في قائمة المراجعة', 'success');
    switchTab('list');
  }

  // ---------- تبويب القائمة ----------
  function resetListFilters() {
    view.query = '';
    view.sort = Settings.get('defaultSort');
    view.filter = 'all';
    $('searchInput').value = '';
    $('sortSelect').value = view.sort;
    $('filterSelect').value = 'all';
    renderList();
  }

  // يُطبَّق الترتيب الافتراضي من الإعدادات على القائمة الحالية
  function applyDefaultSort() {
    view.sort = Settings.get('defaultSort');
    $('sortSelect').value = view.sort;
    renderList();
  }

  function renderList() {
    const container = $('listContent');
    const strip = $('listStatsStrip');
    const tools = $('listTools');
    const entries = Memorization.all();

    if (entries.length === 0) {
      strip.replaceChildren();
      tools.hidden = true;
      container.replaceChildren(
        el('div', { class: 'empty-state' },
          el('div', { class: 'glyph', 'aria-hidden': 'true', text: '﴿ ٱقْرَأْ ﴾' }),
          el('p', { text: 'لا توجد آيات محفوظة بعد.' }),
          el('p', { text: 'ابدأ بإضافة أول مقطع تحفظه من القرآن الكريم.' }),
          el('button', {
            type: 'button', class: 'btn btn-gold empty-cta', text: 'إضافة الآن',
            onClick: () => switchTab('add')
          })
        )
      );
      return;
    }

    tools.hidden = false;
    const today = Utils.toLocalDateStr();
    const stats = Stats.compute(entries, ReviewLog.all(), today);
    Stats.renderListStrip(strip, stats);

    const visible = Memorization.sortEntries(Memorization.filterEntries(entries, view, today), view.sort, today);
    if (visible.length === 0) {
      container.replaceChildren(
        el('div', { class: 'empty-state' },
          el('div', { class: 'glyph', 'aria-hidden': 'true', text: '﴿ ﴾' }),
          el('p', { text: 'لا توجد نتائج مطابقة لبحثك أو تصفيتك.' }),
          el('button', { type: 'button', class: 'btn btn-ghost empty-cta', text: 'مسح البحث والتصفية', onClick: resetListFilters })
        )
      );
      return;
    }

    const cov = Memorization.coveredMap(entries);

    // الصفحة الافتراضية (بلا بحث ولا تصفية): السور المحفوظة كاملة (كل آياتها مغطاة) تنتقل كاملة بمقاطعها
    // إلى مجلد مطويّ آخر القائمة. مع البحث أو أي تصفية تظهر كل النتائج كما هي، فلا تختفي سورة عن البحث.
    const isCompleteAndMastered = (surahNum) => {
      const s = Quran.surahByNumber(surahNum);
      const surahEntries = entries.filter((e) => e.surah === surahNum);
      return !!s && cov.has(surahNum) && cov.get(surahNum).size >= s.ayahs &&
        surahEntries.length > 0 && surahEntries.every(Stats.isMastered);
    };
    const collapse = !view.query.trim() && view.filter === 'all';
    const masteredSurahs = new Set(collapse
      ? entries.filter((e) => isCompleteAndMastered(e.surah)).map((e) => e.surah)
      : []);
    const mastered = collapse ? visible.filter((e) => masteredSurahs.has(e.surah)) : [];
    const active = collapse ? visible.filter((e) => !masteredSurahs.has(e.surah)) : visible;

    const nodes = [];
    if (active.length) nodes.push(...entryNodes(active, cov, today));
    else if (mastered.length) nodes.push(el('div', { class: 'plan-empty', text: 'كل سورك المحفوظة مكتملة. افتح مجلد «المتقنة» أدناه.' }));
    if (mastered.length) nodes.push(masteredFolder(mastered, cov, today));
    container.replaceChildren(...nodes);
  }

  // بطاقات المقاطع: قائمة مسطحة لغير ترتيب السورة، ومجموعات حسب السورة في ترتيب السورة
  function entryNodes(items, cov, today) {
    if (view.sort !== 'surah') {
      return items.map((e) => entryCard(e, Quran.surahByNumber(e.surah), true, today));
    }
    const bySurah = new Map();
    items.forEach((e) => {
      if (!bySurah.has(e.surah)) bySurah.set(e.surah, []);
      bySurah.get(e.surah).push(e);
    });
    return Array.from(bySurah.keys()).sort((a, b) => a - b).map((surahNum) => {
      const s = Quran.surahByNumber(surahNum);
      const covered = cov.get(surahNum).size;
      const isDone = covered >= s.ayahs;
      return el('div', { class: 'surah-group' },
        el('div', { class: 'surah-group-head' },
          el('div', { class: 'name', text: s.name }),
          el('div', { class: `progress${isDone ? ' done' : ''}`, text: isDone ? 'محفوظة كاملة ✓' : `${covered} / ${s.ayahs}` })
        ),
        bySurah.get(surahNum).map((e) => entryCard(e, s, false, today))
      );
    });
  }

  function masteredFolder(items, cov, today) {
    const open = view.masteredOpen;
    const surahCount = new Set(items.map((e) => e.surah)).size;
    const head = el('button', {
      type: 'button', class: `folder-head${open ? ' open' : ''}`, id: 'masteredFolderBtn',
      'aria-expanded': open ? 'true' : 'false', 'aria-controls': 'masteredFolderBody',
      onClick: () => { view.masteredOpen = !view.masteredOpen; renderList(); }
    },
      el('span', { class: 'folder-ico', 'aria-hidden': 'true', text: '📁' }),
      el('span', { class: 'folder-name', text: `المتقنة (${surahCount} ${surahCount === 1 ? 'سورة' : 'سور'})` }),
      el('span', { class: 'folder-chev', 'aria-hidden': 'true', text: open ? '▴' : '▾' })
    );
    const body = el('div', { class: 'folder-body', id: 'masteredFolderBody', hidden: !open }, open ? entryNodes(items, cov, today) : null);
    return el('div', { class: 'folder' }, head, body);
  }

  function entryCard(e, s, showSurah, today) {
    const added = Utils.formatDate(e.dateAdded);
    const reviewed = e.lastReviewed ? `آخر مراجعة ${Utils.formatDate(e.lastReviewed)}` : 'لم تُراجَع بعد';
    const meta = `${added ? `أُضيفت ${added} · ` : ''}${reviewed}`;
    const badges = [];
    if (Memorization.needsReview(e, today)) badges.push(el('span', { class: 'badge due', text: 'تحتاج مراجعة' }));
    if (e.lastRating) badges.push(el('span', { class: `badge rate-${e.lastRating}`, text: Review.RATING_LABELS[e.lastRating] }));
    if (e.mastery) badges.push(el('span', { class: 'badge', text: MASTERY_LABELS[e.mastery] }));

    const openBtn = el('button', {
      type: 'button', class: 'entry-main',
      'aria-label': `مراجعة ${s.name}، ${rangeText(e)}`,
      onClick: (ev) => Review.open(e.id, ev.currentTarget)
    },
      el('div', { class: 'entry-marker', 'aria-hidden': 'true', text: `${e.from}-${e.to}` }),
      el('div', { class: 'entry-body' },
        showSurah ? el('div', { class: 'entry-surah', text: s.name }) : null,
        el('div', { class: 'entry-range' },
          `${rangeText(e)} `,
          el('span', { class: 'entry-count', text: `(${e.to - e.from + 1} آية)` })
        ),
        el('div', { class: 'entry-meta', text: meta }),
        badges.length ? el('div', { class: 'badges' }, badges) : null,
        e.notes ? el('div', { class: 'entry-note', text: `ملاحظة: ${e.notes}` }) : null
      )
    );
    const editBtn = el('button', {
      type: 'button', class: 'entry-act', title: 'تعديل',
      'aria-label': `تعديل ${s.name}، ${rangeText(e)}`,
      text: '✎',
      onClick: () => startEdit(e.id)
    });
    const delBtn = el('button', {
      type: 'button', class: 'entry-del', title: 'حذف',
      'aria-label': `حذف ${s.name}، ${rangeText(e)}`,
      text: '🗑',
      onClick: () => onDelete(e, s)
    });
    return el('div', { class: 'entry-card', 'data-id': e.id }, openBtn, editBtn, delBtn);
  }

  async function onDelete(e, s) {
    const ok = await UI.confirm(
      `هل تريد حذف المقطع (${rangeText(e)} من ${s.name}) من قائمة المراجعة؟\nستُحسب الإحصائيات من دونه. سجل مراجعاتك السابقة والتفاسير المحفوظة على جهازك لا تُحذف.`,
      'حذف'
    );
    if (!ok) return;
    const result = Memorization.remove(e.id);
    if (!result.ok) {
      UI.toast(Storage.describeError(result) || 'تعذّر الحذف.', 'error');
      return;
    }
    renderList();
    UI.toast('تم الحذف', 'success');
  }

  // ---------- تبويب الإحصائيات ----------
  function renderStats() {
    const stats = Stats.compute(Memorization.all(), ReviewLog.all(), Utils.toLocalDateStr());
    Stats.renderStatsView($('statsContent'), stats, { daily: Settings.get('dailyGoal'), weekly: Settings.get('weeklyGoal') });
  }

  // ---------- النسخ الاحتياطي ----------
  function onExport() {
    const text = JSON.stringify(Backup.exportData(), null, 2);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = el('a', { href: url, download: Backup.exportFileName() });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    UI.toast('تم تصدير النسخة الاحتياطية', 'success');
  }

  function refreshAfterRestore() {
    applyDefaultSort();
    renderStats();
    Plan.render();
    SettingsUI.refresh();
  }

  async function onImportFile(file) {
    if (!file) return;
    if (file.size > Backup.MAX_FILE_BYTES) {
      UI.toast('الملف كبير جدًا ليكون نسخة احتياطية صالحة.', 'error');
      return;
    }
    let text;
    try {
      text = await file.text();
    } catch (e) {
      UI.toast('تعذّرت قراءة الملف.', 'error');
      return;
    }
    const parsed = Backup.parseAndValidate(text);
    if (!parsed.ok) {
      await UI.choice(`تعذّر استيراد الملف:\n${parsed.error}\nلم يتغير شيء في بياناتك.`, [{ label: 'حسنًا', value: 'ok', kind: 'primary', focus: true }], { icon: '﴾ ! ﴿' });
      return;
    }
    const data = parsed.data;
    const plan = Backup.planMerge(data);
    const when = data.exportedAt ? Utils.formatDate(data.exportedAt.slice(0, 10)) : 'غير معروف';
    const message = `نسخة بتاريخ ${when}: ${data.entries.length} مقطع و${data.reviewLog.length} سجل مراجعة.\n` +
      `الدمج يضيف ${plan.toAdd.length} مقطعًا جديدًا ويتجاوز ${plan.skipped} موجودًا، ولا يغيّر بياناتك الحالية.\n` +
      `الاستبدال يضع محتوى النسخة مكان بياناتك الحالية (${Memorization.all().length} مقطع) بعد حفظ نسخة أمان تلقائية.`;
    const pick = await UI.choice(message, [
      { label: 'إلغاء', value: null, kind: 'ghost', focus: true },
      { label: 'دمج', value: 'merge', kind: 'primary' },
      { label: 'استبدال', value: 'replace', kind: 'danger' }
    ], { icon: '﴾ ؟ ﴿' });
    if (pick !== 'merge' && pick !== 'replace') return;

    const result = pick === 'merge' ? Backup.applyMerge(data) : Backup.applyReplace(data);
    if (!result.ok) {
      const why = result.stage === 'safety'
        ? 'تعذّر حفظ نسخة الأمان، فلم نُجرِ الاستبدال. '
        : 'فشلت الكتابة وأُعيدت بياناتك كما كانت. ';
      UI.toast(why + (Storage.describeError(result.result) || ''), 'error');
      return;
    }
    refreshAfterRestore();
    UI.toast(pick === 'merge'
      ? `تم الدمج: أُضيف ${result.added} مقطعًا وتُجوّز ${result.skipped}.`
      : `تم الاستبدال: ${result.count} مقطعًا. نسخة الأمان محفوظة في ${result.safetyKey}.`, 'success');
  }

  // ---------- التشغيل ----------
  function init() {
    Memorization.init(Storage.loadEntries());
    UI.initModal();
    UI.initTheme();
    Review.init(() => { renderList(); if ($('view-plan').classList.contains('active')) Plan.render(); });
    renderStorageBanner();

    fillSurahSelect();
    ['surahSelect', 'masterySelect', 'sortSelect', 'filterSelect'].forEach((id) => UI.enhanceSelect($(id)));
    $('sortSelect').value = view.sort;
    Plan.init();
    SettingsUI.init();
    Offline.init();
    NS.DownloadUI.init();
    $('surahSelect').addEventListener('change', updateSurahHint);
    $('wholeSurahBox').addEventListener('change', updateSurahHint);
    $('saveEntryBtn').addEventListener('click', onSave);
    $('cancelEditBtn').addEventListener('click', () => switchTab('list'));
    $('exportBtn').addEventListener('click', onExport);
    $('importBtn').addEventListener('click', () => $('importFile').click());
    $('importFile').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = ''; // يسمح باختيار الملف نفسه مرة أخرى
      await onImportFile(file);
    });
    $('searchInput').addEventListener('input', (e) => { view.query = e.target.value; renderList(); });
    $('sortSelect').addEventListener('change', (e) => { view.sort = e.target.value; renderList(); });
    $('filterSelect').addEventListener('change', (e) => { view.filter = e.target.value; renderList(); });
    document.querySelectorAll('nav.bottom button').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    updateSurahHint();

    $('todayHint').textContent = Utils.formatDate(Utils.toLocalDateStr());
    renderList();
  }

  NS.App = { init, switchTab, renderList, renderStats, applyDefaultSort };
  init();
})(globalThis);
