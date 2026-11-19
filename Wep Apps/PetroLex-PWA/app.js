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
  lastActiveDay: localStorage.getItem('petro_last_day') || ''
};

let dailyBatch = [];
let currentIndex = 0;
let quizState = { questions: [], index: 0, score: 0, mode: 'en2ar' };

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
        currentSection = line.replace(/^##\s*\d+\.\s*/, '').trim();
      } else if (line.startsWith('|') && !/^\|[\s-:]+\|/.test(line)) {
        const cols = line.replace(/^\||\|$/g, '').split('|').map(cleanWikiLinks);
        if (cols.length < 2 || cols[0] === 'المصطلح' || cols[0] === 'المعنى') continue;

        let term = '', fullTerm = '', meaning = '';
        if (isAbbr && cols.length >= 3) {
          meaning = cols[0];
          fullTerm = cols[1];
          term = cols[2];
        } else {
          term = cols[0];
          meaning = cols[1];
          const m = term.match(/\(([A-Z0-9&/\-]{2,12})\)\s*$/);
          fullTerm = m ? m[1] : '';
        }

        if (!term || !meaning) continue;
        const exists = state.items.some(x => x.term.toLowerCase() === term.toLowerCase() && x.specId === matchedSpec.id);
        if (!exists) {
          const item = { id: nextId++, specId: matchedSpec.id, section: currentSection, type: isAbbr ? 'abbr' : 'term', term, fullTerm, meaning };
          custom.push(item);
          state.items.push(item);
          addedCount++;
        }
      }
    }
  }

  localStorage.setItem('petro_custom_items', JSON.stringify(custom));
  populateSelects();
  renderDashboard();
  renderDictionary();
  alert(`تم استيراد ${addedCount} مصطلح جديد وتخزينها محلياً!`);
}

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
          <span class="spec-title">${spec.icon} ${spec.nameAr}</span>
          <strong style="color:var(--primary)">${pct}%</strong>
        </div>
        <div class="spec-en">${spec.nameEn}</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="spec-meta">
          <span>متقن: ${specMastered} | معروض: ${specSeen} / ${specItems.length}</span>
          <span>ادرس ←</span>
        </div>
      </div>
    `;
  }).join('');
}

function openSpecStudy(specId) {
  document.getElementById('studySpecSelect').value = specId;
  switchTab('study');
  loadDailyBatch();
}

function loadDailyBatch(forceNew = false) {
  const specId = document.getElementById('studySpecSelect').value;
  const goal = Number(document.getElementById('dailyGoalInput').value) || 15;
  state.dailyGoal = goal;
  saveState();

  let pool = specId === 'all' ? [...state.items] : state.items.filter(i => i.specId === specId);
  const now = Date.now();

  pool.sort((a, b) => {
    const pa = state.progress[a.id] || { level: 0, nextReview: 0 };
    const pb = state.progress[b.id] || { level: 0, nextReview: 0 };
    const dueA = pa.nextReview <= now ? 0 : 1;
    const dueB = pb.nextReview <= now ? 0 : 1;
    if (dueA !== dueB) return dueA - dueB;
    return pa.level - pb.level;
  });

  if (forceNew) pool.sort(() => Math.random() - 0.5);
  dailyBatch = pool.slice(0, goal);
  currentIndex = 0;
  renderCard();
}

function renderCard() {
  if (!dailyBatch.length) {
    document.getElementById('cardTerm').textContent = 'لا توجد مصطلحات في هذا القسم';
    return;
  }
  const item = dailyBatch[currentIndex];
  const spec = BASE_SPECIALTIES.find(s => s.id === item.specId);
  const prog = state.progress[item.id] || { level: 0 };
  const levels = ['🆕 جديد', '🔄 قيد المراجعة', '✅ متقن', '🏆 راسخ'];

  document.getElementById('batchCounter').textContent = `${currentIndex + 1} / ${dailyBatch.length}`;
  document.getElementById('cardSection').textContent = `${spec?.nameAr || ''} • ${item.section}`;
  document.getElementById('cardLevel').textContent = levels[Math.min(prog.level, 3)];
  document.getElementById('cardTerm').textContent = item.term;

  const fullEl = document.getElementById('cardFull');
  if (item.fullTerm && item.fullTerm !== item.term) {
    fullEl.textContent = item.fullTerm;
    fullEl.classList.remove('hidden');
  } else {
    fullEl.classList.add('hidden');
  }

  document.getElementById('cardMeaning').textContent = item.meaning;
  document.getElementById('cardMeaning').classList.add('hidden');
  document.getElementById('revealRow').classList.remove('hidden');
  document.getElementById('rateRow').classList.add('hidden');
}

function revealMeaning() {
  document.getElementById('cardMeaning').classList.remove('hidden');
  document.getElementById('revealRow').classList.add('hidden');
  document.getElementById('rateRow').classList.remove('hidden');
}

function rateCard(score) {
  updateStreak();
  const item = dailyBatch[currentIndex];
  const prev = state.progress[item.id] || { level: 0, seenCount: 0, nextReview: 0 };
  const intervals = [10 * 60 * 1000, 24 * 3600 * 1000, 3 * 24 * 3600 * 1000, 7 * 24 * 3600 * 1000];

  const newLevel = score === 0 ? 0 : Math.min(3, prev.level + score);
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
    alert('🎉 أحسنت! أنهيت وردية اليوم بنجاح. انتقل إلى الاختبارات لتثبيت الحفظ.');
    renderDashboard();
    switchTab('quiz');
  }
}

function speakCurrentTerm() {
  const item = dailyBatch[currentIndex];
  if (!item || !('speechSynthesis' in window)) return;
  const text = item.fullTerm && item.fullTerm.length > 3 ? `${item.term}. ${item.fullTerm}` : item.term;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'en-US';
  utter.rate = 0.92;
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

function startQuiz() {
  const specId = document.getElementById('quizSpecSelect').value;
  const scope = document.getElementById('quizScopeSelect').value;
  const mode = document.getElementById('quizModeSelect').value;

  let pool = specId === 'all' ? [...state.items] : state.items.filter(i => i.specId === specId);
  if (scope === 'studied') {
    const studiedPool = pool.filter(i => (state.progress[i.id]?.seenCount || 0) > 0);
    if (studiedPool.length >= 4) pool = studiedPool;
  }

  if (pool.length < 4) {
    document.getElementById('quizContainer').innerHTML = '<p>تحتاج إلى 4 مصطلحات على الأقل لبدء الاختبار.</p>';
    return;
  }

  pool.sort(() => Math.random() - 0.5);
  const selected = pool.slice(0, Math.min(10, pool.length));

  quizState = {
    index: 0,
    score: 0,
    mode,
    questions: selected.map(q => {
      const sameSpecPool = state.items.filter(x => x.id !== q.id && x.specId === q.specId);
      const distractorSource = sameSpecPool.length >= 3 ? sameSpecPool : state.items.filter(x => x.id !== q.id);
      const distractors = distractorSource
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(x => mode === 'en2ar' ? x.meaning : x.term);
      const answer = mode === 'en2ar' ? q.meaning : q.term;
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
        <h2>🏁 نتيجة الاختبار: ${quizState.score} / ${quizState.questions.length} (${pct}%)</h2>
        <p style="color:var(--muted); margin:10px 0;">تم تحديث مستوى الإتقان للمصطلحات المختبرة تلقائياً.</p>
        <button class="btn-primary" onclick="startQuiz()">🔄 اختبار جديد</button>
      </div>`;
    renderDashboard();
    return;
  }

  const q = quizState.questions[quizState.index];
  const isEn2Ar = quizState.mode === 'en2ar';
  const promptMain = isEn2Ar ? q.item.term : q.item.meaning;
  const promptSub = isEn2Ar ? (q.item.fullTerm || '') : q.item.section;

  box.innerHTML = `
    <div style="display:flex; justify-content:space-between; color:var(--muted); font-size:0.85rem;">
      <span>سؤال ${quizState.index + 1} من ${quizState.questions.length}</span>
      <span>النتيجة: ${quizState.score}</span>
    </div>
    <div class="${isEn2Ar ? 'term-en' : 'term-ar'}" style="text-align:center; border:none; margin:18px 0 6px;">${promptMain}</div>
    ${promptSub ? `<div class="term-full" style="text-align:center;">${promptSub}</div>` : ''}
    <div class="options-list">
      ${q.options.map((opt, idx) => `<button class="option-btn" data-idx="${idx}" onclick="checkQuizAnswer(this, ${idx})">${opt}</button>`).join('')}
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
  }, 1100);
}

function renderDictionary() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const specId = document.getElementById('dictSpecFilter').value;

  const filtered = state.items.filter(item => {
    if (specId !== 'all' && item.specId !== specId) return false;
    if (!q) return true;
    return item.term.toLowerCase().includes(q) ||
           (item.fullTerm && item.fullTerm.toLowerCase().includes(q)) ||
           item.meaning.includes(q);
  }).slice(0, 150);

  document.getElementById('dictList').innerHTML = filtered.map(item => `
    <div class="dict-item">
      <div>
        <strong style="color:var(--primary); direction:ltr; display:inline-block;">${item.term}</strong>
        ${item.fullTerm && item.fullTerm !== item.term ? `<span style="color:var(--accent); font-size:0.82rem; margin-right:6px;">(${item.fullTerm})</span>` : ''}
        <div style="font-size:0.95rem;">${item.meaning}</div>
      </div>
      <span style="font-size:0.75rem; color:var(--muted);">${item.section}</span>
    </div>
  `).join('');
}

function populateSelects() {
  const optionsHtml = `<option value="all">كل التخصصات (${state.items.length})</option>` +
    BASE_SPECIALTIES.map(s => {
      const c = state.items.filter(i => i.specId === s.id).length;
      return `<option value="${s.id}">${s.icon} ${s.nameAr} (${c})</option>`;
    }).join('');

  document.getElementById('studySpecSelect').innerHTML = optionsHtml;
  document.getElementById('quizSpecSelect').innerHTML = optionsHtml;
  document.getElementById('dictSpecFilter').innerHTML = optionsHtml;
}

function exportProgress() {
  const blob = new Blob([JSON.stringify(state.progress, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `petrolex-progress-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}

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

document.getElementById('themeBtn').addEventListener('click', () => {
  document.body.classList.toggle('light');
});

window.addEventListener('online', () => document.getElementById('netStatus').textContent = 'متصل + مخزن محلياً ✓');
window.addEventListener('offline', () => document.getElementById('netStatus').textContent = 'وضع بدون إنترنت ⚡');

populateSelects();
renderDashboard();
