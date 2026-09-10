// =====================================================================
// محفظتي — رفيق حفظ القرآن الكريم
// تخزين محلي بالكامل على الجهاز (localStorage) + جلب نصوص الآيات من
// واجهة Al Quran Cloud API عند الحاجة للمراجعة فقط.
// =====================================================================

const STORAGE_KEY = 'quran_hifz_entries_v1';
const CACHE_KEY = 'quran_text_cache_v1';
const API_BASE = 'https://api.alquran.cloud/v1';
const EDITION = 'quran-uthmani';

let entries = loadEntries();
let textCache = loadCache();
let currentReviewEntry = null;
let hideTestMode = false;

// ---------------------------------------------------------------
// تخزين
// ---------------------------------------------------------------
function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}
function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}
function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}
function saveCache() {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(textCache)); }
  catch (e) { /* قد تمتلئ المساحة، تجاهل بصمت */ }
}

function surahByNumber(n) {
  return SURAHS.find(s => s.n === n);
}

// ---------------------------------------------------------------
// أدوات عامة
// ---------------------------------------------------------------
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function formatDate(iso) {
  if (!iso) return 'لم تُراجَع بعد';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' });
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

// ---------------------------------------------------------------
// التنقل بين التبويبات
// ---------------------------------------------------------------
function switchTab(tab) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + tab).classList.add('active');
  document.querySelectorAll('nav.bottom button').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  if (tab === 'list') renderList();
  if (tab === 'stats') renderStats();
  if (tab === 'add') resetAddForm();
}
document.querySelectorAll('nav.bottom button').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ---------------------------------------------------------------
// تبويب: إضافة حفظ جديد
// ---------------------------------------------------------------
const surahSelect = document.getElementById('surahSelect');
SURAHS.forEach(s => {
  const opt = document.createElement('option');
  opt.value = s.n;
  opt.textContent = `${s.n}. ${s.name}`;
  surahSelect.appendChild(opt);
});

function resetAddForm() {
  document.getElementById('addError').classList.remove('show');
  document.getElementById('fromAyah').value = 1;
  document.getElementById('toAyah').value = 1;
  document.getElementById('wholeSurahBox').checked = false;
  updateSurahHint();
}
function updateSurahHint() {
  const s = surahByNumber(parseInt(surahSelect.value, 10));
  document.getElementById('surahAyahHint').textContent = s ? `عدد آيات هذه السورة: ${s.ayahs}` : '';
  document.getElementById('fromAyah').max = s ? s.ayahs : 286;
  document.getElementById('toAyah').max = s ? s.ayahs : 286;
  if (document.getElementById('wholeSurahBox').checked && s) {
    document.getElementById('fromAyah').value = 1;
    document.getElementById('toAyah').value = s.ayahs;
  }
}
surahSelect.addEventListener('change', updateSurahHint);
document.getElementById('wholeSurahBox').addEventListener('change', updateSurahHint);
updateSurahHint();

document.getElementById('saveEntryBtn').addEventListener('click', () => {
  const surahNum = parseInt(surahSelect.value, 10);
  const s = surahByNumber(surahNum);
  const from = parseInt(document.getElementById('fromAyah').value, 10);
  const to = parseInt(document.getElementById('toAyah').value, 10);
  const errBox = document.getElementById('addError');

  if (!from || !to || from < 1 || to < 1 || from > s.ayahs || to > s.ayahs) {
    errBox.textContent = `فضلاً أدخل أرقام آيات صحيحة بين 1 و${s.ayahs}.`;
    errBox.classList.add('show');
    return;
  }
  if (from > to) {
    errBox.textContent = 'رقم آية البداية يجب أن يكون أصغر من أو يساوي رقم النهاية.';
    errBox.classList.add('show');
    return;
  }
  errBox.classList.remove('show');

  entries.push({
    id: 'e' + Date.now() + Math.floor(Math.random() * 1000),
    surah: surahNum,
    surahName: s.name,
    from, to,
    dateAdded: todayStr(),
    lastReviewed: null,
    reviewCount: 0
  });
  saveEntries();
  showToast('تم الحفظ في قائمة المراجعة');
  switchTab('list');
});

// ---------------------------------------------------------------
// تبويب: محفوظاتي (القائمة)
// ---------------------------------------------------------------
function coveredMap() {
  // خريطة: رقم السورة -> مجموعة أرقام الآيات المحفوظة (لتفادي تكرار العد عند تداخل النطاقات)
  const map = new Map();
  entries.forEach(e => {
    if (!map.has(e.surah)) map.set(e.surah, new Set());
    const set = map.get(e.surah);
    for (let i = e.from; i <= e.to; i++) set.add(i);
  });
  return map;
}

