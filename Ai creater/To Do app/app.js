/**
 * قائمتي (My Tasks) - Smart Modern To-Do Web Application
 */

// --- Default Seed Tasks ---
const DEFAULT_TASKS = [
  {
    id: 'seed-1',
    title: 'تحديد أهداف الأسبوع والتخطيط لها 🎯',
    priority: 'high',
    category: 'work',
    dueDate: new Date().toISOString().split('T')[0],
    completed: false,
    createdAt: Date.now() - 3600000 * 4
  },
  {
    id: 'seed-2',
    title: 'ممارسة رياضة المشي أو الجري لمدة 30 دقيقة 🏃‍♂️',
    priority: 'medium',
    category: 'personal',
    dueDate: new Date().toISOString().split('T')[0],
    completed: true,
    createdAt: Date.now() - 3600000 * 3
  },
  {
    id: 'seed-3',
    title: 'قراءة 20 صفحة من كتاب مفيد 📖',
    priority: 'low',
    category: 'study',
    dueDate: '',
    completed: false,
    createdAt: Date.now() - 3600000 * 2
  }
];

// --- App State ---
let tasks = [];
let currentFilter = 'all'; // 'all' | 'active' | 'completed'
let currentCategory = 'all';
let searchQuery = '';
let soundEnabled = true;
let recentlyDeleted = null;
let undoTimeoutId = null;

// --- Category Labels Mapping ---
const CATEGORY_NAMES = {
  general: '📌 عام',
  work: '💼 العمل',
  study: '📚 الدراسة',
  personal: '👤 شخصي',
  shopping: '🛒 مشتريات'
};

// --- Web Audio API Chimes ---
class SoundManager {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  }

  playPop() {
    if (!soundEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (e) {
      // Audio autoplay restrictions or errors
    }
  }

  playCompletion() {
    if (!soundEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.24); // C6

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(now + 0.45);
    } catch (e) {
      // Audio autoplay restrictions or errors
    }
  }
}

const sounds = new SoundManager();

// --- DOM Elements ---
const elements = {
  currentDate: document.getElementById('current-date'),
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  themeIcon: document.getElementById('theme-icon'),
  soundToggleBtn: document.getElementById('sound-toggle-btn'),
  soundIcon: document.getElementById('sound-icon'),
  todoForm: document.getElementById('todo-form'),
  taskTitle: document.getElementById('task-title'),
  taskPriority: document.getElementById('task-priority'),
  taskCategory: document.getElementById('task-category'),
  taskDueDate: document.getElementById('task-due-date'),
  searchInput: document.getElementById('search-input'),
  filterBtns: document.querySelectorAll('.filter-btn'),
  categoryFilter: document.getElementById('category-filter'),
  taskList: document.getElementById('task-list'),
  emptyState: document.getElementById('empty-state'),
  progressBarFill: document.getElementById('progress-bar-fill'),
  progressPercent: document.getElementById('progress-percent'),
  progressSummary: document.getElementById('progress-summary'),
  statTotal: document.getElementById('stat-total'),
  statPending: document.getElementById('stat-pending'),
  statCompleted: document.getElementById('stat-completed'),
  clearCompletedBtn: document.getElementById('clear-completed-btn'),
  exportBtn: document.getElementById('export-btn'),
  importBtn: document.getElementById('import-btn'),
  importFileInput: document.getElementById('import-file-input'),
  toastContainer: document.getElementById('toast-container'),
  // Modal
  editModal: document.getElementById('edit-modal'),
  editForm: document.getElementById('edit-form'),
  closeModalBtn: document.getElementById('close-modal-btn'),
  cancelEditBtn: document.getElementById('cancel-edit-btn'),
  editTaskId: document.getElementById('edit-task-id'),
  editTaskTitle: document.getElementById('edit-task-title'),
  editTaskPriority: document.getElementById('edit-task-priority'),
  editTaskCategory: document.getElementById('edit-task-category'),
  editTaskDueDate: document.getElementById('edit-task-due-date')
};

// --- Initialization ---
function initApp() {
  loadDate();
  loadTheme();
  loadSoundSetting();
  loadTasks();
  setupEventListeners();
  renderTasks();
  updateStats();
  if (window.lucide) {
    lucide.createIcons();
  }
}

// Display formatted Arabic date
function loadDate() {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const today = new Date();
  elements.currentDate.textContent = today.toLocaleDateString('ar-EG', options);
}

