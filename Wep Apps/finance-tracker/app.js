// ================================================================
// FinanceFlow – Static Version  (app.js)
// لا يحتاج Node.js أو npm – يعمل مباشرة بفتح index.html
// ================================================================

// ── Helpers ──────────────────────────────────────────────────────
function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency,
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr, short = false) {
  const d = new Date(dateStr + 'T00:00:00');
  if (short) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function subDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const EMOJI_MAP = {
  home: '🏠', car: '🚗', shopping: '🛍️', food: '🍽️',
  health: '❤️', education: '📚', entertainment: '🎬',
  travel: '✈️', investment: '📈', salary: '💼',
  freelance: '💻', gift: '🎁', other: '📦',
};

// ── Default Data ──────────────────────────────────────────────────
const today = new Date();

const DEFAULT_CATEGORIES = [
  { id: 'cat-1',  name: 'Housing',        icon: 'home',          color: '#6366f1', type: 'expense' },
  { id: 'cat-2',  name: 'Food & Dining',  icon: 'food',          color: '#f59e0b', type: 'expense' },
  { id: 'cat-3',  name: 'Transportation', icon: 'car',           color: '#3b82f6', type: 'expense' },
  { id: 'cat-4',  name: 'Shopping',       icon: 'shopping',      color: '#ec4899', type: 'expense' },
  { id: 'cat-5',  name: 'Health',         icon: 'health',        color: '#ef4444', type: 'expense' },
  { id: 'cat-6',  name: 'Entertainment',  icon: 'entertainment', color: '#8b5cf6', type: 'expense' },
  { id: 'cat-7',  name: 'Education',      icon: 'education',     color: '#14b8a6', type: 'expense' },
  { id: 'cat-8',  name: 'Travel',         icon: 'travel',        color: '#f97316', type: 'expense' },
  { id: 'cat-9',  name: 'Salary',         icon: 'salary',        color: '#22c55e', type: 'income'  },
  { id: 'cat-10', name: 'Freelance',      icon: 'freelance',     color: '#10b981', type: 'income'  },
  { id: 'cat-11', name: 'Investment',     icon: 'investment',    color: '#06b6d4', type: 'income'  },
  { id: 'cat-12', name: 'Gift',           icon: 'gift',          color: '#a855f7', type: 'both'    },
  { id: 'cat-13', name: 'Other',          icon: 'other',         color: '#94a3b8', type: 'both'    },
];

const DEFAULT_ACCOUNTS = [
  { id: 'acc-1', name: 'Main Bank Account',    type: 'bank',       balance: 8450.00,  currency: 'USD', color: '#3b82f6', icon: '🏦', isDefault: true },
  { id: 'acc-2', name: 'Cash Wallet',          type: 'cash',       balance: 320.50,   currency: 'USD', color: '#22c55e', icon: '💵' },
  { id: 'acc-3', name: 'Credit Card',          type: 'credit',     balance: -1250.00, currency: 'USD', color: '#f59e0b', icon: '💳' },
  { id: 'acc-4', name: 'Investment Portfolio', type: 'investment', balance: 15200.00, currency: 'USD', color: '#06b6d4', icon: '📈' },
];

const DEFAULT_TRANSACTIONS = [
  { id: generateId(), type: 'income',  amount: 5000,   date: subDays(today, 1),  categoryId: 'cat-9',  accountId: 'acc-1', description: 'Monthly Salary',             currency: 'USD', createdAt: new Date().toISOString() },
  { id: generateId(), type: 'expense', amount: 1200,   date: subDays(today, 2),  categoryId: 'cat-1',  accountId: 'acc-1', description: 'Rent Payment',               currency: 'USD', createdAt: new Date().toISOString() },
  { id: generateId(), type: 'expense', amount: 85.50,  date: subDays(today, 3),  categoryId: 'cat-2',  accountId: 'acc-2', description: 'Grocery Shopping',           currency: 'USD', createdAt: new Date().toISOString(), tags: ['essentials'] },
  { id: generateId(), type: 'expense', amount: 45.00,  date: subDays(today, 3),  categoryId: 'cat-3',  accountId: 'acc-1', description: 'Uber rides',                  currency: 'USD', createdAt: new Date().toISOString() },
  { id: generateId(), type: 'income',  amount: 750,    date: subDays(today, 5),  categoryId: 'cat-10', accountId: 'acc-1', description: 'Freelance project payment',   currency: 'USD', createdAt: new Date().toISOString(), tags: ['client', 'design'] },
  { id: generateId(), type: 'expense', amount: 120.00, date: subDays(today, 6),  categoryId: 'cat-4',  accountId: 'acc-3', description: 'Online Shopping - Amazon',    currency: 'USD', createdAt: new Date().toISOString(), tags: ['online'] },
  { id: generateId(), type: 'expense', amount: 60.00,  date: subDays(today, 7),  categoryId: 'cat-6',  accountId: 'acc-1', description: 'Netflix & Spotify',           currency: 'USD', createdAt: new Date().toISOString(), tags: ['subscription'] },
  { id: generateId(), type: 'expense', amount: 200,    date: subDays(today, 10), categoryId: 'cat-5',  accountId: 'acc-1', description: 'Doctor visit & medicines',    currency: 'USD', createdAt: new Date().toISOString() },
  { id: generateId(), type: 'income',  amount: 300,    date: subDays(today, 12), categoryId: 'cat-11', accountId: 'acc-4', description: 'Dividend payment',            currency: 'USD', createdAt: new Date().toISOString() },
  { id: generateId(), type: 'expense', amount: 350,    date: subDays(today, 14), categoryId: 'cat-8',  accountId: 'acc-1', description: 'Weekend trip expenses',       currency: 'USD', createdAt: new Date().toISOString(), tags: ['vacation'] },
];

const DEFAULT_BUDGETS = [
  { id: 'budget-1', categoryId: 'cat-2', amount: 500,  period: 'monthly', spent: 85.50, alerts: true, alertThreshold: 80 },
  { id: 'budget-2', categoryId: 'cat-3', amount: 200,  period: 'monthly', spent: 45,    alerts: true, alertThreshold: 80 },
  { id: 'budget-3', categoryId: 'cat-6', amount: 100,  period: 'monthly', spent: 60,    alerts: true, alertThreshold: 80 },
  { id: 'budget-4', categoryId: 'cat-8', amount: 400,  period: 'monthly', spent: 350,   alerts: true, alertThreshold: 80 },
];

// ── State (persisted in localStorage) ────────────────────────────
function loadState() {
  try {
    return {
      transactions: JSON.parse(localStorage.getItem('ff-transactions') || 'null') || DEFAULT_TRANSACTIONS,
      categories:   JSON.parse(localStorage.getItem('ff-categories')   || 'null') || DEFAULT_CATEGORIES,
      accounts:     JSON.parse(localStorage.getItem('ff-accounts')     || 'null') || DEFAULT_ACCOUNTS,
      budgets:      JSON.parse(localStorage.getItem('ff-budgets')      || 'null') || DEFAULT_BUDGETS,
      darkMode:     JSON.parse(localStorage.getItem('ff-dark')         || 'false'),
      sidebarOpen:  JSON.parse(localStorage.getItem('ff-sidebar')      || 'true'),
    };
  } catch { return { transactions: DEFAULT_TRANSACTIONS, categories: DEFAULT_CATEGORIES, accounts: DEFAULT_ACCOUNTS, budgets: DEFAULT_BUDGETS, darkMode: false, sidebarOpen: true }; }
}

let state = loadState();

function saveState() {
  localStorage.setItem('ff-transactions', JSON.stringify(state.transactions));
  localStorage.setItem('ff-categories',   JSON.stringify(state.categories));
  localStorage.setItem('ff-accounts',     JSON.stringify(state.accounts));
  localStorage.setItem('ff-budgets',      JSON.stringify(state.budgets));
  localStorage.setItem('ff-dark',         JSON.stringify(state.darkMode));
  localStorage.setItem('ff-sidebar',      JSON.stringify(state.sidebarOpen));
}

// ── Analytics helpers ─────────────────────────────────────────────
function calcTotals(txs) {
  return txs.reduce((acc, t) => {
    if (t.type === 'income')  acc.income  += t.amount;
    if (t.type === 'expense') acc.expense += t.amount;
    return acc;
  }, { income: 0, expense: 0 });
}

function getTotalBalance() {
  return state.accounts.reduce((s, a) => s + a.balance, 0);
}

function getMonthTxs() {
  const ms = startOfMonth(today);
  return state.transactions.filter(t => new Date(t.date) >= ms);
}

function getPrevMonthTxs() {
  const ms = startOfMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const me = startOfMonth(today);
  return state.transactions.filter(t => { const d = new Date(t.date); return d >= ms && d < me; });
}

function pctChange(cur, prev) {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function buildCategoryBreakdown(txs) {
  const expenses = txs.filter(t => t.type === 'expense');
  const total = expenses.reduce((s, t) => s + t.amount, 0);
  const grouped = {};
  expenses.forEach(t => { grouped[t.categoryId] = (grouped[t.categoryId] || 0) + t.amount; });
  return Object.entries(grouped)
    .map(([catId, amount]) => {
      const cat = state.categories.find(c => c.id === catId) || { name: 'Unknown', color: '#94a3b8', icon: 'other' };
      return { catId, name: cat.name, color: cat.color, icon: cat.icon, amount, pct: total > 0 ? (amount / total) * 100 : 0, count: expenses.filter(t => t.categoryId === catId).length };
    })
    .sort((a, b) => b.amount - a.amount);
}

function buildCashFlow() {
  // last 30 days grouped weekly
  const now = new Date();
  const weeks = [];
  for (let w = 4; w >= 0; w--) {
    const from = new Date(now); from.setDate(from.getDate() - (w + 1) * 7);
    const to   = new Date(now); to.setDate(to.getDate() - w * 7);
    const txs  = state.transactions.filter(t => { const d = new Date(t.date); return d >= from && d < to; });
    const inc  = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp  = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    weeks.push({ label: from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), income: inc, expense: exp });
  }
  return weeks;
}

function budgetStatus(spent, amount) {
  const p = (spent / amount) * 100;
  if (p >= 100) return 'danger';
  if (p >= 80)  return 'warning';
  return 'safe';
}

// ── Toast ─────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ── Navigation ────────────────────────────────────────────────────
let currentPage = 'dashboard';

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === page);
  });
  renderPage(page);
}