function renderList() {
  const container = document.getElementById('listContent');
  const stripEl = document.getElementById('listStatsStrip');

  if (entries.length === 0) {
    stripEl.innerHTML = '';
    container.innerHTML = `
      <div class="empty-state">
        <div class="glyph">﴿ ٱقْرَأْ ﴾</div>
        <p>لا توجد آيات محفوظة بعد.</p>
        <p>ابدأ بإضافة أول مقطع تحفظه من القرآن الكريم.</p>
        <button class="btn btn-gold" onclick="switchTab('add')" style="width:auto; padding:12px 24px;">إضافة الآن</button>
      </div>`;
    return;
  }

  const cov = coveredMap();
  let totalAyat = 0;
  cov.forEach(set => totalAyat += set.size);
  let completedSurahs = 0;
  cov.forEach((set, surahNum) => {
    const s = surahByNumber(surahNum);
    if (s && set.size >= s.ayahs) completedSurahs++;
  });

  stripEl.innerHTML = `
    <div class="stat-box"><span class="num">${totalAyat}</span><span class="lbl">آية محفوظة</span></div>
    <div class="stat-box"><span class="num">${completedSurahs}</span><span class="lbl">سورة كاملة</span></div>
    <div class="stat-box"><span class="num">${cov.size}</span><span class="lbl">سورة قيد الحفظ</span></div>
  `;

  // تجميع حسب السورة، مرتبة برقم السورة
  const bySurah = new Map();
  entries.forEach(e => {
    if (!bySurah.has(e.surah)) bySurah.set(e.surah, []);
    bySurah.get(e.surah).push(e);
  });
  const sortedSurahNums = Array.from(bySurah.keys()).sort((a, b) => a - b);

  container.innerHTML = sortedSurahNums.map(surahNum => {
    const s = surahByNumber(surahNum);
    const list = bySurah.get(surahNum).sort((a, b) => a.from - b.from);
    const set = cov.get(surahNum);
    const isDone = s && set.size >= s.ayahs;
    const progressLabel = isDone ? 'محفوظة كاملة ✓' : `${set.size} / ${s.ayahs}`;

    const cards = list.map(e => `
      <div class="entry-card" data-id="${e.id}">
        <div class="entry-marker">${e.from}-${e.to}</div>
        <div class="entry-body">
          <div class="entry-range">الآيات ${e.from} إلى ${e.to} <span style="color:var(--ink-faint); font-weight:400;">(${e.to - e.from + 1} آية)</span></div>
          <div class="entry-meta">أُضيفت ${formatDate(e.dateAdded)} · ${e.lastReviewed ? 'آخر مراجعة ' + formatDate(e.lastReviewed) : 'لم تُراجَع بعد'}</div>
        </div>
        <button class="entry-del" data-del="${e.id}" title="حذف">🗑</button>
      </div>
    `).join('');

    return `
      <div class="surah-group">
        <div class="surah-group-head">
          <div class="name">${s.name}</div>
          <div class="progress ${isDone ? 'done' : ''}">${progressLabel}</div>
        </div>
        ${cards}
      </div>
    `;
  }).join('');

  // ربط الأحداث
  container.querySelectorAll('.entry-card').forEach(card => {
    card.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-del]')) return;
      openReview(card.dataset.id);
    });
  });
  container.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (confirm('هل تريد حذف هذا المقطع من قائمة المراجعة؟')) {
        entries = entries.filter(e => e.id !== btn.dataset.del);
        saveEntries();
        renderList();
      }
    });
  });
}