// --- Theme Management ---
function loadTheme() {
  const savedTheme = localStorage.getItem('todo_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('todo_theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  if (theme === 'dark') {
    elements.themeIcon.setAttribute('data-lucide', 'sun');
  } else {
    elements.themeIcon.setAttribute('data-lucide', 'moon');
  }
  if (window.lucide) lucide.createIcons();
}

// --- Sound Setting ---
function loadSoundSetting() {
  const saved = localStorage.getItem('todo_sound');
  if (saved !== null) {
    soundEnabled = saved === 'true';
  }
  updateSoundIcon();
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem('todo_sound', soundEnabled);
  updateSoundIcon();
  showToast(soundEnabled ? 'تم تفعيل الأصوات 🔊' : 'تم كتم الأصوات 🔇');
}

function updateSoundIcon() {
  elements.soundIcon.setAttribute('data-lucide', soundEnabled ? 'volume-2' : 'volume-x');
  if (window.lucide) lucide.createIcons();
}

// --- LocalStorage Persistence ---
function loadTasks() {
  const saved = localStorage.getItem('todo_tasks');
  if (saved) {
    try {
      tasks = JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing stored tasks', e);
      tasks = DEFAULT_TASKS;
    }
  } else {
    tasks = DEFAULT_TASKS;
    saveTasks();
  }
}

function saveTasks() {
  localStorage.setItem('todo_tasks', JSON.stringify(tasks));
}

// --- Task CRUD ---
function addTask(title, priority, category, dueDate) {
  const newTask = {
    id: 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    title: title.trim(),
    priority: priority || 'medium',
    category: category || 'general',
    dueDate: dueDate || '',
    completed: false,
    createdAt: Date.now()
  };

  tasks.unshift(newTask);
  saveTasks();
  renderTasks();
  updateStats();
  sounds.playPop();
  showToast('تمت إضافة المهمة بنجاح! ✨');
}

function toggleTaskStatus(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  task.completed = !task.completed;
  saveTasks();
  renderTasks();
  updateStats();

  if (task.completed) {
    sounds.playCompletion();
    triggerCelebration();
  }
}

function deleteTask(id) {
  const index = tasks.findIndex(t => t.id === id);
  if (index === -1) return;

  const deleted = tasks.splice(index, 1)[0];
  saveTasks();
  renderTasks();
  updateStats();

  // Allow undo
  recentlyDeleted = { task: deleted, index };
  showUndoToast('تم حذف المهمة');
}

function undoDelete() {
  if (!recentlyDeleted) return;
  tasks.splice(recentlyDeleted.index, 0, recentlyDeleted.task);
  saveTasks();
  renderTasks();
  updateStats();
  recentlyDeleted = null;
  showToast('تم استرجاع المهمة بنجاح ↩️');
}

function openEditModal(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  elements.editTaskId.value = task.id;
  elements.editTaskTitle.value = task.title;
  elements.editTaskPriority.value = task.priority;
  elements.editTaskCategory.value = task.category;
  elements.editTaskDueDate.value = task.dueDate || '';

  elements.editModal.classList.remove('hidden');
  elements.editTaskTitle.focus();
}

function closeEditModal() {
  elements.editModal.classList.add('hidden');
}

function handleEditFormSubmit(e) {
  e.preventDefault();
  const id = elements.editTaskId.value;
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  task.title = elements.editTaskTitle.value.trim();
  task.priority = elements.editTaskPriority.value;
  task.category = elements.editTaskCategory.value;
  task.dueDate = elements.editTaskDueDate.value;

  saveTasks();
  closeEditModal();
  renderTasks();
  updateStats();
  showToast('تم تحديث المهمة بنجاح 💾');
}

// --- Confetti Animation ---
function triggerCelebration() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#6366f1', '#a855f7', '#ec4899', '#10b981']
    });
  }
}