function renderPage(page) {
  switch (page) {
    case 'dashboard':    renderDashboard();    break;
    case 'transactions': renderTransactions(); break;
    case 'budgets':      renderBudgets();      break;
    case 'accounts':     renderAccounts();     break;
    case 'reports':      renderReports();      break;
    case 'settings':     renderSettings();     break;
  }
}

// ── Sidebar ───────────────────────────────────────────────────────
function toggleSidebar() {
  state.sidebarOpen = !state.sidebarOpen;
  saveState();
  const sb = document.querySelector('.sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle-icon');
  sb.classList.toggle('collapsed', !state.sidebarOpen);
  toggleBtn.textContent = state.sidebarOpen ? '‹' : '›';
}

// ── Theme ─────────────────────────────────────────────────────────
function toggleTheme() {
  state.darkMode = !state.darkMode;
  saveState();
  document.body.classList.toggle('dark', state.darkMode);
}

// ── Dashboard ─────────────────────────────────────────────────────
function renderDashboard() {
  const monthTxs = getMonthTxs();
  const prevTxs  = getPrevMonthTxs();
  const { income, expense } = calcTotals(monthTxs);
  const { income: pi, expense: pe } = calcTotals(prevTxs);
  const balance = getTotalBalance();
  const savings = income > 0 ? ((income - expense) / income) * 100 : 0;
  const incomePct  = pctChange(income, pi);
  const expensePct = pctChange(expense, pe);

  // Stat cards
  renderStatCard('stat-income',  income,   'income',  incomePct,  'vs last month');
  renderStatCard('stat-expense', expense,  'expense', expensePct, 'vs last month');
  renderStatCard('stat-balance', balance,  'balance', 12.5,       'vs last month');
  renderStatCard('stat-savings', savings,  'savings', null,       'savings rate', true);

  // Budget alerts
  renderBudgetAlerts();

  // Accounts sidebar
  renderAccountsList();

  // Recent transactions
  renderRecentTransactions();

  // Charts
  renderCashFlowChart();
  renderPieChart(buildCategoryBreakdown(monthTxs));
}