// ---------------------------------------------------------------
// تبويب: الإحصائيات
// ---------------------------------------------------------------
function renderStats() {
  const container = document.getElementById('statsContent');
  const TOTAL_QURAN_AYAT = 6236;

  if (entries.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="glyph">﴿ ﴾</div>
      <p>أضف أول محفوظاتك لتظهر إحصائياتك هنا.</p>
    </div>`;
    return;
  }

  const cov = coveredMap();
  let totalAyat = 0;
  cov.forEach(set => totalAyat += set.size);
  let completedSurahs = 0;
  cov.forEach((set, surahNum) => {
    const s = surahByNumber(surahNum);
    if (s && set.size >= s.ayahs) completedSurahs++;
  });
  const pct = ((totalAyat / TOTAL_QURAN_AYAT) * 100).toFixed(2);

  const reviewed7 = entries.filter(e => {
    if (!e.lastReviewed) return false;
    const diffDays = (Date.now() - new Date(e.lastReviewed).getTime()) / 86400000;
    return diffDays <= 7;
  }).length;

  const neverReviewed = entries.filter(e => !e.lastReviewed).length;

  container.innerHTML = `
    <div class="stats-strip">
      <div class="stat-box"><span class="num">${totalAyat}</span><span class="lbl">آية محفوظة</span></div>
      <div class="stat-box"><span class="num">${completedSurahs}</span><span class="lbl">سورة كاملة</span></div>
      <div class="stat-box"><span class="num">${pct}%</span><span class="lbl">من القرآن</span></div>
    </div>
    <div class="entry-card" style="cursor:default;">
      <div class="entry-body">
        <div class="entry-range">راجعت ${reviewed7} مقطعًا خلال آخر ٧ أيام</div>
        <div class="entry-meta">${neverReviewed > 0 ? neverReviewed + ' مقطعًا لم تُراجَع بعد منذ إضافتها' : 'أحسنت! كل المقاطع رُوجعت مرة على الأقل'}</div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------
// شاشة المراجعة (Overlay) — جلب نص الآيات وعرضها
// ---------------------------------------------------------------
const overlay = document.getElementById('reviewOverlay');
const reviewBody = document.getElementById('reviewBody');

async function getSurahAyahs(surahNum) {
  if (textCache[surahNum]) return textCache[surahNum];
  const res = await fetch(`${API_BASE}/surah/${surahNum}/${EDITION}`);
  if (!res.ok) throw new Error('network');
  const json = await res.json();
  const ayahs = json.data.ayahs.map(a => a.text);
  textCache[surahNum] = ayahs;
  saveCache();
  return ayahs;
}

async function openReview(entryId) {
  const entry = entries.find(e => e.id === entryId);
  if (!entry) return;
  currentReviewEntry = entry;
  hideTestMode = false;
  document.getElementById('toggleHideBtn').classList.remove('on');
  document.getElementById('toggleHideBtn').textContent = 'إخفاء النص للاختبار';

  document.getElementById('reviewTitle').textContent = entry.surahName;
  document.getElementById('reviewSubtitle').textContent = `الآيات ${entry.from} إلى ${entry.to}`;
  reviewBody.innerHTML = '<div class="review-loading">جارٍ تحميل الآيات…</div>';
  overlay.classList.add('active');

  try {
    const ayahs = await getSurahAyahs(entry.surah);
    const slice = [];
    for (let i = entry.from; i <= entry.to; i++) slice.push({ num: i, text: ayahs[i - 1] });
    reviewBody.innerHTML = slice.map(a => `
      <span class="ayah-line">
        <span class="ayah-text">${a.text}</span>
        <span class="ayah-num">${a.num}</span>
      </span>
    `).join(' ');
    reviewBody.querySelectorAll('.ayah-text').forEach(el => {
      el.addEventListener('click', () => el.classList.toggle('hidden-test'));
    });
  } catch (err) {
    reviewBody.innerHTML = `<div class="review-error">
      تعذّر الاتصال بالإنترنت لجلب نص الآيات.<br>
      تحتاج شبكة إنترنت أول مرة لعرض كل سورة، وبعدها تُحفظ نصوصها على جهازك للاستخدام لاحقًا دون اتصال.
    </div>`;
  }
}

document.getElementById('reviewCloseBtn').addEventListener('click', () => {
  overlay.classList.remove('active');
  renderList();
});

document.getElementById('toggleHideBtn').addEventListener('click', (e) => {
  hideTestMode = !hideTestMode;
  e.target.classList.toggle('on', hideTestMode);
  e.target.textContent = hideTestMode ? 'إظهار كل النص' : 'إخفاء النص للاختبار';
  reviewBody.querySelectorAll('.ayah-text').forEach(el => {
    el.classList.toggle('hidden-test', hideTestMode);
  });
});

document.getElementById('markReviewedBtn').addEventListener('click', () => {
  if (!currentReviewEntry) return;
  currentReviewEntry.lastReviewed = todayStr();
  currentReviewEntry.reviewCount = (currentReviewEntry.reviewCount || 0) + 1;
  saveEntries();
  showToast('أحسنت! سجّلنا مراجعتك اليوم');
  document.getElementById('reviewSubtitle').textContent =
    `الآيات ${currentReviewEntry.from} إلى ${currentReviewEntry.to} · رُوجعت ${currentReviewEntry.reviewCount} مرة`;
});

// ---------------------------------------------------------------
// تشغيل أولي
// ---------------------------------------------------------------
document.getElementById('todayHint').textContent = formatDate(todayStr());
renderList();
