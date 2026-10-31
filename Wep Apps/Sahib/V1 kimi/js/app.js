import { SURAHS, surahByNumber } from './quran-data.js';
import { SafeStorage, STORAGE_KEYS } from './storage.js';
import { loadSettings, saveSettings, validateSettings } from './settings.js';
import { QuranApi } from './quran-api.js';
import { ReviewSession } from './review.js';
import { buildEntry, validateEntryInput, findOverlaps, findAdjacent, overlapDescription, mergeEntries, reassignReviewEntryIds, uniqueAyahMap, countUniqueAyahs, searchAndSortEntries, masteryLabel } from './memorization.js';
import { buildSchedule, dailyCandidates, weightedRandomEntry, postponeEntry, rescheduleEntry, ratingLabel } from './review-scheduler.js';
import { computeStats } from './stats.js';
import { createBackup, downloadJson, readBackupFile, mergeBackupData } from './backup.js';
import { APP_VERSION, localDateKey, formatDate, formatDateTime, formatDuration, h, clearNode, debounce, clamp } from './utils.js';

const $ = (id) => document.getElementById(id);
const storage = new SafeStorage();
let entries = [];
let reviews = [];
let scheduleEvents = [];
let settings = loadSettings(storage);
let schedule = new Map();
let editingId = null;
let currentTab = 'list';
let session = null;
let sessionController = null;
let sessionToken = 0;
let sessionTimerInterval = null;
let hiddenTest = false;
let revealedAyahs = new Set();
let activeQueue = null;
let randomExcluded = new Set();
let pendingImport = null;
let deferredInstallPrompt = null;
let toastTimer = null;
let lastFocusedElement = null;
const quranApi = new QuranApi({ storage });

try { entries = storage.loadEntries(); } catch (error) { storage.warnings.push(error.message); }
try { reviews = storage.loadReviews(); } catch (error) { storage.warnings.push(error.message); }
try { scheduleEvents = storage.loadScheduleEvents(); } catch (error) { storage.warnings.push(error.message); }

function refreshSchedule() {
  schedule = buildSchedule(entries, reviews, settings);
}

function showToast(message, { actionLabel = null, onAction = null, duration = 3500, force = false } = {}) {
  if (!settings.notifications && !force && !actionLabel) return;
  clearTimeout(toastTimer);
  const toast = $('toast');
  $('toastText').textContent = message;
  const action = $('toastAction');
  action.hidden = !actionLabel;
  action.textContent = actionLabel || '';
  action.onclick = actionLabel ? () => { toast.hidden = true; onAction?.(); } : null;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, duration);
}

function renderStorageWarnings() {
  const warning = $('storageWarning');
  warning.textContent = storage.warnings.join('\n');
  warning.hidden = storage.warnings.length === 0;
  $('downloadRawBtn').hidden = storage.warnings.length === 0;
}

function applyTheme(theme, persist = false) {
  settings.theme = theme === 'dark' ? 'dark' : 'light';
  document.body.dataset.theme = settings.theme;
  document.querySelector('meta[name="theme-color"]').content = settings.theme === 'dark' ? '#182722' : '#1f3d3a';
  $('themeSetting').value = settings.theme;
  if (persist) {
    try { settings = saveSettings(storage, settings); }
    catch (error) { showToast(error.message, { force: true }); }
  }
}