function renderStatCard(id, value, type, change, label, isSavings = false) {
  const el = document.getElementById(id);
  if (!el) return;
  const valEl  = el.querySelector('.stat-value');
  const chgEl  = el.querySelector('.stat-change');
  valEl.textContent = isSavings ? value.toFixed(1) + '%' : formatCurrency(value);
  if (chgEl && change !== null) {
    const up = change >= 0;
    chgEl.innerHTML = `
      <span class="arrow">${up ? '↑' : '↓'}</span>
      <span class="pct ${up ? 'up' : 'down'}">${Math.abs(change).toFixed(1)}%</span>
      <span class="lbl">${label}</span>
    `;
  } else if (chgEl) {
    chgEl.innerHTML = `<span class="lbl">${label}</span>`;
  }
}

function renderBudgetAlerts() {
  const container = document.getElementById('budget-alerts');
  if (!container) return;
  const dismissed = JSON.parse(sessionStorage.getItem('dismissed-alerts') || '[]');
  const alerts = state.budgets.filter(b => b.alerts && !dismissed.includes(b.id) && budgetStatus(b.spent, b.amount) !== 'safe');

  if (alerts.length === 0) { container.style.display = 'none'; return; }
  container.style.display = 'block';

  const listEl = container.querySelector('.alert-list');
  listEl.innerHTML = alerts.map(b => {
    const cat = state.categories.find(c => c.id === b.categoryId) || { name: 'Unknown', icon: 'other' };
    const st  = budgetStatus(b.spent, b.amount);
    const pct = Math.min((b.spent / b.amount) * 100, 100);
    const rem = b.amount - b.spent;
    return `
      <div class="alert-row ${st}" id="alert-${b.id}">
        <span class="alert-icon">${st === 'danger' ? '🔴' : '⚠️'}</span>
        <div class="alert-body">
          <div class="alert-title">${st === 'danger' ? 'Budget Exceeded!' : 'Budget Warning'}</div>
          <div class="alert-desc">
            <strong>${cat.name}</strong> — ${formatCurrency(b.spent)} of ${formatCurrency(b.amount)} used
            ${rem > 0 ? `(${formatCurrency(rem)} left)` : ''}
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${st === 'danger' ? '#ef4444' : '#f59e0b'}"></div></div>
        </div>
        <button class="alert-dismiss" onclick="dismissAlert('${b.id}')">✕</button>
      </div>
    `;
  }).join('');
}