// --- Render Logic ---
function renderTasks() {
  elements.taskList.innerHTML = '';

  const filteredTasks = tasks.filter(task => {
    // Status filter
    if (currentFilter === 'active' && task.completed) return false;
    if (currentFilter === 'completed' && !task.completed) return false;

    // Category filter
    if (currentCategory !== 'all' && task.category !== currentCategory) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchCat = (CATEGORY_NAMES[task.category] || '').toLowerCase().includes(q);
      if (!matchTitle && !matchCat) return false;
    }

    return true;
  });

  if (filteredTasks.length === 0) {
    elements.emptyState.classList.remove('hidden');
  } else {
    elements.emptyState.classList.add('hidden');
    filteredTasks.forEach(task => {
      elements.taskList.appendChild(createTaskElement(task));
    });
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

function createTaskElement(task) {
  const li = document.createElement('li');
  li.className = `task-item priority-${task.priority} ${task.completed ? 'completed' : ''}`;
  li.dataset.id = task.id;

  // Format Due Date
  let dueHtml = '';
  if (task.dueDate) {
    const todayStr = new Date().toISOString().split('T')[0];
    const isOverdue = !task.completed && task.dueDate < todayStr;
    const isToday = task.dueDate === todayStr;

    let dueText = task.dueDate;
    if (isToday) dueText = 'اليوم';

    dueHtml = `
      <span class="tag tag-due ${isOverdue ? 'overdue' : ''}">
        <i data-lucide="${isOverdue ? 'alert-triangle' : 'calendar'}"></i>
        ${dueText}
      </span>
    `;
  }

  const categoryName = CATEGORY_NAMES[task.category] || '📌 عام';

  li.innerHTML = `
    <div class="task-left">
      <button class="custom-checkbox" aria-label="تبديل حالة المهمة">
        <i data-lucide="check"></i>
      </button>
      <div class="task-details">
        <span class="task-title">${escapeHtml(task.title)}</span>
        <div class="task-meta-tags">
          <span class="tag tag-category">${categoryName}</span>
          ${dueHtml}
        </div>
      </div>
    </div>
    <div class="task-actions">
      <button class="action-btn edit-btn" title="تعديل">
        <i data-lucide="pencil"></i>
      </button>
      <button class="action-btn delete-btn" title="حذف">
        <i data-lucide="trash-2"></i>
      </button>
    </div>
  `;

  // Attach event listeners
  const checkbox = li.querySelector('.custom-checkbox');
  checkbox.addEventListener('click', () => toggleTaskStatus(task.id));

  const editBtn = li.querySelector('.edit-btn');
  editBtn.addEventListener('click', () => openEditModal(task.id));

  const deleteBtn = li.querySelector('.delete-btn');
  deleteBtn.addEventListener('click', () => deleteTask(task.id));

  return li;
}

// --- Stats and Progress ---
function updateStats() {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pending = total - completed;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  elements.statTotal.textContent = total;
  elements.statPending.textContent = pending;
  elements.statCompleted.textContent = completed;

  elements.progressPercent.textContent = `${percent}%`;
  elements.progressBarFill.style.width = `${percent}%`;
  elements.progressSummary.textContent = `أنجزت ${completed} من إجمالي ${total} مهام`;

  if (total > 0 && completed === total) {
    elements.progressSummary.textContent = `رائع جداً! لقد أكملت جميع المهام اليوم 🚀`;
  }
}

// --- Helpers ---
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${message}</span>`;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 2800);
}

function showUndoToast(message) {
  if (undoTimeoutId) {
    clearTimeout(undoTimeoutId);
  }

  // Clear existing toasts
  elements.toastContainer.innerHTML = '';

  const toast = document.createElement('div');
  toast.className = 'toast toast-undo';
  toast.innerHTML = `
    <span>${message}</span>
    <span class="toast-undo-action">تراجع</span>
  `;

  const undoAction = toast.querySelector('.toast-undo-action');
  undoAction.addEventListener('click', () => {
    undoDelete();
    toast.remove();
  });

  elements.toastContainer.appendChild(toast);

  undoTimeoutId = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
    recentlyDeleted = null;
  }, 4500);
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Theme and sound toggles
  elements.themeToggleBtn.addEventListener('click', toggleTheme);
  elements.soundToggleBtn.addEventListener('click', toggleSound);

  // Add Task Form Submit
  elements.todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = elements.taskTitle.value.trim();
    if (!title) return;

    addTask(
      title,
      elements.taskPriority.value,
      elements.taskCategory.value,
      elements.taskDueDate.value
    );

    elements.taskTitle.value = '';
    elements.taskDueDate.value = '';
    elements.taskTitle.focus();
  });

  // Filter Buttons
  elements.filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderTasks();
    });
  });

  // Category Filter
  elements.categoryFilter.addEventListener('change', (e) => {
    currentCategory = e.target.value;
    renderTasks();
  });

  // Search Input
  elements.searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderTasks();
  });

  // Clear Completed
  elements.clearCompletedBtn.addEventListener('click', () => {
    const hasCompleted = tasks.some(t => t.completed);
    if (!hasCompleted) {
      showToast('لا توجد مهام مكتملة لحذفها');
      return;
    }
    if (confirm('هل أنت متأكد من حذف جميع المهام المكتملة؟')) {
      tasks = tasks.filter(t => !t.completed);
      saveTasks();
      renderTasks();
      updateStats();
      showToast('تم حذف المهام المكتملة 🧹');
    }
  });

  // Export JSON
  elements.exportBtn.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tasks, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `my-tasks-backup-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('تم تصدير نسخة المهام بنجاح! 📥');
  });

  // Import JSON
  elements.importBtn.addEventListener('click', () => {
    elements.importFileInput.click();
  });

  elements.importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedTasks = JSON.parse(event.target.result);
        if (Array.isArray(importedTasks)) {
          tasks = importedTasks;
          saveTasks();
          renderTasks();
          updateStats();
          showToast('تم استيراد المهام بنجاح! 🎉');
        } else {
          alert('الملف غير صالح أو لا يحتوي على قائمة مهام صحيحة.');
        }
      } catch (err) {
        alert('حدث خطأ أثناء قراءة الملف. يرجى التأكد من أنه ملف JSON صالح.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  });

  // Edit Modal Events
  elements.editForm.addEventListener('submit', handleEditFormSubmit);
  elements.closeModalBtn.addEventListener('click', closeEditModal);
  elements.cancelEditBtn.addEventListener('click', closeEditModal);
  elements.editModal.addEventListener('click', (e) => {
    if (e.target === elements.editModal) closeEditModal();
  });
}

// Start app on DOMContentLoaded
document.addEventListener('DOMContentLoaded', initApp);