function switchTab(tab, { resetAdd = false } = {}) {
  if (!$('view-' + tab)) return;
  currentTab = tab;
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${tab}`));
  document.querySelectorAll('[data-tab]').forEach((button) => {
    const active = button.dataset.tab === tab;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  if (tab === 'add' && resetAdd) resetEntryForm();
  if (tab === 'list') renderList();
  if (tab === 'review') renderReviewDashboard();
  if (tab === 'stats') renderStats();
  if (tab === 'settings') fillSettingsForm();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function showConfirm(message, { okLabel = 'تأكيد', optionalLabel = null, cancelLabel = 'إلغاء', danger = true } = {}) {
  return new Promise((resolve) => {
    const backdrop = $('confirmModal');
    const ok = $('confirmOkBtn');
    const optional = $('confirmOptionalBtn');
    const cancel = $('confirmCancelBtn');
    const previousFocus = document.activeElement;
    $('confirmMsg').textContent = message;
    ok.textContent = okLabel;
    ok.className = danger ? 'btn btn-danger' : 'btn btn-primary';
    optional.textContent = optionalLabel || '';
    optional.hidden = !optionalLabel;
    cancel.textContent = cancelLabel;
    backdrop.hidden = false;
    lastFocusedElement = previousFocus;
    const cleanup = (result) => {
      backdrop.hidden = true;
      ok.removeEventListener('click', onOk);
      optional.removeEventListener('click', onOptional);
      cancel.removeEventListener('click', onCancel);
      backdrop.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKeydown);
      previousFocus?.focus?.();
      resolve(result);
    };
    const onOk = () => cleanup('ok');
    const onOptional = () => cleanup('optional');
    const onCancel = () => cleanup('cancel');
    const onBackdrop = (event) => { if (event.target === backdrop) cleanup('cancel'); };
    const onKeydown = (event) => {
      if (event.key === 'Escape') cleanup('cancel');
      if (event.key === 'Tab') {
        const focusable = [cancel, optional, ok].filter((button) => !button.hidden);
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    ok.addEventListener('click', onOk);
    optional.addEventListener('click', onOptional);
    cancel.addEventListener('click', onCancel);
    backdrop.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKeydown);
    cancel.focus();
  });
}

function populateSurahSelects() {
  [$('surahSelect'), $('reviewSurahSelect')].forEach((select) => {
    SURAHS.forEach((surah) => {
      const option = h('option', { text: `${surah.n}. ${surah.name}`, attrs: { value: surah.n } });
      select.append(option);
    });
  });
}

function updateSurahHint() {
  const surah = surahByNumber(Number($('surahSelect').value));
  $('surahAyahHint').textContent = surah ? `عدد آيات هذه السورة: ${surah.ayahs}` : '';
  ['fromAyah', 'toAyah'].forEach((id) => { $(id).max = surah?.ayahs || 1; });
  if ($('wholeSurahBox').checked && surah) {
    $('fromAyah').value = 1;
    $('toAyah').value = surah.ayahs;
  }
}

function resetEntryForm() {
  editingId = null;
  $('entryForm').reset();
  $('surahSelect').value = '1';
  $('fromAyah').value = 1;
  $('toAyah').value = 1;
  $('startDate').value = localDateKey();
  $('masteryInput').value = 'unrated';
  $('addTitle').textContent = 'إضافة حفظ جديد';
  $('saveEntryBtn').textContent = 'حفظ في قائمة المراجعة';
  $('cancelEditBtn').hidden = true;
  $('addError').hidden = true;
  updateSurahHint();
}

function readEntryForm() {
  return {
    surah: Number($('surahSelect').value),
    from: Number($('fromAyah').value),
    to: Number($('toAyah').value),
    startDate: $('startDate').value || localDateKey(),
    mastery: $('masteryInput').value,
    category: $('categoryInput').value.trim(),
    notes: $('notesInput').value.trim(),
  };
}

function commitEntries(nextEntries) {
  storage.saveEntries(nextEntries);
  entries = nextEntries;
  refreshSchedule();
}

async function handleEntrySubmit(event) {
  event.preventDefault();
  const button = $('saveEntryBtn');
  if (button.disabled) return;
  button.disabled = true;
  $('addError').hidden = true;
  try {
    const input = readEntryForm();
    const validation = validateEntryInput(input);
    if (!validation.valid) throw new Error(validation.error);
    if (editingId) {
      const existing = entries.find((entry) => entry.id === editingId);
      if (!existing) throw new Error('المقطع الذي تعدله لم يعد موجودًا.');
      const candidate = { ...existing, ...input, surahName: validation.surah.name, updatedAt: new Date().toISOString() };
      const overlaps = findOverlaps(entries, candidate, editingId);
      if (overlaps.length) throw new Error(`يتداخل التعديل مع: ${overlapDescription(overlaps)}. عدّل النطاق أولًا؛ لن ندمج شيئًا تلقائيًا.`);
      commitEntries(entries.map((entry) => entry.id === editingId ? candidate : entry));
      showToast('حُفظ تعديل المقطع.');
      switchTab('list');
      return;
    }
    const candidate = buildEntry(input);
    const directOverlaps = findOverlaps(entries, candidate);
    const adjacent = directOverlaps.length ? [] : findAdjacent(entries, candidate);
    const overlaps = directOverlaps.length ? directOverlaps : adjacent;
    if (overlaps.length) {
      const exact = directOverlaps.some((entry) => entry.from === candidate.from && entry.to === candidate.to);
      const choice = await showConfirm(
        `المقطع الجديد: ${candidate.surahName}، ${candidate.from}–${candidate.to}.\nالمقطع الموجود ${directOverlaps.length ? 'المتداخل' : 'المتجاور'}: ${overlapDescription(overlaps)}.\nيمكنك تعديل النطاق، أو الدمج مع نقل سجلات المراجعة، أو إضافته منفصلًا دون تكرار عدّ الآيات.`,
        { okLabel: 'دمج المقاطع', optionalLabel: exact ? null : 'إضافة منفصلًا', cancelLabel: 'تعديل النطاق', danger: false },
      );
      if (choice === 'cancel') return;
      if (choice === 'ok') {
        const merged = mergeEntries(entries, candidate);
        const nextReviews = reassignReviewEntryIds(reviews, merged.idMap);
        storage.saveReviews(nextReviews);
        try { commitEntries(merged.entries); }
        catch (error) { reviews = nextReviews; throw error; }
        reviews = nextReviews;
        showToast('دُمجت المقاطع مع الاحتفاظ بمصادرها وسجلات مراجعتها.');
      } else {
        commitEntries([...entries, candidate]);
        showToast('أُضيف المقطع منفصلًا؛ ستبقى الآيات الفريدة دون تكرار في الإحصائيات.');
      }
    } else {
      commitEntries([...entries, candidate]);
      showToast('أُضيف المقطع إلى قائمة المراجعة.');
    }
    switchTab('list');
  } catch (error) {
    $('addError').textContent = error.message;
    $('addError').hidden = false;
  } finally {
    button.disabled = false;
  }
}

function startEditEntry(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;
  switchTab('add');
  editingId = id;
  $('addTitle').textContent = 'تعديل المقطع';
  $('saveEntryBtn').textContent = 'حفظ التعديل';
  $('cancelEditBtn').hidden = false;
  $('surahSelect').value = entry.surah;
  $('fromAyah').value = entry.from;
  $('toAyah').value = entry.to;
  $('startDate').value = entry.startDate || entry.dateAdded || '';
  $('masteryInput').value = entry.mastery;
  $('categoryInput').value = entry.category || '';
  $('notesInput').value = entry.notes || '';
  $('wholeSurahBox').checked = false;
  $('addError').hidden = true;
  updateSurahHint();
}

async function deleteEntry(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;
  const linkedCount = reviews.filter((review) => review.entryId === id).length;
  const choice = await showConfirm(
    `حذف ${entry.surahName}، الآيات ${entry.from}–${entry.to}؟\nسيقل عدد الآيات الفريدة بحسب تداخلها مع مقاطع أخرى. سيبقى سجل المراجعات (${linkedCount} سجلًا) ولن يُحذف.`,
    { okLabel: 'حذف المقطع' },
  );
  if (choice !== 'ok') return;
  const index = entries.indexOf(entry);
  try {
    commitEntries(entries.filter((item) => item.id !== id));
    renderList();
    showToast('حُذف المقطع، وبقي سجل المراجعات.', {
      actionLabel: 'تراجع', duration: 8000,
      onAction: () => {
        if (entries.some((item) => item.id === entry.id)) return;
        try {
          const restored = [...entries];
          restored.splice(Math.min(index, restored.length), 0, entry);
          commitEntries(restored);
          renderAll();
          showToast('استُعيد المقطع.');
        } catch (error) { showToast(error.message, { force: true }); }
      },
    });
  } catch (error) { showToast(error.message, { force: true }); }
}

function statBox(value, label) {
  return h('div', { class: 'stat-box' }, h('span', { class: 'num', text: value }), h('span', { class: 'lbl', text: label }));
}

function renderEntryCard(entry, showSurah = false) {
  const info = schedule.get(entry.id);
  const title = `${showSurah ? entry.surahName + ' · ' : ''}الآيات ${entry.from} إلى ${entry.to}`;
  const card = h('article', { class: 'entry-card', attrs: { 'data-entry-id': entry.id } });
  const main = h('div', { class: 'entry-main' },
    h('div', { class: 'entry-marker', text: `${entry.from}–${entry.to}`, attrs: { 'aria-hidden': 'true' } }),
    h('div', { class: 'entry-body' },
      h('div', { class: 'entry-range', text: title }),
      h('div', { class: 'entry-meta', text: `${countUniqueAyahs([entry])} آية · ${masteryLabel(entry.mastery)}${entry.category ? ' · ' + entry.category : ''}` }),
      h('div', { class: 'entry-meta', text: info?.lastReviewedAt ? `آخر مراجعة ${formatDateTime(info.lastReviewedAt)}` : (info?.lastReviewedDate ? `آخر مراجعة ${formatDate(info.lastReviewedDate)}` : 'لم تُراجَع بعد') }),
    ),
  );
  card.append(main);
  const badges = h('div', {},
    h('span', { class: `badge ${info?.isDue ? 'due' : ''}`, text: info?.isDue ? (info.isOverdue ? `متأخر ${info.overdueDays} يوم` : 'مستحق اليوم') : `قادم ${formatDate(info?.dueDate)}` }),
    info?.lastRating ? h('span', { class: `badge ${info.lastRating === 'mastered' ? 'good' : ''}`, text: ratingLabel(info.lastRating) }) : null,
  );
  card.append(badges);
  if (entry.notes) card.append(h('p', { class: 'entry-note', text: entry.notes }));
  card.append(h('div', { class: 'entry-actions' },
    h('button', { class: 'btn btn-primary', text: 'مراجعة', attrs: { 'data-action': 'review', 'data-id': entry.id } }),
    h('button', { class: 'btn btn-ghost', text: 'اختبار الحفظ', attrs: { 'data-action': 'test', 'data-id': entry.id } }),
    h('button', { class: 'btn btn-ghost', text: 'تعديل', attrs: { 'data-action': 'edit', 'data-id': entry.id } }),
    h('button', { class: 'btn btn-ghost', text: 'حذف', attrs: { 'data-action': 'delete', 'data-id': entry.id } }),
  ));
  return card;
}

function renderList() {
  refreshSchedule();
  const stats = computeStats(entries, reviews, settings);
  const strip = clearNode($('listStatsStrip'));
  strip.append(statBox(stats.uniqueAyahs, 'آية فريدة مسجلة'), statBox(stats.entryCount, 'مقطعًا مسجلًا'), statBox(stats.dueCount, 'مستحقًا للمراجعة'));
  const container = clearNode($('listContent'));
  if (!entries.length) {
    container.append(h('div', { class: 'empty-state' }, h('div', { class: 'glyph', text: '﴿ اقرأ ﴾' }), h('p', { text: 'لا توجد مقاطع مسجلة بعد.' }), h('p', { text: 'ابدأ بإضافة أول مقطع تحفظه من القرآن الكريم.' }), h('button', { class: 'btn btn-gold', text: 'إضافة أول مقطع', attrs: { 'data-tab-target': 'add' } })));
    return;
  }
  const options = { query: $('entrySearch').value, mastery: $('masteryFilter').value, sort: $('entrySort').value, needsReview: $('needsReviewFilter').checked };
  const filtered = searchAndSortEntries(entries, options, schedule);
  if (!filtered.length) {
    container.append(h('div', { class: 'empty-state' }, h('p', { text: 'لا توجد نتائج مطابقة.' }), h('p', { text: 'جرّب كلمة أخرى أو أزل عوامل التصفية.' })));
    return;
  }
  if (options.sort === 'surah') {
    const groups = new Map();
    filtered.forEach((entry) => {
      if (!groups.has(entry.surah)) groups.set(entry.surah, []);
      groups.get(entry.surah).push(entry);
    });
    const covered = uniqueAyahMap(entries);
    groups.forEach((groupEntries, surahNumber) => {
      const surah = surahByNumber(surahNumber);
      const group = h('section', { class: 'surah-group' });
      group.append(h('div', { class: 'surah-group-head' }, h('div', { class: 'name', text: surah.name }), h('div', { class: 'progress', text: `${covered.get(surahNumber)?.size || 0} / ${surah.ayahs}` })));
      groupEntries.forEach((entry) => group.append(renderEntryCard(entry)));
      container.append(group);
    });
  } else filtered.forEach((entry) => container.append(renderEntryCard(entry, true)));
}

function renderReviewDashboard() {
  refreshSchedule();
  const stats = computeStats(entries, reviews, settings);
  const summary = clearNode($('dailySummary'));
  summary.append(
    h('div', { class: 'progress-line' }, h('strong', { text: `هدف اليوم: ${stats.todayCount} من ${stats.dailyGoal} جلسات مكتملة` }), h('span', { text: `${Math.round(stats.dailyProgress * 100)}%` })),
    h('div', { class: 'progress-track', attrs: { role: 'progressbar', 'aria-valuenow': stats.todayCount, 'aria-valuemin': 0, 'aria-valuemax': stats.dailyGoal, 'aria-label': 'التقدم نحو الهدف اليومي' } }, h('span', { attrs: { style: `transform:scaleX(${stats.dailyProgress})` } })),
  );
  $('startDailyBtn').disabled = entries.length === 0;
  $('startRandomBtn').disabled = entries.length === 0;
  const filter = $('scheduleFilter').value;
  const filtered = entries.filter((entry) => {
    const info = schedule.get(entry.id);
    if (filter === 'due') return info.isDue;
    if (filter === 'overdue') return info.isOverdue;
    if (filter === 'upcoming') return !info.isDue;
    return true;
  }).sort((a, b) => (schedule.get(b.id)?.priority || 0) - (schedule.get(a.id)?.priority || 0));
  const list = clearNode($('scheduleList'));
  if (!entries.length) {
    list.append(h('div', { class: 'empty-state' }, h('p', { text: 'سجّل أول مقطع ليدخل خطة المراجعة.' }), h('button', { class: 'btn btn-gold', text: 'إضافة مقطع', attrs: { 'data-tab-target': 'add' } })));
  } else if (!filtered.length) {
    list.append(h('div', { class: 'empty-state' }, h('p', { text: filter === 'due' ? 'لا توجد مقاطع مستحقة اليوم.' : 'لا توجد مقاطع في هذه القائمة.' })));
  } else filtered.forEach((entry) => list.append(renderScheduleItem(entry)));
  renderReviewHistory();
}

function renderScheduleItem(entry) {
  const info = schedule.get(entry.id);
  const item = h('article', { class: 'schedule-item' });
  item.append(
    h('h3', { text: `${entry.surahName} · ${entry.from}–${entry.to}` }),
    h('p', { text: `${info.isOverdue ? `متأخر ${info.overdueDays} يوم · ` : ''}الموعد: ${formatDate(info.dueDate)} · ${info.lastRating ? ratingLabel(info.lastRating) : masteryLabel(entry.mastery)}` }),
  );
  const dateInput = h('input', { attrs: { type: 'date', 'aria-label': `موعد جديد لسورة ${entry.surahName}`, 'data-reschedule-date': entry.id } });
  item.append(h('div', { class: 'schedule-actions' },
    h('button', { class: 'btn btn-primary', text: 'ابدأ المراجعة', attrs: { 'data-schedule-action': 'review', 'data-id': entry.id } }),
    h('button', { class: 'btn btn-ghost', text: 'تأجيل 3 أيام', attrs: { 'data-schedule-action': 'postpone', 'data-id': entry.id } }),
    dateInput,
    h('button', { class: 'btn btn-ghost', text: 'إعادة جدولة', attrs: { 'data-schedule-action': 'reschedule', 'data-id': entry.id } }),
  ));
  return item;
}

function renderReviewHistory() {
  const container = clearNode($('reviewHistory'));
  const sorted = [...reviews].sort((a, b) => (b.completedAt || b.startedAt).localeCompare(a.completedAt || a.startedAt)).slice(0, 25);
  if (!sorted.length) {
    container.append(h('p', { class: 'stat-note', text: 'لا يوجد سجل مراجعات بعد.' }));
    return;
  }
  const modeNames = { normal: 'عادية', test: 'اختبار', random: 'عشوائية', surah: 'سورة محددة', daily: 'يومية' };
  sorted.forEach((review) => {
    const item = h('article', { class: 'history-item' },
      h('strong', { text: `${review.snapshot.surahName} · ${review.snapshot.from}–${review.snapshot.to}` }),
      h('span', { text: `${formatDateTime(review.completedAt || review.startedAt)} · ${modeNames[review.mode]} · ${review.status === 'completed' ? ratingLabel(review.rating) : 'غير مكتملة'} · المدة ${formatDuration(review.durationSeconds)}` }),
    );
    if (review.notes) item.append(h('p', { text: review.notes }));
    container.append(item);
  });
}

async function handleScheduleAction(action, id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;
  if (action === 'review') { openSessionForEntry(entry, 'normal'); return; }
  try {
    const result = action === 'postpone'
      ? postponeEntry(entry, 3)
      : rescheduleEntry(entry, $(`scheduleList`).querySelector(`[data-reschedule-date="${CSS.escape(id)}"]`)?.value);
    const nextEntries = entries.map((item) => item.id === id ? result.entry : item);
    const nextEvents = [...scheduleEvents, result.event];
    storage.saveScheduleEvents(nextEvents);
    try { storage.saveEntries(nextEntries); }
    catch (error) {
      try { storage.saveScheduleEvents(scheduleEvents); } catch { /* يظل الخطأ الأصلي ظاهرًا للمستخدم. */ }
      throw error;
    }
    scheduleEvents = nextEvents;
    entries = nextEntries;
    refreshSchedule();
    renderReviewDashboard();
    showToast(action === 'postpone' ? 'أُجّل المقطع ثلاثة أيام وسُجل التأجيل.' : 'أُعيدت جدولة المقطع وسُجل التغيير.');
  } catch (error) { showToast(error.message, { force: true }); }
}

function startDailyReview() {
  const candidates = dailyCandidates(entries, schedule, settings.suggestedCount);
  if (!candidates.length) { showToast('أضف مقطعًا أولًا لبدء جلسة يومية.', { force: true }); return; }
  activeQueue = { type: 'daily', items: candidates, index: 0, completed: [] };
  openSessionForEntry(candidates[0], 'daily', 'daily');
}

function startRandomReview() {
  const entry = weightedRandomEntry(entries, schedule, randomExcluded);
  if (!entry) { randomExcluded.clear(); showToast('استُعرضت كل المقاطع؛ بدأنا دورة عشوائية جديدة.'); return; }
  randomExcluded.add(entry.id);
  activeQueue = null;
  openSessionForEntry(entry, 'random');
}

function openSessionForEntry(entry, mode = 'normal', queueId = null) {
  openReviewSession({ entry, snapshot: entry, mode, queueId });
}

async function openReviewSession({ entry = null, snapshot, mode = 'normal', queueId = null }) {
  if ($('reviewOverlay').hidden) lastFocusedElement = document.activeElement;
  if (session && !['completed', 'cancelled'].includes(session.status)) {
    sessionController?.abort();
  }
  clearSessionTimer();
  const token = ++sessionToken;
  sessionController = new AbortController();
  session = new ReviewSession({ entry, snapshot, mode, queueId });
  hiddenTest = mode === 'test';
  session.tested = hiddenTest;
  revealedAyahs = new Set();
  $('sessionTitle').textContent = snapshot.surahName;
  const queueProgress = activeQueue ? ` · ${activeQueue.index + 1} من ${activeQueue.items.length}` : '';
  $('reviewSubtitle').textContent = `الآيات ${snapshot.from} إلى ${snapshot.to}${queueProgress}`;
  $('reviewBody').replaceChildren(h('div', { class: 'review-loading', text: 'جارٍ تحميل الآيات والتحقق منها…', attrs: { role: 'status' } }));
  $('reviewOverlay').hidden = false;
  $('app').inert = true;
  document.body.style.overflow = 'hidden';
  $('reviewFooter').hidden = false;
  $('evaluationPanel').hidden = true;
  $('sessionResult').hidden = true;
  $('finishSessionBtn').disabled = true;
  $('reviewCloseBtn').disabled = false;
  $('toggleHideBtn').disabled = true;
  $('revealAllBtn').disabled = true;
  $('toggleHideBtn').classList.toggle('on', hiddenTest);
  $('toggleHideBtn').textContent = hiddenTest ? 'إظهار النص' : 'إخفاء النص للاختبار';
  $('reviewNotes').value = '';
  $('reviewSaveError').hidden = true;
  document.querySelectorAll('input[name="reviewRating"]').forEach((input) => { input.checked = false; input.disabled = false; });
  startSessionTimer();
  $('reviewCloseBtn').focus();
  try {
    const ayahs = await quranApi.getRange(snapshot.surah, snapshot.from, snapshot.to, { signal: sessionController.signal });
    if (token !== sessionToken || !session || session.status !== 'loading') return;
    if (!session.markReady(ayahs)) throw new Error('النص المحمّل لا يطابق النطاق المطلوب.');
    renderSessionAyahs();
    $('finishSessionBtn').disabled = false;
    $('toggleHideBtn').disabled = false;
    $('revealAllBtn').disabled = false;
    if (quranApi.lastCacheWarning) { showToast(quranApi.lastCacheWarning, { force: true }); quranApi.lastCacheWarning = null; }
  } catch (error) {
    if (token !== sessionToken || !session || error.code === 'aborted') return;
    session.markFailed();
    const box = h('div', { class: 'review-error', attrs: { role: 'alert' } },
      h('p', { text: error.message || 'تعذر تحميل النص.' }),
      h('p', { text: 'لم تُسجل أي مراجعة. يمكنك المحاولة مجددًا أو إغلاق الجلسة.' }),
      h('button', { class: 'btn btn-ghost', text: 'إعادة المحاولة', attrs: { 'data-review-action': 'retry' } }),
    );
    $('reviewBody').replaceChildren(box);
    $('finishSessionBtn').disabled = true;
    $('toggleHideBtn').disabled = true;
    $('revealAllBtn').disabled = true;
  }
}

function renderSessionAyahs() {
  if (!session?.contentReady) return;
  const container = h('div', { class: 'quran-text', attrs: { style: `--quran-font-size:${settings.quranFontSize}px` } });
  session.ayahs.forEach((ayah) => {
    if (hiddenTest && !revealedAyahs.has(ayah.number)) {
      // الإخفاء هنا لإجراء الاختبار فقط، وليس حماية أمنية؛ النص يبقى في ذاكرة الجلسة.
      // أزلنا النص فعليًا من DOM كي لا يظهر في التمويه أو المعاينة أو قارئ الشاشة.
      container.append(h('div', { class: 'hidden-ayah' },
        h('span', { text: `الآية ${ayah.number} مخفية. سمّعها ثم اكشفها للتحقق.` }),
        h('button', { class: 'btn btn-ghost', text: 'كشف الآية', attrs: { 'data-reveal-ayah': ayah.number } }),
      ));
    } else {
      container.append(h('p', { class: 'ayah-line' },
        h('span', { class: 'ayah-text', text: ayah.text }),
        h('span', { class: 'ayah-num', text: ayah.number, attrs: { 'aria-label': `رقم الآية ${ayah.number}` } }),
      ));
    }
  });
  $('reviewBody').replaceChildren(container);
}

function toggleSessionHidden() {
  if (!session?.contentReady) return;
  hiddenTest = !hiddenTest;
  if (hiddenTest) { revealedAyahs.clear(); session.tested = true; }
  $('toggleHideBtn').classList.toggle('on', hiddenTest);
  $('toggleHideBtn').textContent = hiddenTest ? 'إظهار النص' : 'إخفاء النص للاختبار';
  renderSessionAyahs();
}

function revealAllAyahs() {
  if (!session?.contentReady) return;
  hiddenTest = false;
  revealedAyahs = new Set(session.ayahs.map((ayah) => ayah.number));
  $('toggleHideBtn').classList.remove('on');
  $('toggleHideBtn').textContent = 'إخفاء النص للاختبار';
  renderSessionAyahs();
}

function startSessionTimer() {
  clearSessionTimer();
  updateSessionTimer();
  sessionTimerInterval = setInterval(updateSessionTimer, 1000);
}

function clearSessionTimer() {
  if (sessionTimerInterval !== null) clearInterval(sessionTimerInterval);
  sessionTimerInterval = null;
}

function updateSessionTimer() {
  if (!session || ['completed', 'cancelled'].includes(session.status)) return;
  const seconds = session.durationSeconds();
  $('sessionTimer').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

async function closeReviewSession() {
  if (!session || session.completionPending) return;
  const focusOrigin = lastFocusedElement;
  const closingSession = session;
  const token = ++sessionToken;
  sessionController?.abort();
  clearSessionTimer();
  const incomplete = closingSession.cancel();
  session = null;
  $('reviewOverlay').hidden = true;
  $('app').inert = false;
  document.body.style.overflow = '';
  activeQueue = null;
  if (incomplete) {
    try {
      const nextReviews = [...reviews, incomplete];
      storage.saveReviews(nextReviews);
      reviews = nextReviews;
      refreshSchedule();
      showToast('أُغلقت الجلسة دون احتسابها مكتملة.');
    } catch (error) { showToast(`أُغلقت الجلسة، لكن تعذر حفظ حالتها غير المكتملة: ${error.message}`, { force: true }); }
  }
  if (currentTab === 'review') renderReviewDashboard();
  if (currentTab === 'list') renderList();
  let focusTarget = focusOrigin;
  if (!focusTarget?.isConnected && focusOrigin?.dataset?.action && focusOrigin?.dataset?.id) {
    focusTarget = document.querySelector(`[data-action="${CSS.escape(focusOrigin.dataset.action)}"][data-id="${CSS.escape(focusOrigin.dataset.id)}"]`);
  }
  if (!focusTarget?.isConnected && focusOrigin?.dataset?.scheduleAction && focusOrigin?.dataset?.id) {
    focusTarget = document.querySelector(`[data-schedule-action="${CSS.escape(focusOrigin.dataset.scheduleAction)}"][data-id="${CSS.escape(focusOrigin.dataset.id)}"]`);
  }
  if (!focusTarget?.isConnected && focusOrigin?.id) focusTarget = document.getElementById(focusOrigin.id);
  if (focusTarget?.isConnected) focusTarget.focus();
  else $('mainContent').focus();
}

function showEvaluationPanel() {
  if (!session?.contentReady || session.status !== 'ready') return;
  $('evaluationPanel').hidden = false;
  $('reviewFooter').hidden = true;
  document.querySelector('input[name="reviewRating"]')?.focus();
}

async function saveReviewResult(event) {
  event.preventDefault();
  if (!session || session.completionPending) return;
  const rating = document.querySelector('input[name="reviewRating"]:checked')?.value;
  const saveButton = $('saveReviewBtn');
  let record;
  try {
    record = session.beginCompletion(rating, $('reviewNotes').value.trim());
    if (!record) return;
    saveButton.disabled = true;
    $('reviewCloseBtn').disabled = true;
    $('reviewSaveError').hidden = true;
    const nextReviews = [...reviews, record];
    storage.saveReviews(nextReviews);
    reviews = nextReviews;
    session.finishCompletion();
    refreshSchedule();
    if (activeQueue) activeQueue.completed.push(record);
    showSessionResult(record);
    showToast('سُجلت نتيجة المراجعة بنجاح.');
  } catch (error) {
    session?.failCompletion();
    $('reviewSaveError').textContent = error.message;
    $('reviewSaveError').hidden = false;
  } finally {
    saveButton.disabled = false;
    if (session && session.status !== 'completed') $('reviewCloseBtn').disabled = false;
  }
}

function showSessionResult(record) {
  clearSessionTimer();
  $('evaluationPanel').hidden = true;
  $('reviewFooter').hidden = true;
  $('toggleHideBtn').disabled = true;
  $('revealAllBtn').disabled = true;
  const result = clearNode($('sessionResult'));
  result.hidden = false;
  result.append(h('h3', { text: 'اكتملت الجلسة وسُجلت نتيجتها' }), h('p', { text: `${ratingLabel(record.rating)} · المدة ${formatDuration(record.durationSeconds)}` }));
  if (activeQueue && activeQueue.index < activeQueue.items.length - 1) {
    result.append(h('p', { text: `أنجزت ${activeQueue.completed.length} من ${activeQueue.items.length} مقاطع في هذه الجلسة.` }));
    result.append(h('div', { class: 'button-row' },
      h('button', { class: 'btn btn-primary', text: 'المقطع التالي', attrs: { 'data-result-action': 'next' } }),
      h('button', { class: 'btn btn-ghost', text: 'إنهاء الجلسة', attrs: { 'data-result-action': 'close' } }),
    ));
  } else {
    if (activeQueue) result.append(h('p', { text: `ملخص الجلسة: ${activeQueue.completed.length} مراجعات مكتملة. لا تُحتسب الجلسات المغلقة قبل التقييم.` }));
    const buttons = h('div', { class: 'button-row' }, h('button', { class: 'btn btn-primary', text: 'العودة إلى التطبيق', attrs: { 'data-result-action': 'close' } }));
    if (record.mode === 'random') buttons.prepend(h('button', { class: 'btn btn-gold', text: 'مقطع عشوائي آخر', attrs: { 'data-result-action': 'random' } }));
    result.append(buttons);
  }
  result.querySelector('button')?.focus();
  if (currentTab === 'review') renderReviewDashboard();
}

function openNextQueuedSession() {
  if (!activeQueue) return;
  activeQueue.index += 1;
  const item = activeQueue.items[activeQueue.index];
  if (activeQueue.type === 'daily') openSessionForEntry(item, 'daily', activeQueue.type);
  else openReviewSession({ snapshot: item, mode: 'surah', queueId: activeQueue.type });
}

function retrySession() {
  if (!session) return;
  const snapshot = session.snapshot;
  const entry = entries.find((item) => item.id === session.entryId) || null;
  const mode = session.mode;
  const queueId = session.queueId;
  openReviewSession({ entry, snapshot, mode, queueId });
}

function handleSurahReviewSubmit(event) {
  event.preventDefault();
  const surah = surahByNumber(Number($('reviewSurahSelect').value));
  const from = Number($('reviewFromAyah').value);
  const to = Number($('reviewToAyah').value);
  const validation = validateEntryInput({ surah: surah?.n, from, to });
  if (!validation.valid) { showToast(validation.error, { force: true }); return; }
  const chunkSize = Number($('reviewChunkSize')?.value || 0);
  const items = [];
  if (chunkSize > 0) {
    for (let start = from; start <= to; start += chunkSize) {
      items.push({ surah: surah.n, surahName: surah.name, from: start, to: Math.min(to, start + chunkSize - 1) });
    }
  } else items.push({ surah: surah.n, surahName: surah.name, from, to });
  activeQueue = { type: 'surah', items, index: 0, completed: [] };
  $('surahRangePanel').hidden = true;
  openReviewSession({ snapshot: items[0], mode: 'surah', queueId: 'surah' });
}

function renderStats() {
  const stats = computeStats(entries, reviews, settings);
  const container = clearNode($('statsContent'));
  if (!entries.length && !reviews.length) {
    container.append(h('div', { class: 'empty-state' }, h('div', { class: 'glyph', text: '﴿ ﴾' }), h('p', { text: 'أضف أول محفوظاتك أو أكمل مراجعة لتظهر الإحصائيات.' })));
    return;
  }
  const grid = h('div', { class: 'stats-grid' },
    statBox(stats.surahCount, 'سورة تحتوي محفوظات'),
    statBox(stats.uniqueAyahs, 'آية فريدة مسجلة'),
    statBox(stats.entryCount, 'مقطعًا مسجلًا'),
    statBox(stats.completedSessions, 'جلسة مراجعة مكتملة'),
    statBox(stats.testedAyahs, 'آية فريدة اختُبر حفظها'),
    statBox(stats.masteredEntries, 'مقطعًا متقنًا بتقييم يدوي'),
    statBox(stats.dueCount, 'مقطعًا مستحقًا'),
    statBox(stats.overdueCount, 'مقطعًا متأخرًا'),
    statBox(stats.streak, 'يومًا متتابعًا ينتهي اليوم'),
  );
  container.append(grid);
  container.append(h('p', { class: 'stat-note', text: stats.lastReviewedAt ? `آخر مراجعة مكتملة: ${formatDateTime(stats.lastReviewedAt)}` : 'لا توجد مراجعة مكتملة بعد.' }));
  container.append(h('h2', { text: 'النشاط خلال آخر 7 أيام' }));
  const chart = h('div', { class: 'activity-chart', attrs: { role: 'img', 'aria-label': stats.activity.map((day) => `${day.date}: ${day.count} جلسات`).join('، ') } });
  const max = Math.max(1, ...stats.activity.map((day) => day.count));
  stats.activity.forEach((day) => {
    const date = new Date(`${day.date}T12:00:00`);
    const label = new Intl.DateTimeFormat('ar', { weekday: 'short' }).format(date);
    chart.append(h('div', { class: 'activity-day', attrs: { title: `${day.date}: ${day.count}` } },
      h('span', { text: day.count }),
      h('span', { class: 'activity-bar', attrs: { style: `height:${Math.max(3, day.count / max * 85)}%` } }),
      h('span', { text: label }),
    ));
  });
  container.append(chart);
  container.append(h('p', { class: 'stat-note', text: 'فترة متحركة تشمل اليوم والأيام الستة السابقة؛ تستبعد الجلسات الملغاة والتواريخ المستقبلية.' }));
  container.append(h('h2', { text: 'الأهداف' }));
  container.append(
    h('p', { class: 'stat-note', text: `اليوم: ${stats.todayCount} من ${stats.dailyGoal} جلسات مكتملة.` }),
    h('div', { class: 'progress-track' }, h('span', { attrs: { style: `transform:scaleX(${stats.dailyProgress})` } })),
    h('p', { class: 'stat-note', text: `آخر 7 أيام: ${stats.weekCount} من ${stats.weeklyGoal} جلسات مكتملة.` }),
    h('div', { class: 'progress-track' }, h('span', { attrs: { style: `transform:scaleX(${stats.weeklyProgress})` } })),
    h('p', { class: 'stat-note', text: '«المتقن» يعتمد على آخر تقييم يدوي، أو تقييمك للمقطع إذا لم يراجع. تسجيل الآيات وحده لا يثبت الحفظ أو الإتقان.' }),
  );
}

function fillSettingsForm() {
  $('themeSetting').value = settings.theme;
  $('defaultSortSetting').value = settings.defaultSort;
  $('dailyGoalSetting').value = settings.dailyGoal;
  $('weeklyGoalSetting').value = settings.weeklyGoal;
  $('suggestedCountSetting').value = settings.suggestedCount;
  $('fontSizeSetting').value = settings.quranFontSize;
  $('notificationsSetting').checked = settings.notifications;
  $('intervalMastered').value = settings.intervals.mastered;
  $('intervalGood').value = settings.intervals.good;
  $('intervalSoon').value = settings.intervals.soon;
  $('intervalFailed').value = settings.intervals.failed;
  $('intervalNew').value = settings.intervals.newEntry;
}

function handleSettingsSubmit(event) {
  event.preventDefault();
  const next = validateSettings({
    theme: $('themeSetting').value,
    defaultSort: $('defaultSortSetting').value,
    dailyGoal: Number($('dailyGoalSetting').value),
    weeklyGoal: Number($('weeklyGoalSetting').value),
    suggestedCount: Number($('suggestedCountSetting').value),
    quranFontSize: Number($('fontSizeSetting').value),
    notifications: $('notificationsSetting').checked,
    intervals: {
      mastered: Number($('intervalMastered').value),
      good: Number($('intervalGood').value),
      soon: Number($('intervalSoon').value),
      failed: Number($('intervalFailed').value),
      newEntry: Number($('intervalNew').value),
    },
  });
  try {
    settings = saveSettings(storage, next);
    applyTheme(settings.theme);
    $('entrySort').value = settings.defaultSort;
    refreshSchedule();
    showToast('حُفظت الإعدادات.');
  } catch (error) { showToast(error.message, { force: true }); }
}

function exportUserData() {
  try {
    downloadJson(createBackup({ entries, reviews, settings, scheduleEvents }));
    showToast('جُهّزت النسخة الاحتياطية للتنزيل.');
  } catch (error) { showToast(`تعذر التصدير: ${error.message}`, { force: true }); }
}

async function handleImportFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    pendingImport = await readBackupFile(file);
    $('importSummary').textContent = `ملف صالح: ${pendingImport.entries.length} مقاطع، ${pendingImport.reviews.length} مراجعات. اختر الدمج أو الاستبدال.`;
    $('importOptions').hidden = false;
    const unsafeMerge = [STORAGE_KEYS.entries, STORAGE_KEYS.reviews, STORAGE_KEYS.schedule].some((key) => storage.readOnlyKeys.has(key));
    $('mergeImportBtn').disabled = unsafeMerge;
    if (unsafeMerge) $('importSummary').textContent += ' الدمج غير متاح مع بيانات تالفة؛ الاستبدال الصريح فقط بعد أخذ نسخة إنقاذ.';
  } catch (error) {
    pendingImport = null;
    $('importOptions').hidden = true;
    showToast(`تعذر الاستيراد: ${error.message}`, { force: true, duration: 6000 });
    event.target.value = '';
  }
}

function writeImportedData(nextData) {
  const current = { entries, reviews, settings, scheduleEvents };
  const rescue = { backup: createBackup(current), rawStorage: storage.rawUserData(), savedAt: new Date().toISOString() };
  storage.writeJson(STORAGE_KEYS.preImportBackup, rescue);
  const touched = [STORAGE_KEYS.entries, STORAGE_KEYS.reviews, STORAGE_KEYS.settings, STORAGE_KEYS.schedule];
  // فتح الكتابة هنا قرار استيراد صريح من المستخدم، بعد حفظ البيانات الخام للإنقاذ.
  touched.forEach((key) => storage.readOnlyKeys.delete(key));
  try {
    storage.saveEntries(nextData.entries);
    storage.saveReviews(nextData.reviews);
    storage.writeJson(STORAGE_KEYS.settings, nextData.settings);
    storage.saveScheduleEvents(nextData.scheduleEvents);
  } catch (error) {
    try {
      storage.saveEntries(current.entries);
      storage.saveReviews(current.reviews);
      storage.writeJson(STORAGE_KEYS.settings, current.settings);
      storage.saveScheduleEvents(current.scheduleEvents);
    } catch { /* نسخة ما قبل الاستيراد والبيانات الخام محفوظتان للاستعادة اليدوية. */ }
    throw new Error(`فشل الاستيراد وأُعيدت البيانات السابقة قدر الإمكان: ${error.message}`);
  }
  entries = nextData.entries;
  reviews = nextData.reviews;
  settings = validateSettings(nextData.settings);
  scheduleEvents = nextData.scheduleEvents;
  storage.warnings = [];
  refreshSchedule();
  applyTheme(settings.theme);
  renderAll();
}

async function mergePendingImport() {
  if (!pendingImport) return;
  const merged = mergeBackupData({ entries, reviews, settings, scheduleEvents }, pendingImport);
  try {
    writeImportedData(merged.data);
    showToast(`اكتمل الدمج: أُضيف ${merged.added.entries} مقاطع و${merged.added.reviews} مراجعة، وتُركت التكرارات.`, { duration: 6000 });
    clearPendingImport();
  } catch (error) { showToast(error.message, { force: true, duration: 7000 }); }
}

async function replacePendingImport() {
  if (!pendingImport) return;
  const choice = await showConfirm('سيُستبدل المحتوى الحالي بمحتوى الملف. ستُنزّل نسخة احتياطية أولًا، وتُحفظ نسخة إنقاذ محلية. هل تريد المتابعة؟', { okLabel: 'استبدال البيانات' });
  if (choice !== 'ok') return;
  try {
    downloadJson(createBackup({ entries, reviews, settings, scheduleEvents }), `sahib-before-import-${localDateKey()}.json`);
    writeImportedData(pendingImport);
    showToast('استُعيدت النسخة واستُبدلت البيانات بعد إنشاء نسخة احتياطية.');
    clearPendingImport();
  } catch (error) { showToast(error.message, { force: true, duration: 7000 }); }
}

function clearPendingImport() {
  pendingImport = null;
  $('importOptions').hidden = true;
  $('importFile').value = '';
}

function renderAll() {
  refreshSchedule();
  renderList();
  if (currentTab === 'review') renderReviewDashboard();
  if (currentTab === 'stats') renderStats();
  if (currentTab === 'settings') fillSettingsForm();
  renderStorageWarnings();
}

function updateConnectionStatus() {
  const online = navigator.onLine;
  $('connectionStatus').textContent = online ? 'متصل' : 'دون اتصال';
  $('connectionStatus').classList.toggle('offline', !online);
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  try {
    const registration = await navigator.serviceWorker.register('./service-worker.js');
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          showToast('يتوفر تحديث للتطبيق.', { actionLabel: 'تحديث', duration: 10000, onAction: () => { worker.postMessage({ type: 'SKIP_WAITING' }); } });
        }
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
  } catch {
    $('installHelp').textContent = 'التثبيت والعمل دون اتصال يحتاجان تشغيل التطبيق عبر HTTPS أو localhost، وليس فتح الملف مباشرة.';
  }
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const tabButton = event.target.closest('[data-tab], [data-tab-target]');
    if (tabButton) switchTab(tabButton.dataset.tab || tabButton.dataset.tabTarget, { resetAdd: (tabButton.dataset.tab || tabButton.dataset.tabTarget) === 'add' });
  });
  $('themeToggleBtn').addEventListener('click', () => applyTheme(settings.theme === 'dark' ? 'light' : 'dark', true));
  $('entryForm').addEventListener('submit', handleEntrySubmit);
  $('surahSelect').addEventListener('change', updateSurahHint);
  $('wholeSurahBox').addEventListener('change', updateSurahHint);
  $('cancelEditBtn').addEventListener('click', () => { resetEntryForm(); switchTab('list'); });
  $('listContent').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === 'review' || action === 'test') {
      const entry = entries.find((item) => item.id === id);
      if (entry) { activeQueue = null; openSessionForEntry(entry, action === 'test' ? 'test' : 'normal'); }
    }
    if (action === 'edit') startEditEntry(id);
    if (action === 'delete') deleteEntry(id);
  });
  ['entrySearch', 'masteryFilter', 'entrySort', 'needsReviewFilter'].forEach((id) => $(id).addEventListener(id === 'entrySearch' ? 'input' : 'change', debounce(renderList, 120)));
  $('scheduleFilter').addEventListener('change', renderReviewDashboard);
  $('scheduleList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-schedule-action]');
    if (button) handleScheduleAction(button.dataset.scheduleAction, button.dataset.id);
  });
  $('startDailyBtn').addEventListener('click', startDailyReview);
  $('startRandomBtn').addEventListener('click', () => { if (!session) startRandomReview(); });
  $('openSurahReviewBtn').addEventListener('click', () => { $('surahRangePanel').hidden = !$('surahRangePanel').hidden; });
  $('cancelSurahReview').addEventListener('click', () => { $('surahRangePanel').hidden = true; });
  $('surahReviewForm').addEventListener('submit', handleSurahReviewSubmit);
  $('reviewSurahSelect').addEventListener('change', () => {
    const surah = surahByNumber(Number($('reviewSurahSelect').value));
    $('reviewFromAyah').max = surah.ayahs;
    $('reviewToAyah').max = surah.ayahs;
    $('reviewFromAyah').value = 1;
    $('reviewToAyah').value = surah.ayahs;
  });
  $('reviewCloseBtn').addEventListener('click', closeReviewSession);
  $('toggleHideBtn').addEventListener('click', toggleSessionHidden);
  $('revealAllBtn').addEventListener('click', revealAllAyahs);
  $('reviewBody').addEventListener('click', (event) => {
    const reveal = event.target.closest('[data-reveal-ayah]');
    if (reveal) { revealedAyahs.add(Number(reveal.dataset.revealAyah)); renderSessionAyahs(); }
    if (event.target.closest('[data-review-action="retry"]')) retrySession();
  });
  $('finishSessionBtn').addEventListener('click', showEvaluationPanel);
  $('backToSessionBtn').addEventListener('click', () => { $('evaluationPanel').hidden = true; $('reviewFooter').hidden = false; $('finishSessionBtn').focus(); });
  $('evaluationPanel').addEventListener('submit', saveReviewResult);
  $('sessionResult').addEventListener('click', (event) => {
    const action = event.target.closest('[data-result-action]')?.dataset.resultAction;
    if (action === 'next') openNextQueuedSession();
    if (action === 'random') startRandomReview();
    if (action === 'close') closeReviewSession();
  });
  document.addEventListener('visibilitychange', () => {
    if (!session) return;
    if (document.hidden) session.pause();
    else session.resume();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Tab' && session && !$('reviewOverlay').hidden) {
      const focusable = [...$('reviewOverlay').querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((element) => !element.hidden && !element.closest('[hidden]') && element.getClientRects().length);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !$('reviewOverlay').contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !$('reviewOverlay').contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }
    if (event.key === 'Escape' && session && $('evaluationPanel').hidden && $('sessionResult').hidden) closeReviewSession();
  });
  $('settingsForm').addEventListener('submit', handleSettingsSubmit);
  $('exportBtn').addEventListener('click', exportUserData);
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', handleImportFile);
  $('mergeImportBtn').addEventListener('click', mergePendingImport);
  $('replaceImportBtn').addEventListener('click', replacePendingImport);
  $('downloadRawBtn').addEventListener('click', () => downloadJson({ exportedAt: new Date().toISOString(), raw: storage.rawUserData() }, `sahib-raw-rescue-${localDateKey()}.json`));
  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredInstallPrompt = event; $('installBtn').hidden = false; });
  $('installBtn').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $('installBtn').hidden = true;
  });
}

function init() {
  populateSurahSelects();
  applyTheme(settings.theme);
  $('entrySort').value = settings.defaultSort;
  $('todayHint').textContent = formatDate(localDateKey());
  $('appVersion').textContent = APP_VERSION;
  $('reviewToAyah').value = surahByNumber(1).ayahs;
  resetEntryForm();
  bindEvents();
  updateConnectionStatus();
  renderAll();
  registerServiceWorker();
}

init();