function dismissAlert(id) {
  const dismissed = JSON.parse(sessionStorage.getItem('dismissed-alerts') || '[]');
  dismissed.push(id);
  sessionStorage.setItem('dismissed-alerts', JSON.stringify(dismissed));
  renderBudgetAlerts();
}

function renderAccountsList() {
  const el = document.getElementById('accounts-list-dash');
  if (!el) return;
  el.innerHTML = state.accounts.map(a => `
    <div class="account-row">
      <div class="account-icon" style="background:${a.color}22">${a.icon}</div>
      <div>
        <div class="account-name">${a.name}</div>
        <div class="account-type">${a.type}</div>
      </div>
      <div class="account-balance ${a.balance < 0 ? 'negative' : 'positive'}">
        ${a.balance < 0 ? '-' : ''}${formatCurrency(Math.abs(a.balance))}
      </div>
    </div>
  `).join('');
}

function renderRecentTransactions() {
  const el = document.getElementById('recent-tx-list');
  if (!el) return;
  const recent = [...state.transactions].slice(0, 8);
  el.querySelector('.tx-count').textContent = state.transactions.length + ' total transactions';
  const listEl = el.querySelector('.tx-list');
  if (recent.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">💸</div><p>No transactions yet</p><small>Add your first transaction</small></div>`;
    return;
  }
  listEl.innerHTML = recent.map(t => {
    const cat  = state.categories.find(c => c.id === t.categoryId) || { name: 'Unknown', color: '#94a3b8', icon: 'other' };
    const acc  = state.accounts.find(a => a.id === t.accountId) || { name: 'Unknown' };
    const sign = t.type === 'income' ? '+' : t.type === 'transfer' ? '→' : '-';
    return `
      <div class="tx-row">
        <div class="tx-icon" style="background:${cat.color}22">${EMOJI_MAP[cat.icon] || '📦'}</div>
        <div class="tx-desc">
          <div class="tx-name">${t.description}</div>
          <div class="tx-meta">${cat.name} • ${acc.name}</div>
        </div>
        <div class="tx-date">${formatDate(t.date, true)}</div>
        <div class="tx-amount">
          <div class="tx-amount-val ${t.type}">${sign}${formatCurrency(t.amount)}</div>
          <div><span class="badge badge-${t.type}">${t.type.charAt(0).toUpperCase() + t.type.slice(1)}</span></div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Cash Flow Chart (Canvas) ──────────────────────────────────────
function renderCashFlowChart() {
  const canvas = document.getElementById('cashflow-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const data = buildCashFlow();

  const W = canvas.offsetWidth || 400;
  const H = 220;
  canvas.width  = W * devicePixelRatio;
  canvas.height = H * devicePixelRatio;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const pad = { top: 16, right: 16, bottom: 36, left: 50 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expense)), 1);

  ctx.clearRect(0, 0, W, H);

  // Grid lines
  const isDark = document.body.classList.contains('dark');
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const textColor = isDark ? '#64748b' : '#94a3b8';
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + chartH - (i / 4) * chartH;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y); ctx.stroke();
    ctx.fillStyle = textColor;
    ctx.font = '10px Inter,sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('$' + ((maxVal * i / 4) >= 1000 ? ((maxVal * i / 4000).toFixed(0) + 'k') : (maxVal * i / 4).toFixed(0)), pad.left - 6, y + 4);
  }

  // X labels
  data.forEach((d, i) => {
    const x = pad.left + (i / (data.length - 1)) * chartW;
    ctx.fillStyle = textColor;
    ctx.font = '10px Inter,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.label, x, H - 8);
  });

  function drawArea(key, color) {
    const pts = data.map((d, i) => ({
      x: pad.left + (i / (data.length - 1)) * chartW,
      y: pad.top + chartH - (d[key] / maxVal) * chartH,
    }));

    // Fill
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pad.top + chartH);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, pad.top + chartH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
    grad.addColorStop(0, color + '44');
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();

    // Dots
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = isDark ? '#1e293b' : '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  drawArea('income', '#22c55e');
  drawArea('expense', '#ef4444');
}

// ── Pie Chart (Canvas) ────────────────────────────────────────────
function renderPieChart(data) {
  const canvas = document.getElementById('pie-canvas');
  const legendEl = document.getElementById('pie-legend');
  if (!canvas) return;
  if (data.length === 0) {
    canvas.style.display = 'none';
    if (legendEl) legendEl.innerHTML = '<p style="color:var(--text-muted);font-size:12px;text-align:center">No expense data this month</p>';
    return;
  }
  canvas.style.display = 'block';

  const SIZE = 180;
  canvas.width  = SIZE * devicePixelRatio;
  canvas.height = SIZE * devicePixelRatio;
  canvas.style.width  = SIZE + 'px';
  canvas.style.height = SIZE + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const cx = SIZE / 2, cy = SIZE / 2, r = 80, inner = 48;
  let startAngle = -Math.PI / 2;
  const total = data.reduce((s, d) => s + d.amount, 0);

  data.slice(0, 8).forEach(d => {
    const slice = (d.amount / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.fill();

    // % label inside slice
    if (d.pct >= 5) {
      const mid = startAngle + slice / 2;
      const lx = cx + (inner + (r - inner) * 0.5) * Math.cos(mid);
      const ly = cy + (inner + (r - inner) * 0.5) * Math.sin(mid);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Inter,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(d.pct.toFixed(0) + '%', lx, ly);
    }
    startAngle += slice;
  });

  // Donut hole
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.fillStyle = document.body.classList.contains('dark') ? '#1e293b' : '#fff';
  ctx.fill();

  // Legend
  if (legendEl) {
    legendEl.innerHTML = data.slice(0, 5).map(d => `
      <div class="pie-legend-row">
        <div class="pie-dot" style="background:${d.color}"></div>
        <span class="pie-cat-name">${d.name}</span>
        <span class="pie-cat-amt">${formatCurrency(d.amount)}</span>
        <span class="pie-cat-pct">${d.pct.toFixed(0)}%</span>
      </div>
    `).join('');
  }
}

// ── Transactions page ─────────────────────────────────────────────
let txFilter = { search: '', type: 'all', sort: 'newest' };

function renderTransactions() {
  const el = document.getElementById('tx-page-list');
  if (!el) return;

  let txs = [...state.transactions];

  // Filter
  if (txFilter.search) {
    const q = txFilter.search.toLowerCase();
    txs = txs.filter(t => t.description.toLowerCase().includes(q));
  }
  if (txFilter.type !== 'all') txs = txs.filter(t => t.type === txFilter.type);

  // Sort
  if (txFilter.sort === 'newest')  txs.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (txFilter.sort === 'oldest')  txs.sort((a, b) => new Date(a.date) - new Date(b.date));
  if (txFilter.sort === 'highest') txs.sort((a, b) => b.amount - a.amount);
  if (txFilter.sort === 'lowest')  txs.sort((a, b) => a.amount - b.amount);

  if (txs.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>No transactions found</p></div>`;
    return;
  }

  el.innerHTML = txs.map(t => {
    const cat  = state.categories.find(c => c.id === t.categoryId) || { name: 'Unknown', color: '#94a3b8', icon: 'other' };
    const acc  = state.accounts.find(a => a.id === t.accountId) || { name: 'Unknown' };
    const sign = t.type === 'income' ? '+' : t.type === 'transfer' ? '→' : '-';
    return `
      <div class="tx-full-row">
        <div class="tx-icon" style="background:${cat.color}22">${EMOJI_MAP[cat.icon] || '📦'}</div>
        <div class="tx-desc">
          <div class="tx-name">${t.description}</div>
          <div class="tx-meta">${cat.name} • ${acc.name} • ${formatDate(t.date, true)}</div>
        </div>
        <div class="tx-amount">
          <div class="tx-amount-val ${t.type}">${sign}${formatCurrency(t.amount)}</div>
          <span class="badge badge-${t.type}">${t.type.charAt(0).toUpperCase() + t.type.slice(1)}</span>
        </div>
        <div class="tx-actions">
          <button class="tx-edit-btn" onclick="openEditModal('${t.id}')">✏️ Edit</button>
          <button class="tx-del-btn"  onclick="deleteTransaction('${t.id}')">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

function deleteTransaction(id) {
  if (!confirm('Delete this transaction?')) return;
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveState();
  showToast('Transaction deleted');
  renderPage(currentPage);
}

// ── Budgets page ──────────────────────────────────────────────────
function renderBudgets() {
  const el = document.getElementById('budgets-grid');
  if (!el) return;
  el.innerHTML = state.budgets.map(b => {
    const cat = state.categories.find(c => c.id === b.categoryId) || { name: 'Unknown', icon: 'other', color: '#94a3b8' };
    const pct = Math.min((b.spent / b.amount) * 100, 100);
    const st  = budgetStatus(b.spent, b.amount);
    const barColor = st === 'danger' ? '#ef4444' : st === 'warning' ? '#f59e0b' : '#22c55e';
    const rem = Math.max(b.amount - b.spent, 0);
    return `
      <div class="glass-card budget-card">
        <div class="budget-cat">
          <div class="budget-cat-icon" style="background:${cat.color}22">${EMOJI_MAP[cat.icon] || '📦'}</div>
          <div>
            <div class="budget-cat-name">${cat.name}</div>
            <div class="budget-cat-period">${b.period}</div>
          </div>
          <button onclick="deleteBudget('${b.id}')" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:14px;color:var(--text-muted)">✕</button>
        </div>
        <div class="budget-amounts">
          <div>
            <div class="budget-spent-lbl">Spent</div>
            <div class="budget-spent-val">${formatCurrency(b.spent)}</div>
          </div>
          <div style="text-align:right">
            <div class="budget-limit">of ${formatCurrency(b.amount)}</div>
            <div class="budget-pct" style="color:${barColor}">${pct.toFixed(0)}%</div>
          </div>
        </div>
        <div class="budget-bar"><div class="budget-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
        <div class="budget-remaining">${rem > 0 ? formatCurrency(rem) + ' remaining' : 'Budget exceeded!'}</div>
      </div>
    `;
  }).join('');

  if (state.budgets.length === 0) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🎯</div><p>No budgets set</p><small>Click "Add Budget" to create one</small></div>`;
  }
}

function deleteBudget(id) {
  state.budgets = state.budgets.filter(b => b.id !== id);
  saveState();
  showToast('Budget removed');
  renderBudgets();
}

// ── Accounts page ─────────────────────────────────────────────────
function renderAccounts() {
  const el = document.getElementById('accounts-grid');
  if (!el) return;
  el.innerHTML = state.accounts.map(a => {
    const bal = a.balance;
    const color = bal < 0 ? '#ef4444' : '#22c55e';
    return `
      <div class="glass-card account-card">
        <div class="account-card-icon">${a.icon}</div>
        <div class="account-card-name">${a.name}${a.isDefault ? ' ⭐' : ''}</div>
        <div class="account-card-type">${a.type}</div>
        <div class="account-card-balance" style="color:${color}">
          ${bal < 0 ? '-' : ''}${formatCurrency(Math.abs(bal))}
        </div>
        <div class="account-card-currency">${a.currency}</div>
      </div>
    `;
  }).join('');
}

// ── Reports page ──────────────────────────────────────────────────
function renderReports() {
  const monthTxs = getMonthTxs();
  const { income, expense } = calcTotals(monthTxs);
  const savings = income > 0 ? ((income - expense) / income) * 100 : 0;

  const el = document.getElementById('reports-stats');
  if (el) {
    el.innerHTML = `
      <div class="glass-card report-stat">
        <div class="report-stat-lbl">Monthly Income</div>
        <div class="report-stat-val" style="color:#16a34a">${formatCurrency(income)}</div>
      </div>
      <div class="glass-card report-stat">
        <div class="report-stat-lbl">Monthly Expenses</div>
        <div class="report-stat-val" style="color:#dc2626">${formatCurrency(expense)}</div>
      </div>
      <div class="glass-card report-stat">
        <div class="report-stat-lbl">Savings Rate</div>
        <div class="report-stat-val" style="color:#7c3aed">${savings.toFixed(1)}%</div>
      </div>
    `;
  }

  // Category breakdown chart
  const breakdown = buildCategoryBreakdown(monthTxs);
  const repCatEl = document.getElementById('report-cat-list');
  if (repCatEl) {
    if (breakdown.length === 0) {
      repCatEl.innerHTML = '<p style="color:var(--text-muted);font-size:13px">No expenses this month</p>';
    } else {
      repCatEl.innerHTML = breakdown.map(d => `
        <div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-size:13px;color:var(--text-primary)">${EMOJI_MAP[d.icon]||'📦'} ${d.name}</span>
            <span style="font-size:13px;font-weight:600;color:var(--text-primary)">${formatCurrency(d.amount)}</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${d.pct.toFixed(0)}%;background:${d.color}"></div></div>
          <div style="display:flex;justify-content:space-between;margin-top:2px">
            <span style="font-size:11px;color:var(--text-muted)">${d.count} transactions</span>
            <span style="font-size:11px;color:var(--text-muted)">${d.pct.toFixed(1)}%</span>
          </div>
        </div>
      `).join('');
    }
  }
}

// ── Settings page ─────────────────────────────────────────────────
function renderSettings() {
  const el = document.getElementById('theme-toggle-setting');
  if (el) el.textContent = state.darkMode ? '🌙 Dark' : '☀️ Light';
}

// ── Transaction Modal ─────────────────────────────────────────────
let editingTxId = null;
let catDropdownOpen = false;
let selectedCatId = '';
let attachmentData = null;
let selectedType = 'expense';

function openAddModal() {
  editingTxId = null;
  selectedType = 'expense';
  selectedCatId = '';
  attachmentData = null;
  document.getElementById('modal-title').textContent = 'New Transaction';
  document.getElementById('modal-form').reset();
  document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('tx-amount').value = '';
  document.getElementById('tx-desc').value = '';
  document.getElementById('tx-tags').value = '';
  setModalType('expense');
  renderAccountOptions();
  closeCatDropdown();
  setCatSelected('');
  showModal();
}

function openEditModal(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;
  editingTxId = id;
  selectedType = tx.type;
  selectedCatId = tx.categoryId;
  attachmentData = tx.attachment || null;
  document.getElementById('modal-title').textContent = 'Edit Transaction';
  setModalType(tx.type);
  document.getElementById('tx-amount').value = tx.amount;
  document.getElementById('tx-date').value = tx.date;
  document.getElementById('tx-desc').value = tx.description;
  document.getElementById('tx-tags').value = (tx.tags || []).join(', ');
  renderAccountOptions(tx.accountId);
  setCatSelected(tx.categoryId);
  showModal();
}

function showModal() {
  document.getElementById('tx-modal').classList.add('open');
  document.getElementById('tx-amount').focus();
}

function closeModal() {
  document.getElementById('tx-modal').classList.remove('open');
  closeCatDropdown();
}

function setModalType(type) {
  selectedType = type;
  const colors = { income: '#22c55e', expense: '#ef4444', transfer: '#3b82f6' };
  const emojis = { income: '📈', expense: '💸', transfer: '🔄' };
  const labels = { income: 'Income', expense: 'Expense', transfer: 'Transfer' };
  const c = colors[type];

  document.querySelectorAll('.type-pill').forEach(p => {
    const t = p.dataset.type;
    p.classList.toggle('selected', t === type);
    if (t === type) {
      p.style.background = c + '20';
      p.style.borderColor = c + '50';
      p.style.color = c;
    } else {
      p.style.background = 'var(--bg-primary)';
      p.style.borderColor = 'var(--border)';
      p.style.color = 'var(--text-secondary)';
    }
  });

  // Modal icon
  const iconEl = document.getElementById('modal-type-icon');
  iconEl.style.background = c + '20';
  iconEl.textContent = emojis[type];

  // Amount color
  document.getElementById('tx-amount').style.color = c;

  // Submit button
  const btn = document.getElementById('submit-btn');
  btn.style.background = `linear-gradient(135deg, ${c}, ${c}cc)`;
  btn.textContent = editingTxId ? 'Update Transaction' : `Add ${labels[type]}`;

  // To-account row
  document.getElementById('to-account-row').style.display = type === 'transfer' ? 'block' : 'none';

  // Re-render categories
  renderCatOptions();
}

function renderAccountOptions(selectedId) {
  const sel = document.getElementById('tx-account');
  sel.innerHTML = state.accounts.map(a => `<option value="${a.id}" ${a.id === (selectedId || state.accounts[0]?.id) ? 'selected' : ''}>${a.icon} ${a.name}</option>`).join('');
  const sel2 = document.getElementById('tx-to-account');
  if (sel2) sel2.innerHTML = `<option value="">Select destination...</option>` + state.accounts.map(a => `<option value="${a.id}">${a.icon} ${a.name}</option>`).join('');
}

function renderCatOptions() {
  const wrap = document.getElementById('cat-options');
  const filtered = state.categories.filter(c => c.type === 'both' || c.type === selectedType || selectedType === 'transfer');
  wrap.innerHTML = filtered.map(c => `
    <div class="cat-option" onclick="selectCategory('${c.id}')">
      <div class="cat-icon-sm" style="background:${c.color}22">${EMOJI_MAP[c.icon] || '📦'}</div>
      <span>${c.name}</span>
      ${c.id === selectedCatId ? '<span class="cat-check">✓</span>' : ''}
    </div>
  `).join('');
}

function setCatSelected(id) {
  selectedCatId = id;
  const catBtnEl = document.getElementById('cat-select-btn');
  if (!id) {
    catBtnEl.innerHTML = `<span class="cat-placeholder">Select category...</span><span class="cat-chevron">▼</span>`;
    return;
  }
  const cat = state.categories.find(c => c.id === id);
  if (!cat) return;
  catBtnEl.innerHTML = `
    <div class="cat-icon-sm" style="background:${cat.color}22">${EMOJI_MAP[cat.icon] || '📦'}</div>
    <span>${cat.name}</span>
    <span class="cat-chevron">▼</span>
  `;
}

function toggleCatDropdown() {
  catDropdownOpen = !catDropdownOpen;
  renderCatOptions();
  document.getElementById('cat-dropdown').classList.toggle('open', catDropdownOpen);
}

function closeCatDropdown() {
  catDropdownOpen = false;
  document.getElementById('cat-dropdown')?.classList.remove('open');
}

function selectCategory(id) {
  selectedCatId = id;
  setCatSelected(id);
  closeCatDropdown();
}

function submitTransaction() {
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const desc   = document.getElementById('tx-desc').value.trim();
  const date   = document.getElementById('tx-date').value;
  const accId  = document.getElementById('tx-account').value;
  const tags   = document.getElementById('tx-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  const toAcc  = document.getElementById('tx-to-account')?.value || '';

  if (!desc)         { showToast('Please enter a description', 'error'); return; }
  if (!amount || amount <= 0) { showToast('Please enter a valid amount', 'error'); return; }
  if (!date)         { showToast('Please select a date', 'error'); return; }
  if (!selectedCatId){ showToast('Please select a category', 'error'); return; }

  const txData = {
    type: selectedType, amount, date, categoryId: selectedCatId,
    accountId: accId, description: desc, tags,
    currency: 'USD', attachment: attachmentData || undefined,
    toAccountId: toAcc || undefined, updatedAt: new Date().toISOString(),
  };

  if (editingTxId) {
    state.transactions = state.transactions.map(t => t.id === editingTxId ? { ...t, ...txData } : t);
    showToast('Transaction updated! ✅');
  } else {
    state.transactions.unshift({ ...txData, id: generateId(), createdAt: new Date().toISOString() });
    showToast('Transaction added! ✅');
  }

  saveState();
  closeModal();
  renderPage(currentPage);
}

// ── Budget Modal ──────────────────────────────────────────────────
function openAddBudgetModal() {
  document.getElementById('budget-modal')?.classList.add('open');
}

function closeBudgetModal() {
  document.getElementById('budget-modal')?.classList.remove('open');
}

function submitBudget() {
  const catId  = document.getElementById('budget-cat').value;
  const amount = parseFloat(document.getElementById('budget-amount').value);
  const period = document.getElementById('budget-period').value;

  if (!catId || !amount || amount <= 0) { showToast('Fill all fields', 'error'); return; }

  state.budgets.push({ id: generateId(), categoryId: catId, amount, period, spent: 0, alerts: true, alertThreshold: 80 });
  saveState();
  closeBudgetModal();
  showToast('Budget created! 🎯');
  renderBudgets();
}

function renderBudgetCatOptions() {
  const sel = document.getElementById('budget-cat');
  if (!sel) return;
  const used = state.budgets.map(b => b.categoryId);
  const available = state.categories.filter(c => c.type === 'expense' && !used.includes(c.id));
  sel.innerHTML = available.map(c => `<option value="${c.id}">${EMOJI_MAP[c.icon] || '📦'} ${c.name}</option>`).join('');
}

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Theme
  if (state.darkMode) document.body.classList.add('dark');

  // Sidebar state
  if (!state.sidebarOpen) {
    document.querySelector('.sidebar')?.classList.add('collapsed');
    const icon = document.getElementById('sidebar-toggle-icon');
    if (icon) icon.textContent = '›';
  }

  // Greeting
  const greetEl = document.getElementById('header-greeting');
  if (greetEl) greetEl.textContent = `Good ${getGreeting()}, John 👋`;

  // Nav items click
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.page));
  });

  // Sidebar toggle
  document.querySelector('.sidebar-toggle')?.addEventListener('click', toggleSidebar);

  // Theme toggle
  document.getElementById('theme-btn')?.addEventListener('click', toggleTheme);

  // Add transaction buttons
  document.querySelectorAll('[data-open-modal="transaction"]').forEach(btn => {
    btn.addEventListener('click', openAddModal);
  });

  // Close modal backdrop
  document.getElementById('tx-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('tx-modal')) closeModal();
  });

  // Type pills
  document.querySelectorAll('.type-pill').forEach(pill => {
    pill.addEventListener('click', () => setModalType(pill.dataset.type));
  });

  // Category dropdown
  document.getElementById('cat-select-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    toggleCatDropdown();
  });
  document.addEventListener('click', e => {
    if (!document.getElementById('cat-dropdown-wrap')?.contains(e.target)) {
      closeCatDropdown();
    }
  });

  // Submit modal
  document.getElementById('submit-btn')?.addEventListener('click', submitTransaction);
  document.getElementById('cancel-btn')?.addEventListener('click', closeModal);
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);

  // File upload
  document.getElementById('file-input')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('File too large (max 5MB)', 'error'); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
      attachmentData = reader.result;
      document.getElementById('upload-label').textContent = '✅ ' + file.name;
    };
    reader.readAsDataURL(file);
  });

  // Transactions filter
  document.getElementById('tx-search')?.addEventListener('input', e => {
    txFilter.search = e.target.value;
    renderTransactions();
  });
  document.getElementById('tx-type-filter')?.addEventListener('change', e => {
    txFilter.type = e.target.value;
    renderTransactions();
  });
  document.getElementById('tx-sort')?.addEventListener('change', e => {
    txFilter.sort = e.target.value;
    renderTransactions();
  });

  // Budget modal
  document.getElementById('add-budget-btn')?.addEventListener('click', () => {
    renderBudgetCatOptions();
    openAddBudgetModal();
  });
  document.getElementById('budget-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('budget-modal')) closeBudgetModal();
  });
  document.getElementById('budget-submit-btn')?.addEventListener('click', submitBudget);
  document.getElementById('budget-cancel-btn')?.addEventListener('click', closeBudgetModal);

  // Settings theme toggle
  document.getElementById('settings-theme-btn')?.addEventListener('click', () => {
    toggleTheme();
    renderSettings();
  });

  // Settings reset data
  document.getElementById('reset-data-btn')?.addEventListener('click', () => {
    if (!confirm('This will reset all data to defaults. Continue?')) return;
    state.transactions = DEFAULT_TRANSACTIONS.map(t => ({ ...t, id: generateId() }));
    state.accounts     = DEFAULT_ACCOUNTS;
    state.categories   = DEFAULT_CATEGORIES;
    state.budgets      = DEFAULT_BUDGETS;
    saveState();
    showToast('Data reset to defaults');
    renderPage(currentPage);
  });

  // FAB
  document.querySelector('.fab')?.addEventListener('click', openAddModal);

  // View all transactions link
  document.getElementById('view-all-tx')?.addEventListener('click', () => navigateTo('transactions'));

  // Start on dashboard
  navigateTo('dashboard');

  // Redraw charts on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (currentPage === 'dashboard') {
        renderCashFlowChart();
        renderPieChart(buildCategoryBreakdown(getMonthTxs()));
      }
    }, 200);
  });
});
