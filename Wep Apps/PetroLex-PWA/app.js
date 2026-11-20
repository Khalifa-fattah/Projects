const BASE_SPECIALTIES = (window.PETRO_DATA && window.PETRO_DATA.specialties) || [];
const BASE_ITEMS = (window.PETRO_DATA && window.PETRO_DATA.items) || [];

function loadStoredItems() {
  const custom = JSON.parse(localStorage.getItem('petro_custom_items') || '[]');
  return [...BASE_ITEMS, ...custom];
}

let state = {
  items: loadStoredItems(),
  progress: JSON.parse(localStorage.getItem('petro_progress') || '{}'),
  dailyGoal: Number(localStorage.getItem('petro_goal')) || 15,
  streak: Number(localStorage.getItem('petro_streak')) || 1,
  lastActiveDay: localStorage.getItem('petro_last_day') || '',
  studySpec: 'all',
  quizSpec: 'all',
  quizScope: 'studied',
  quizMode: 'en2ar',
  dictSpec: 'all'
};

let dailyBatch = [];
let currentIndex = 0;
let quizState = { questions: [], index: 0, score: 0, mode: 'en2ar' };

// ==========================================
// Custom Styled Dropdown Component
// ==========================================
function createCustomDropdown(containerId, options, selectedValue, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const current = options.find(o => o.value === selectedValue) || options[0];

  container.innerHTML = `
    <div class="custom-select-wrap">
      <button type="button" class="custom-select-btn">
        <span>${current ? current.label : ''}</span>
        <span class="chevron">▼</span>
      </button>
      <div class="custom-select-menu hidden">
        ${options.map(opt => `
          <div class="custom-select-option ${opt.value === selectedValue ? 'selected' : ''}" data-val="${opt.value}">
            <span>${opt.label}</span>
            ${opt.badge ? `<span style="font-size:0.78rem; color:var(--muted);">${opt.badge}</span>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const btn = container.querySelector('.custom-select-btn');
  const menu = container.querySelector('.custom-select-menu');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !menu.classList.contains('hidden');
    closeAllDropdowns();
    if (!isOpen) {
      menu.classList.remove('hidden');
      btn.classList.add('open');
    }
  });

  container.querySelectorAll('.custom-select-option').forEach(optEl => {
    optEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = optEl.dataset.val;
      closeAllDropdowns();
      onChange(val);
      createCustomDropdown(containerId, options, val, onChange);
    });
  });
}

function closeAllDropdowns() {
  document.querySelectorAll('.custom-select-menu').forEach(m => m.classList.add('hidden'));
  document.querySelectorAll('.custom-select-btn').forEach(b => b.classList.remove('open'));
}

document.addEventListener('click', closeAllDropdowns);

function initDropdowns() {
  const specOptions = [
    { value: 'all', label: 'كل التخصصات', badge: `${state.items.length}` },
    ...BASE_SPECIALTIES.map(s => ({
      value: s.id,
      label: s.nameAr,
      badge: `${state.items.filter(i => i.specId === s.id).length}`
    }))
  ];

  createCustomDropdown('studySpecDropdown', specOptions, state.studySpec, (val) => {
    state.studySpec = val;
    loadDailyBatch();
  });

  createCustomDropdown('quizSpecDropdown', specOptions, state.quizSpec, (val) => {
    state.quizSpec = val;
  });

  createCustomDropdown('quizScopeDropdown', [
    { value: 'studied', label: 'المصطلحات المعروضة والقديمة' },
    { value: 'all', label: 'كل مصطلحات القاموس' }
  ], state.quizScope, (val) => {
    state.quizScope = val;
  });

  createCustomDropdown('quizModeDropdown', [
    { value: 'en2ar', label: 'إنجليزي ← عربي' },
    { value: 'ar2en', label: 'عربي ← إنجليزي' }
  ], state.quizMode, (val) => {
    state.quizMode = val;
  });

  createCustomDropdown('dictSpecDropdown', specOptions, state.dictSpec, (val) => {
    state.dictSpec = val;
    renderDictionary();
  });
}

// ==========================================
// Streak & Persistence
// ==========================================
function updateStreak() {
  const today = new Date().toISOString().slice(0, 10);
  if (!state.lastActiveDay) {
    state.lastActiveDay = today;
    state.streak = 1;
  } else if (state.lastActiveDay !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    state.streak = (state.lastActiveDay === yesterday) ? state.streak + 1 : 1;
    state.lastActiveDay = today;
  }
  localStorage.setItem('petro_streak', state.streak);
  localStorage.setItem('petro_last_day', state.lastActiveDay);
}

function saveState() {
  localStorage.setItem('petro_progress', JSON.stringify(state.progress));
  localStorage.setItem('petro_goal', state.dailyGoal);
}

function cleanWikiLinks(str) {
  return str
    .replace(/\[\[([^|\]]+)\\?\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .trim();
}

async function importMarkdownFiles(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;

  const custom = JSON.parse(localStorage.getItem('petro_custom_items') || '[]');
  let nextId = state.items.reduce((m, x) => Math.max(m, x.id), 0) + 1;
  let addedCount = 0;

  for (const file of files) {
    const text = await file.text();
    const matchedSpec = BASE_SPECIALTIES.find(s => file.name.includes(s.file.replace('.md', ''))) || BASE_SPECIALTIES[0];
    const isAbbr = file.name.includes('اختصار');
    let currentSection = 'عام';

    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (line.startsWith('## ')) {
        currentSection = line.replace(/^##\s*/, '').trim();
      } else if (line.startsWith('|') && !/^\|[\s-:]+\|/.test(line)) {
        const cols = line.replace(/^\||\|$/g, '').split('|').map(cleanWikiLinks);
        if (cols.length < 2 || cols[0] === 'المصطلح' || cols[0] === 'المعنى') continue;

        let term = '', abbr = '', meaning = '';
        if (isAbbr && cols.length >= 3) {
          meaning = cols[0];
          term = cols[1] || cols[2];
          abbr = cols[2];
        } else {
          const m = cols[0].match(/^(.*?)\s*\(([A-Z0-9&/\-]{2,12})\)\s*$/);
          term = m ? m[1].trim() : cols[0];
          abbr = m ? m[2].trim() : '';
          meaning = cols[1];
        }

        if (!term || !meaning) continue;
        const exists = state.items.some(x => x.term.toLowerCase() === term.toLowerCase() && x.specId === matchedSpec.id);
        if (!exists) {
          const item = { id: nextId++, specId: matchedSpec.id, section: currentSection, type: isAbbr ? 'abbr' : 'term', term, abbr, meaning };
          custom.push(item);
          state.items.push(item);
          addedCount++;
        }
      }
    }
  }

  localStorage.setItem('petro_custom_items', JSON.stringify(custom));
  initDropdowns();
  renderDashboard();
  renderDictionary();
  alert(`تم استيراد ${addedCount} مصطلح جديد بنجاح!`);
}

// ==========================================
// Dashboard & Progress
// ==========================================
function renderDashboard() {
  const total = state.items.length;
  const progEntries = Object.values(state.progress);
  const seen = progEntries.filter(p => p.seenCount > 0).length;
  const mastered = progEntries.filter(p => p.level >= 2).length;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statSeen').textContent = seen;
  document.getElementById('statMastered').textContent = mastered;
  document.getElementById('statStreak').textContent = state.streak;
  document.getElementById('dailyGoalInput').value = state.dailyGoal;

  const grid = document.getElementById('specGrid');
  grid.innerHTML = BASE_SPECIALTIES.map(spec => {
    const specItems = state.items.filter(i => i.specId === spec.id);
    const specMastered = specItems.filter(i => (state.progress[i.id]?.level || 0) >= 2).length;
    const specSeen = specItems.filter(i => (state.progress[i.id]?.seenCount || 0) > 0).length;
    const pct = specItems.length ? Math.round((specMastered / specItems.length) * 100) : 0;

    return `
      <div class="spec-card" onclick="openSpecStudy('${spec.id}')">
        <div class="spec-top">
          <span class="spec-title">${spec.nameAr}</span>
          <span class="spec-pct">${pct}%</span>
        </div>
        <div class="spec-en">${spec.nameEn}</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="spec-meta">
          <span>متقن: ${specMastered} | معروض: ${specSeen} / ${specItems.length}</span>
          <span style="color:var(--green-text); font-weight:600;">ادرس ←</span>
        </div>
      </div>
    `;
  }).join('');
}

function startDailyFromDashboard() {
  const goal = Number(document.getElementById('dailyGoalInput').value) || 15;
  state.dailyGoal = goal;
  saveState();
  switchTab('study');
  loadDailyBatch();
}

function openSpecStudy(specId) {
  state.studySpec = specId;
  initDropdowns();
  switchTab('study');
  loadDailyBatch();
}

// ==========================================
// Active Learning Session
// ==========================================
function loadDailyBatch() {
  const goal = Number(document.getElementById('dailyGoalInput').value) || 15;
  state.dailyGoal = goal;
  saveState();

  let pool = state.studySpec === 'all' ? [...state.items] : state.items.filter(i => i.specId === state.studySpec);
  const now = Date.now();

  pool.sort((a, b) => {
    const pa = state.progress[a.id] || { level: 0, nextReview: 0 };
    const pb = state.progress[b.id] || { level: 0, nextReview: 0 };
    const dueA = pa.nextReview <= now ? 0 : 1;
    const dueB = pb.nextReview <= now ? 0 : 1;
    if (dueA !== dueB) return dueA - dueB;
    return pa.level - pb.level;
  });

  dailyBatch = pool.slice(0, goal);
  currentIndex = 0;
  renderCard();
}

function renderCard() {
  if (!dailyBatch.length) {
    document.getElementById('cardTerm').textContent = 'لا توجد مصطلحات';
    return;
  }
  const item = dailyBatch[currentIndex];
  const spec = BASE_SPECIALTIES.find(s => s.id === item.specId);

  document.getElementById('cardSection').textContent = `${spec ? spec.nameAr : ''} · ${item.section}`;
  document.getElementById('batchCounter').textContent = `${currentIndex + 1} / ${dailyBatch.length}`;
  document.getElementById('cardTerm').textContent = item.term;

  const abbrEl = document.getElementById('cardAbbr');
  if (item.abbr && item.abbr !== item.term) {
    abbrEl.textContent = `الاختصار: ${item.abbr}`;
    abbrEl.classList.remove('hidden');
  } else {
    abbrEl.classList.add('hidden');
  }

  document.getElementById('cardMeaning').textContent = item.meaning;
  document.getElementById('revealRow').classList.remove('hidden');
  document.getElementById('answerSection').classList.add('hidden');
}

function revealMeaning() {
  document.getElementById('revealRow').classList.add('hidden');
  document.getElementById('answerSection').classList.remove('hidden');
}

function rateCard(ratingIndex) {
  // 0: لم أتذكر, 1: بصعوبة, 2: تذكرت, 3: بسهولة
  updateStreak();
  const item = dailyBatch[currentIndex];
  const prev = state.progress[item.id] || { level: 0, seenCount: 0, nextReview: 0 };
  const intervals = [10 * 60 * 1000, 12 * 3600 * 1000, 3 * 24 * 3600 * 1000, 7 * 24 * 3600 * 1000];

  let newLevel = 0;
  if (ratingIndex === 0) newLevel = 0;
  else if (ratingIndex === 1) newLevel = Math.max(1, prev.level);
  else if (ratingIndex === 2) newLevel = Math.min(3, prev.level + 1);
  else newLevel = 3;

  state.progress[item.id] = {
    level: newLevel,
    seenCount: prev.seenCount + 1,
    nextReview: Date.now() + intervals[newLevel]
  };
  saveState();

  if (currentIndex + 1 < dailyBatch.length) {
    currentIndex++;
    renderCard();
  } else {
    renderDashboard();
    switchTab('quiz');
  }
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

// ==========================================
// Smart Quiz
// ==========================================
function startQuiz() {
  let pool = state.quizSpec === 'all' ? [...state.items] : state.items.filter(i => i.specId === state.quizSpec);
  if (state.quizScope === 'studied') {
    const studiedPool = pool.filter(i => (state.progress[i.id]?.seenCount || 0) > 0);
    if (studiedPool.length >= 4) pool = studiedPool;
  }

  if (pool.length < 4) {
    document.getElementById('quizContainer').innerHTML = '<p style="text-align:center; color:var(--muted);">تحتاج إلى 4 مصطلحات على الأقل لبدء الاختبار.</p>';
    return;
  }

  pool.sort(() => Math.random() - 0.5);
  const selected = pool.slice(0, Math.min(10, pool.length));

  quizState = {
    index: 0,
    score: 0,
    mode: state.quizMode,
    questions: selected.map(q => {
      const sameSpecPool = state.items.filter(x => x.id !== q.id && x.specId === q.specId);
      const distractorSource = sameSpecPool.length >= 3 ? sameSpecPool : state.items.filter(x => x.id !== q.id);
      const distractors = distractorSource
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(x => state.quizMode === 'en2ar' ? x.meaning : x.term);
      const answer = state.quizMode === 'en2ar' ? q.meaning : q.term;
      const options = [...distractors, answer].sort(() => Math.random() - 0.5);
      return { item: q, options, answer };
    })
  };
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const box = document.getElementById('quizContainer');
  if (quizState.index >= quizState.questions.length) {
    const pct = Math.round((quizState.score / quizState.questions.length) * 100);
    box.innerHTML = `
      <div style="text-align:center; padding:18px;">
        <div class="session-kicker">اكتمل الاختبار</div>
        <h2 style="font-size:1.5rem; margin:8px 0;">${quizState.score} / ${quizState.questions.length} (${pct}%)</h2>
        <p style="color:var(--muted); margin-bottom:18px;">تم تحديث مستوى الإتقان تلقائياً.</p>
        <button class="btn-green" onclick="startQuiz()">اختبار جديد</button>
      </div>`;
    renderDashboard();
    return;
  }

  const q = quizState.questions[quizState.index];
  const isEn2Ar = quizState.mode === 'en2ar';
  const promptMain = isEn2Ar ? q.item.term : q.item.meaning;
  const promptSub = isEn2Ar && q.item.abbr ? `الاختصار: ${q.item.abbr}` : q.item.section;

  box.innerHTML = `
    <div class="learn-card-top">
      <span>النتيجة: ${quizState.score}</span>
      <span class="learn-counter">${quizState.index + 1} / ${quizState.questions.length}</span>
    </div>
    <div class="${isEn2Ar ? 'learn-term' : 'learn-meaning'}" style="margin:14px 0 8px;">${promptMain}</div>
    ${promptSub ? `<div class="learn-abbr" style="margin-bottom:14px;">${promptSub}</div>` : ''}
    <div class="options-list">
      ${q.options.map((opt, idx) => `<button class="option-btn" onclick="checkQuizAnswer(this, ${idx})">${opt}</button>`).join('')}
    </div>
  `;
}

function checkQuizAnswer(btn, optIdx) {
  updateStreak();
  const q = quizState.questions[quizState.index];
  const chosen = q.options[optIdx];
  const buttons = document.querySelectorAll('.option-btn');
  buttons.forEach(b => b.disabled = true);

  const prev = state.progress[q.item.id] || { level: 0, seenCount: 0, nextReview: 0 };
  if (chosen === q.answer) {
    btn.classList.add('correct');
    quizState.score++;
    state.progress[q.item.id] = { level: Math.min(3, prev.level + 1), seenCount: prev.seenCount + 1, nextReview: Date.now() + 3 * 86400000 };
  } else {
    btn.classList.add('wrong');
    buttons.forEach((b, i) => { if (q.options[i] === q.answer) b.classList.add('correct'); });
    state.progress[q.item.id] = { level: 0, seenCount: prev.seenCount + 1, nextReview: Date.now() + 600000 };
  }
  saveState();

  setTimeout(() => {
    quizState.index++;
    renderQuizQuestion();
  }, 1000);
}

// ==========================================
// Dictionary
// ==========================================
function renderDictionary() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();

  const filtered = state.items.filter(item => {
    if (state.dictSpec !== 'all' && item.specId !== state.dictSpec) return false;
    if (!q) return true;
    return item.term.toLowerCase().includes(q) ||
           (item.abbr && item.abbr.toLowerCase().includes(q)) ||
           item.meaning.includes(q);
  }).slice(0, 150);

  document.getElementById('dictList').innerHTML = filtered.map(item => `
    <div class="dict-item">
      <div>
        <strong style="color:var(--text); direction:ltr; display:inline-block;">${item.term}</strong>
        ${item.abbr && item.abbr !== item.term ? `<span style="color:var(--green-text); font-size:0.82rem; font-weight:700; margin-right:6px;">(${item.abbr})</span>` : ''}
        <div style="font-size:0.92rem; color:var(--muted); margin-top:2px;">${item.meaning}</div>
      </div>
      <span style="font-size:0.75rem; color:var(--muted); text-align:left;">${item.section}</span>
    </div>
  `).join('');
}

// ==========================================
// Navigation, Theme & PWA
// ==========================================
function switchTab(tabName) {
  ['dashboard', 'study', 'quiz', 'dict'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.toggle('hidden', t !== tabName);
  });
  document.querySelectorAll('nav.bottom-nav button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  if (tabName === 'study' && !dailyBatch.length) loadDailyBatch();
  if (tabName === 'dict') renderDictionary();
}

// Theme: Default Dark, toggleable to Light
const savedTheme = localStorage.getItem('petro_theme') || 'dark';
if (savedTheme === 'light') document.body.classList.add('light');

document.getElementById('themeBtn').addEventListener('click', () => {
  document.body.classList.toggle('light');
  localStorage.setItem('petro_theme', document.body.classList.contains('light') ? 'light' : 'dark');
});

// Online/Offline green dot
const netDot = document.getElementById('netDot');
window.addEventListener('online', () => netDot.classList.remove('offline'));
window.addEventListener('offline', () => netDot.classList.add('offline'));

// Service Worker & Install Prompt
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBtn').classList.remove('hidden');
});

document.getElementById('installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById('installBtn').classList.add('hidden');
});

initDropdowns();
renderDashboard();
