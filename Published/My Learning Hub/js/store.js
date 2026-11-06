// store.js - Data Store & LocalStorage Management for My Learning Journey
(function(window) {
  'use strict';

  const STORAGE_KEY = 'my_learning_journey_data_v1';
  const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
  const TOUCHED_KEY = 'my_learning_journey_touched_v1';

  // ---------------- Pure helpers (no DOM, testable in Node) ---------------- //
  const DOMAIN_STATUSES = ['active', 'paused', 'completed'];
  const TASK_STATUSES = ['todo', 'in-progress', 'completed'];
  const PROJECT_STATUSES = ['planned', 'in-progress', 'completed'];
  const PRIORITIES = ['urgent', 'high', 'medium', 'low'];
  const RESOURCE_TYPES = ['youtube', 'course', 'book', 'website', 'article', 'other'];
  const DOMAIN_ICONS = ['code', 'chart', 'languages', 'book', 'design', 'brain'];
  const DEFAULT_POMODORO = { focus: 25, short: 5, long: 15 };

  let uidCounter = 0;
  function uid(prefix) {
    uidCounter = (uidCounter + 1) % 1679616;
    const rnd = Math.random().toString(36).slice(2, 8);
    return `${prefix}-${Date.now().toString(36)}${uidCounter.toString(36)}${rnd}`;
  }

  // Local calendar date (YYYY-MM-DD). toISOString() would give the UTC date,
  // which is wrong for users ahead of / behind UTC around midnight.
  function localDate(d) {
    const date = d || new Date();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${m}-${day}`;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Only http(s) links are allowed. Returns '' for anything else (javascript:, data:, ...).
  function safeUrl(value) {
    if (typeof value !== 'string') return '';
    let v = value.trim();
    if (!v || v.length > 2048) return '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v;
    try {
      const u = new URL(v);
      return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : '';
    } catch (e) {
      return '';
    }
  }

  // Arabic-friendly normalisation for search (diacritics, alef/yeh/teh-marbuta variants).
  function normalizeText(value) {
    return String(value == null ? '' : value)
      .toLowerCase()
      .replace(/[ً-ٰٟـ]/g, '')
      .replace(/[آأإ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .trim();
  }

  const cleanStr = (v, max = 2000, def = '') =>
    typeof v === 'string' ? v.slice(0, max) : (typeof v === 'number' && isFinite(v) ? String(v) : def);
  const oneOf = (v, list, def) => (list.includes(v) ? v : def);
  const cleanColor = (v, def = '#3B82F6') => (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : def);
  const cleanDate = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  const cleanIso = (v) => (typeof v === 'string' && !isNaN(Date.parse(v)) ? v.slice(0, 40) : '');
  const cleanNum = (v, max = 100000) => {
    const n = Number(v);
    return isFinite(n) ? Math.min(max, Math.max(0, n)) : 0;
  };
  const cleanId = (v) => (typeof v === 'string' ? v.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80) : '');
  const asArray = (v, max = 5000) => (Array.isArray(v) ? v.filter(x => x && typeof x === 'object').slice(0, max) : []);

  function makeIdAllocator() {
    const seen = new Set();
    return (raw, prefix) => {
      let id = cleanId(raw);
      if (!id || seen.has(id)) id = uid(prefix);
      seen.add(id);
      return id;
    };
  }

  // Stable fingerprint of the data, ignoring the volatile lastUpdated stamp (used by cloud sync).
  function hashData(data) {
    const text = JSON.stringify({ ...data, lastUpdated: '' });
    let h1 = 5381, h2 = 52711;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      h1 = ((h1 * 33) ^ c) >>> 0;
      h2 = ((h2 * 31) + c) >>> 0;
    }
    return `${text.length}-${h1.toString(36)}-${h2.toString(36)}`;
  }

  // Union by id: items of `primary` win, items only present in `secondary` are appended.
  function unionById(primary, secondary) {
    const seen = new Set((primary || []).map(x => x.id));
    return [...(primary || []), ...(secondary || []).filter(x => !seen.has(x.id))];
  }

  // Non-destructive merge of two sanitised datasets (local wins ties). Nothing from either side is lost;
  // the trade-off is that an item deleted on one device can reappear if the other device still has it.
  function mergeData(local, remote) {
    const time = (d) => Date.parse(d && d.updatedAt) || 0;
    const remoteById = new Map(remote.domains.map(d => [d.id, d]));
    const domains = local.domains.map(ld => {
      const rd = remoteById.get(ld.id);
      if (!rd) return ld;
      const [a, b] = time(rd) > time(ld) ? [rd, ld] : [ld, rd];
      const stages = unionById(a.stages, b.stages).map(st => {
        const other = (a === ld ? rd : ld).stages.find(x => x.id === st.id);
        return other && other !== st ? { ...st, tasks: unionById(st.tasks, other.tasks) } : st;
      });
      return {
        ...a,
        stages,
        resources: unionById(a.resources, b.resources),
        projects: unionById(a.projects, b.projects),
        notes: unionById(a.notes, b.notes)
      };
    });
    const merged = {
      ...local,
      domains: unionById(domains, remote.domains),
      dailyTasks: unionById(local.dailyTasks, remote.dailyTasks),
      activityLog: unionById(local.activityLog, remote.activityLog)
        .sort((x, y) => (Date.parse(y.timestamp) || 0) - (Date.parse(x.timestamp) || 0)).slice(0, 100),
      focusSessions: unionById(local.focusSessions, remote.focusSessions),
      learningLogs: unionById(local.learningLogs || [], remote.learningLogs || []).slice(-5000),
      settings: {
        ...local.settings,
        studyHoursTracked: Math.max(local.settings.studyHoursTracked || 0, remote.settings.studyHoursTracked || 0)
      }
    };
    return sanitizeData(merged);
  }

  function defaultData() {
    return {
      version: '1.1.0',
      lastUpdated: new Date().toISOString(),
      settings: { theme: 'light', userName: 'متعلم', studyHoursTracked: 0, pomodoro: { ...DEFAULT_POMODORO } },
      domains: [],
      dailyTasks: [],
      activityLog: [],
      focusSessions: [],
      learningLogs: []
    };
  }

  // Validates and normalises untrusted data (imported file or corrupted storage).
  // Throws an Error with an Arabic message when the structure is unusable.
  function sanitizeData(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('ملف البيانات غير صالح: الجذر ليس كائناً');
    }
    if (!Array.isArray(raw.domains)) {
      throw new Error('ملف البيانات غير صالح: مصفوفة المجالات مفقودة');
    }

    const out = defaultData();
    const rs = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    const rp = rs.pomodoro && typeof rs.pomodoro === 'object' ? rs.pomodoro : {};
    const mins = (v, def) => { const n = Math.round(Number(v)); return n >= 1 && n <= 180 ? n : def; };
    out.version = cleanStr(raw.version, 20, out.version);
    out.lastUpdated = cleanIso(raw.lastUpdated) || out.lastUpdated;
    out.settings = {
      theme: oneOf(rs.theme, ['light', 'dark'], 'light'),
      userName: cleanStr(rs.userName, 60, 'متعلم'),
      studyHoursTracked: cleanNum(rs.studyHoursTracked, 100000),
      pomodoro: {
        focus: mins(rp.focus, DEFAULT_POMODORO.focus),
        short: mins(rp.short, DEFAULT_POMODORO.short),
        long: mins(rp.long, DEFAULT_POMODORO.long)
      }
    };

    const domainId = makeIdAllocator();
    const stageIds = new Set();
    out.domains = asArray(raw.domains, 500).map(d => {
      const stageId = makeIdAllocator();
      const taskId = makeIdAllocator();
      const resId = makeIdAllocator();
      const projId = makeIdAllocator();
      const noteId = makeIdAllocator();
      const domain = {
        id: domainId(d.id, 'domain'),
        name: cleanStr(d.name, 200, 'مجال تعليمي'),
        icon: oneOf(d.icon, DOMAIN_ICONS, 'book'),
        color: cleanColor(d.color),
        description: cleanStr(d.description, 2000),
        targetGoal: cleanStr(d.targetGoal, 1000),
        startDate: cleanDate(d.startDate),
        targetDate: cleanDate(d.targetDate),
        currentLevel: cleanStr(d.currentLevel, 100),
        targetLevel: cleanStr(d.targetLevel, 100),
        status: oneOf(d.status, DOMAIN_STATUSES, 'active'),
        createdAt: cleanIso(d.createdAt) || new Date().toISOString(),
        stages: asArray(d.stages, 200).map(st => {
          const stage = {
            id: stageId(st.id, 'stage'),
            title: cleanStr(st.title, 200, 'مرحلة'),
            description: cleanStr(st.description, 2000),
            status: oneOf(st.status, TASK_STATUSES, 'todo'),
            tasks: asArray(st.tasks, 1000).map(t => {
              const task = {
                id: taskId(t.id, 'task'),
                title: cleanStr(t.title, 300, 'مهمة'),
                description: cleanStr(t.description, 2000),
                priority: oneOf(t.priority, PRIORITIES, 'medium'),
                status: oneOf(t.status, TASK_STATUSES, 'todo'),
                dueDate: cleanDate(t.dueDate),
                estimatedHours: cleanNum(t.estimatedHours, 10000),
                notes: cleanStr(t.notes, 2000),
                links: (Array.isArray(t.links) ? t.links : []).map(safeUrl).filter(Boolean).slice(0, 10),
                createdAt: cleanIso(t.createdAt) || new Date().toISOString()
              };
              const done = cleanIso(t.completedAt);
              if (done) task.completedAt = done;
              return task;
            })
          };
          stageIds.add(stage.id);
          return stage;
        }),
        resources: asArray(d.resources, 1000).map(r => ({
          id: resId(r.id, 'res'),
          title: cleanStr(r.title, 300, 'مصدر تعليمي'),
          url: safeUrl(r.url),
          type: oneOf(r.type, RESOURCE_TYPES, 'other'),
          description: cleanStr(r.description, 2000)
        })),
        projects: asArray(d.projects, 500).map(p => ({
          id: projId(p.id, 'proj'),
          title: cleanStr(p.title, 300, 'مشروع'),
          description: cleanStr(p.description, 2000),
          skills: cleanStr(p.skills, 500),
          tasksNeeded: cleanStr(p.tasksNeeded, 2000),
          status: oneOf(p.status, PROJECT_STATUSES, 'planned'),
          liveUrl: safeUrl(p.liveUrl),
          repoUrl: safeUrl(p.repoUrl)
        })),
        notes: asArray(d.notes, 1000).map(n => ({
          id: noteId(n.id, 'note'),
          title: cleanStr(n.title, 300, 'ملاحظة'),
          content: cleanStr(n.content, 20000),
          updatedAt: cleanDate(n.updatedAt) || localDate()
        }))
      };
      const upd = cleanIso(d.updatedAt);
      if (upd) domain.updatedAt = upd;
      return domain;
    });

    const dailyId = makeIdAllocator();
    out.dailyTasks = asArray(raw.dailyTasks, 5000).map(t => ({
      id: dailyId(t.id, 'daily'),
      domainId: cleanId(t.domainId) || null,
      stageId: cleanId(t.stageId) || null,
      taskId: cleanId(t.taskId) || null,
      title: cleanStr(t.title, 300, 'مهمة اليوم'),
      domainName: cleanStr(t.domainName, 200, 'مهمة حرة'),
      domainColor: cleanColor(t.domainColor),
      priority: oneOf(t.priority, PRIORITIES, 'medium'),
      estimatedHours: cleanNum(t.estimatedHours, 1000),
      date: cleanDate(t.date),
      completed: !!t.completed,
      notes: cleanStr(t.notes, 2000)
    }));

    const actId = makeIdAllocator();
    out.activityLog = asArray(raw.activityLog, 100).map(a => ({
      id: actId(a.id, 'act'),
      type: cleanStr(a.type, 40),
      domainId: cleanId(a.domainId) || null,
      domainName: cleanStr(a.domainName, 200, 'عام'),
      title: cleanStr(a.title, 500),
      timestamp: cleanIso(a.timestamp) || new Date().toISOString()
    }));

    const logId = makeIdAllocator();
    out.learningLogs = asArray(raw.learningLogs, 5000).map(l => ({
      id: logId(l.id, 'learn'), date: cleanDate(l.date) || localDate(),
      domainId: cleanId(l.domainId) || null, domainName: cleanStr(l.domainName, 200, 'تعلم عام'),
      minutes: Math.max(1, Math.min(1440, Math.round(cleanNum(l.minutes, 1440)))),
      summary: cleanStr(l.summary, 1200), concentration: oneOf(l.concentration, ['low','medium','high'], 'medium'),
      createdAt: cleanIso(l.createdAt) || new Date().toISOString()
    }));

    const sesId = makeIdAllocator();
    out.focusSessions = asArray(raw.focusSessions, 20000).map(f => ({
      id: sesId(f.id, 'focus'),
      date: cleanDate(f.date) || localDate(),
      minutes: cleanNum(f.minutes, 600),
      domainId: cleanId(f.domainId) || null,
      domainName: cleanStr(f.domainName, 200)
    }));

    return out;
  }

  class DataStore {
    constructor() {
      this.data = null;
      this.listeners = [];
      this.loadError = null;   // set when stored data was corrupt (shown once by the app)
      this.touched = false;    // true once the user changed anything (used by cloud sync)
      this.onSaveError = null; // optional hook: (error) => void
      this.init();
    }

    init() {
      let stored = null;
      try {
        this.touched = localStorage.getItem(TOUCHED_KEY) === '1';
        stored = localStorage.getItem(STORAGE_KEY);
      } catch (e) {
        // Storage blocked (private mode, disabled cookies...). App still works in memory.
        this.loadError = 'storage-unavailable';
      }

      if (stored) {
        try {
          this.data = sanitizeData(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to read stored learning data:', e);
          // Keep the unreadable payload so it can be recovered manually, then start fresh.
          try { localStorage.setItem(STORAGE_KEY + '_corrupt', stored); } catch (err) { /* ignore */ }
          this.loadError = 'corrupt-data';
          this.loadInitial();
        }
      } else {
        this.loadInitial();
      }
    }

    loadInitial() {
      this.data = typeof INITIAL_DATA !== 'undefined' ? sanitizeData(INITIAL_DATA) : defaultData();
      this.save({ system: true });
    }

    save(options = {}) {
      this.data.lastUpdated = new Date().toISOString();
      let ok = true;
      if (!options.system && !this.touched) {
        this.touched = true;
        try { localStorage.setItem(TOUCHED_KEY, '1'); } catch (e) { /* ignore */ }
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch (err) {
        ok = false;
        console.error('LocalStorage save error:', err);
        if (typeof this.onSaveError === 'function') this.onSaveError(err);
      }
      this.notify();
      return ok;
    }

    subscribe(callback) {
      if (typeof callback === 'function') {
        this.listeners.push(callback);
      }
      return () => {
        this.listeners = this.listeners.filter(cb => cb !== callback);
      };
    }

    notify() {
      this.listeners.forEach(cb => {
        try {
          cb(this.data);
        } catch (err) {
          console.error('Listener callback error:', err);
        }
      });
    }

    getData() {
      return this.data;
    }

    getSettings() {
      return this.data.settings || defaultData().settings;
    }

    updateSettings(newSettings) {
      this.data.settings = { ...this.data.settings, ...newSettings };
      this.save();
    }

    // Export / Import / Reset
    exportJSON() {
      return JSON.stringify(this.data, null, 2);
    }

    importJSON(jsonString) {
      try {
        if (typeof jsonString !== 'string' || jsonString.length > MAX_IMPORT_BYTES) {
          throw new Error('حجم الملف كبير جداً أو غير صالح');
        }
        let parsed;
        try {
          parsed = JSON.parse(jsonString);
        } catch (e) {
          throw new Error('الملف ليس بصيغة JSON صحيحة');
        }
        // Validate everything first; the current data is replaced only if this succeeds.
        const clean = sanitizeData(parsed);
        this.data = clean;
        this.save();
        return { success: true, domains: clean.domains.length };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    isTouched() { return this.touched; }

    // Used by cloud sync. The previous local copy is kept once in storage so it can be recovered.
    replaceData(clean) {
      try {
        const prev = localStorage.getItem(STORAGE_KEY);
        if (prev) localStorage.setItem(STORAGE_KEY + '_presync', prev);
      } catch (e) { /* ignore */ }
      this.data = clean;
      this.save({ system: true });
    }

    resetData(useSample = true) {
      if (useSample && typeof INITIAL_DATA !== 'undefined') {
        this.data = sanitizeData(INITIAL_DATA);
      } else {
        this.data = defaultData();
      }
      this.save();
    }

    // ---------------- Domain Operations ---------------- //
    getDomains(filter = {}) {
      let list = [...this.data.domains];
      if (filter.status && filter.status !== 'all') {
        list = list.filter(d => d.status === filter.status);
      }
      if (filter.search && filter.search.trim()) {
        const q = normalizeText(filter.search);
        list = list.filter(d =>
          normalizeText(d.name).includes(q) ||
          normalizeText(d.description).includes(q)
        );
      }
      return list;
    }

    getDomainById(id) {
      return this.data.domains.find(d => d.id === id) || null;
    }

    saveDomain(domainData) {
      if (domainData.id) {
        // Edit existing
        const index = this.data.domains.findIndex(d => d.id === domainData.id);
        if (index !== -1) {
          this.data.domains[index] = {
            ...this.data.domains[index],
            ...domainData,
            updatedAt: new Date().toISOString()
          };
        }
      } else {
        // Add new
        const newDomain = {
          id: uid('domain'),
          name: domainData.name || 'مجال تعليمي جديد',
          icon: domainData.icon || 'book',
          color: domainData.color || '#3B82F6',
          description: domainData.description || '',
          targetGoal: domainData.targetGoal || '',
          startDate: domainData.startDate || localDate(),
          targetDate: domainData.targetDate || '',
          currentLevel: domainData.currentLevel || 'مبتدئ',
          targetLevel: domainData.targetLevel || 'متقدم',
          status: domainData.status || 'active',
          stages: [],
          resources: [],
          projects: [],
          notes: [],
          createdAt: new Date().toISOString()
        };
        this.data.domains.push(newDomain);
        this.logActivity('domain_created', newDomain.id, newDomain.name, `تم إنشاء مجال: ${newDomain.name}`);
        this.save();
        return newDomain;
      }
      this.save();
      return this.getDomainById(domainData.id);
    }

    addGeneratedPlan(plan) {
      if (!plan || typeof plan !== 'object' || !Array.isArray(plan.stages)) return null;
      const newDomain = {
        id: uid('domain'),
        name: cleanStr(plan.domainName, 120, 'خطة تعلم جديدة'),
        icon: 'brain',
        color: '#7c3aed',
        description: cleanStr(plan.description, 800),
        targetGoal: cleanStr(plan.targetGoal, 1000),
        startDate: localDate(),
        targetDate: cleanDate(plan.targetDate),
        currentLevel: cleanStr(plan.currentLevel, 80, 'مبتدئ'),
        targetLevel: cleanStr(plan.targetLevel, 80, 'متقدم'),
        status: 'active',
        stages: [],
        resources: [],
        projects: [],
        notes: [],
        createdAt: new Date().toISOString()
      };
      newDomain.stages = plan.stages.slice(0, 10).map((stage) => {
        const newStage = {
          id: uid('stage'),
          title: cleanStr(stage && stage.title, 140, 'مرحلة تعلم'),
          description: cleanStr(stage && stage.description, 800),
          status: 'todo',
          tasks: []
        };
        newStage.tasks = (Array.isArray(stage && stage.tasks) ? stage.tasks : []).slice(0, 10).map((task) => ({
          id: uid('task'),
          title: cleanStr(task && task.title, 160, 'مهمة جديدة'),
          description: cleanStr(task && task.description, 800),
          priority: oneOf(task && task.priority, PRIORITIES, 'medium'),
          status: 'todo',
          dueDate: cleanDate(task && task.dueDate),
          estimatedHours: cleanNum(task && task.estimatedHours, 40),
          notes: '',
          links: [],
          createdAt: new Date().toISOString()
        }));
        return newStage;
      });
      this.data.domains.push(newDomain);
      this.logActivity('domain_created', newDomain.id, newDomain.name, `تم إنشاء خطة تعلم بالذكاء الاصطناعي: ${newDomain.name}`);
      this.save();
      return newDomain;
    }

    deleteDomain(id) {
      const domain = this.getDomainById(id);
      if (!domain) return false;
      
      this.data.domains = this.data.domains.filter(d => d.id !== id);
      // Clean up linked daily tasks
      this.data.dailyTasks = this.data.dailyTasks.filter(t => t.domainId !== id);
      this.logActivity('domain_deleted', id, domain.name, `تم حذف مجال: ${domain.name}`);
      this.save();
      return true;
    }

    updateDomainStatus(id, newStatus) {
      const domain = this.getDomainById(id);
      if (domain) {
        domain.status = newStatus;
        this.save();
        return true;
      }
      return false;
    }

    // ---------------- Stages Operations ---------------- //
    addStage(domainId, stageData) {
      const domain = this.getDomainById(domainId);
      if (!domain) return null;

      const newStage = {
        id: uid('stage'),
        title: stageData.title || `المرحلة ${domain.stages.length + 1}`,
        description: stageData.description || '',
        status: stageData.status || 'todo',
        tasks: []
      };

      domain.stages.push(newStage);
      this.save();
      return newStage;
    }

    updateStage(domainId, stageId, updateData) {
      const domain = this.getDomainById(domainId);
      if (!domain) return false;

      const stage = domain.stages.find(s => s.id === stageId);
      if (!stage) return false;

      Object.assign(stage, updateData);
      this.save();
      return true;
    }

    deleteStage(domainId, stageId) {
      const domain = this.getDomainById(domainId);
      if (!domain) return false;

      domain.stages = domain.stages.filter(s => s.id !== stageId);
      // Clean daily tasks referring to tasks in this stage
      this.data.dailyTasks = this.data.dailyTasks.filter(t => t.stageId !== stageId);
      this.save();
      return true;
    }

    reorderStages(domainId, sourceIndex, targetIndex) {
      const domain = this.getDomainById(domainId);
      if (!domain) return false;
      const [removed] = domain.stages.splice(sourceIndex, 1);
      domain.stages.splice(targetIndex, 0, removed);
      this.save();
      return true;
    }

    // ---------------- Tasks Operations ---------------- //
    addTask(domainId, stageId, taskData) {
      const domain = this.getDomainById(domainId);
      if (!domain) return null;

      const stage = domain.stages.find(s => s.id === stageId);
      if (!stage) return null;

      const newTask = {
        id: uid('task'),
        title: taskData.title || 'مهمة جديدة',
        description: taskData.description || '',
        priority: taskData.priority || 'medium', // 'urgent', 'high', 'medium', 'low'
        status: taskData.status || 'todo', // 'todo', 'in-progress', 'completed'
        dueDate: taskData.dueDate || '',
        estimatedHours: Number(taskData.estimatedHours) || 0,
        notes: taskData.notes || '',
        links: (Array.isArray(taskData.links) ? taskData.links : []).map(safeUrl).filter(Boolean),
        createdAt: new Date().toISOString()
      };

      if (newTask.status === 'completed') {
        newTask.completedAt = new Date().toISOString();
      }

      stage.tasks.push(newTask);
      this.recalculateStageStatus(stage);
      this.save();
      return newTask;
    }

    updateTask(domainId, stageId, taskId, updateData) {
      const domain = this.getDomainById(domainId);
      if (!domain) return false;

      const stage = domain.stages.find(s => s.id === stageId);
      if (!stage) return false;

      const task = stage.tasks.find(t => t.id === taskId);
      if (!task) return false;

      const prevStatus = task.status;
      if (Array.isArray(updateData.links)) {
        updateData = { ...updateData, links: updateData.links.map(safeUrl).filter(Boolean) };
      }
      Object.assign(task, updateData);

      // Status change logic
      if (updateData.status && updateData.status !== prevStatus) {
        if (updateData.status === 'completed') {
          task.completedAt = new Date().toISOString();
          this.logActivity('task_completed', domain.id, domain.name, task.title);
          // If in daily tasks, mark daily task complete too
          this.data.dailyTasks.forEach(dt => {
            if (dt.taskId === taskId) dt.completed = true;
          });
        } else {
          task.completedAt = null;
        }
      }

      this.recalculateStageStatus(stage);
      this.save();
      return true;
    }

    deleteTask(domainId, stageId, taskId) {
      const domain = this.getDomainById(domainId);
      if (!domain) return false;

      const stage = domain.stages.find(s => s.id === stageId);
      if (!stage) return false;

      stage.tasks = stage.tasks.filter(t => t.id !== taskId);
      // Clean daily tasks
      this.data.dailyTasks = this.data.dailyTasks.filter(t => t.taskId !== taskId);
      this.recalculateStageStatus(stage);
      this.save();
      return true;
    }

    toggleTaskStatus(domainId, stageId, taskId) {
      const domain = this.getDomainById(domainId);
      if (!domain) return false;

      const stage = domain.stages.find(s => s.id === stageId);
      if (!stage) return false;

      const task = stage.tasks.find(t => t.id === taskId);
      if (!task) return false;

      const nextStatus = task.status === 'completed' ? 'todo' : 'completed';
      return this.updateTask(domainId, stageId, taskId, { status: nextStatus });
    }

    recalculateStageStatus(stage) {
      if (!stage.tasks || stage.tasks.length === 0) return;
      const total = stage.tasks.length;
      const completed = stage.tasks.filter(t => t.status === 'completed').length;
      const inProgress = stage.tasks.filter(t => t.status === 'in-progress').length;

      const prevStatus = stage.status;
      if (completed === total) {
        stage.status = 'completed';
      } else if (completed > 0 || inProgress > 0) {
        stage.status = 'in-progress';
      } else {
        stage.status = 'todo';
      }

      // Check if newly completed
      if (prevStatus !== 'completed' && stage.status === 'completed') {
        this.logActivity('stage_completed', '', '', `تم إكمال المرحلة: ${stage.title}`);
      }
    }

    // ---------------- Resources Operations ---------------- //
    addResource(domainId, resData) {
      const domain = this.getDomainById(domainId);
      if (!domain) return null;

      const newRes = {
        id: uid('res'),
        title: resData.title || 'مصدر تعليمي',
        url: safeUrl(resData.url),
        type: resData.type || 'website',
        description: resData.description || ''
      };
      domain.resources.push(newRes);
      this.save();
      return newRes;
    }

    deleteResource(domainId, resId) {
      const domain = this.getDomainById(domainId);
      if (!domain) return false;
      domain.resources = domain.resources.filter(r => r.id !== resId);
      this.save();
      return true;
    }

    // ---------------- Projects Operations ---------------- //
    addProject(domainId, projData) {
      const domain = this.getDomainById(domainId);
      if (!domain) return null;

      const newProj = {
        id: uid('proj'),
        title: projData.title || 'مشروع جديد',
        description: projData.description || '',
        skills: projData.skills || '',
        tasksNeeded: projData.tasksNeeded || '',
        status: projData.status || 'planned',
        liveUrl: safeUrl(projData.liveUrl),
        repoUrl: safeUrl(projData.repoUrl)
      };
      domain.projects.push(newProj);
      this.save();
      return newProj;
    }

    updateProject(domainId, projId, updateData) {
      const domain = this.getDomainById(domainId);
      if (!domain) return false;
      const proj = domain.projects.find(p => p.id === projId);
      if (!proj) return false;
      Object.assign(proj, updateData);
      this.save();
      return true;
    }

    deleteProject(domainId, projId) {
      const domain = this.getDomainById(domainId);
      if (!domain) return false;
      domain.projects = domain.projects.filter(p => p.id !== projId);
      this.save();
      return true;
    }

    // ---------------- Notes Operations ---------------- //
    addNote(domainId, noteData) {
      const domain = this.getDomainById(domainId);
      if (!domain) return null;

      const newNote = {
        id: uid('note'),
        title: noteData.title || 'ملاحظة',
        content: noteData.content || '',
        updatedAt: localDate()
      };
      domain.notes.push(newNote);
      this.save();
      return newNote;
    }

    updateNote(domainId, noteId, updateData) {
      const domain = this.getDomainById(domainId);
      if (!domain) return false;
      const note = domain.notes.find(n => n.id === noteId);
      if (!note) return false;
      Object.assign(note, updateData, { updatedAt: localDate() });
      this.save();
      return true;
    }

    deleteNote(domainId, noteId) {
      const domain = this.getDomainById(domainId);
      if (!domain) return false;
      domain.notes = domain.notes.filter(n => n.id !== noteId);
      this.save();
      return true;
    }

    // ---------------- Daily Tasks Operations ---------------- //
    getDailyTasks(dateString) {
      const date = dateString || localDate();
      return this.data.dailyTasks.filter(t => !t.date || t.date === date);
    }

    addDailyTask(taskData) {
      const newTask = {
        id: uid('daily'),
        domainId: taskData.domainId || null,
        stageId: taskData.stageId || null,
        taskId: taskData.taskId || null,
        title: taskData.title || 'مهمة اليوم',
        domainName: taskData.domainName || 'مهمة حرة',
        domainColor: taskData.domainColor || '#3B82F6',
        priority: taskData.priority || 'medium',
        estimatedHours: Number(taskData.estimatedHours) || 1,
        date: taskData.date || localDate(),
        completed: !!taskData.completed,
        notes: taskData.notes || ''
      };
      this.data.dailyTasks.push(newTask);
      this.save();
      return newTask;
    }

    toggleDailyTask(dailyId) {
      const task = this.data.dailyTasks.find(t => t.id === dailyId);
      if (!task) return false;

      task.completed = !task.completed;

      // If tied to an actual domain task, sync status
      if (task.domainId && task.stageId && task.taskId) {
        const domain = this.getDomainById(task.domainId);
        if (domain) {
          const stage = domain.stages.find(s => s.id === task.stageId);
          if (stage) {
            const orgTask = stage.tasks.find(t => t.id === task.taskId);
            if (orgTask) {
              orgTask.status = task.completed ? 'completed' : 'in-progress';
              orgTask.completedAt = task.completed ? new Date().toISOString() : null;
              this.recalculateStageStatus(stage);
            }
          }
        }
      }

      if (task.completed) {
        this.logActivity('daily_task_completed', task.domainId, task.domainName, task.title);
      }

      this.save();
      return true;
    }

    deleteDailyTask(dailyId) {
      // Notice: Deleting from daily plan does NOT delete the parent domain task!
      this.data.dailyTasks = this.data.dailyTasks.filter(t => t.id !== dailyId);
      this.save();
      return true;
    }

    // ---------------- Focus (Pomodoro) Sessions ---------------- //
    addFocusSession({ minutes, domainId }) {
      const domain = domainId ? this.getDomainById(domainId) : null;
      const session = {
        id: uid('focus'),
        date: localDate(),
        minutes: cleanNum(minutes, 600),
        domainId: domain ? domain.id : null,
        domainName: domain ? domain.name : ''
      };
      if (session.minutes <= 0) return null;
      this.data.focusSessions.push(session);
      if (this.data.focusSessions.length > 20000) this.data.focusSessions.shift();
      this.logActivity('focus_session', session.domainId, session.domainName,
        `جلسة تركيز ${Math.round(session.minutes)} دقيقة`);
      this.save();
      return session;
    }

    getFocusSessions(dateString) {
      const list = this.data.focusSessions || [];
      return dateString ? list.filter(f => f.date === dateString) : list;
    }

    // ---------------- Learning journal & weekly review ---------------- //
    addLearningLog(data) {
      const domain = data.domainId ? this.getDomainById(data.domainId) : null;
      const minutes = Math.round(Number(data.minutes));
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) return null;
      const entry = { id: uid('learn'), date: cleanDate(data.date) || localDate(),
        domainId: domain ? domain.id : null, domainName: domain ? domain.name : 'تعلم عام',
        minutes, summary: cleanStr(data.summary, 1200),
        concentration: oneOf(data.concentration, ['low','medium','high'], 'medium'),
        createdAt: new Date().toISOString() };
      this.data.learningLogs = this.data.learningLogs || [];
      this.data.learningLogs.push(entry);
      if (this.data.learningLogs.length > 5000) this.data.learningLogs.shift();
      this.logActivity('learning_log', entry.domainId, entry.domainName, `سجل تعلم: ${entry.minutes} دقيقة`);
      this.save(); return entry;
    }

    getLearningLogs(dateString) {
      const list = this.data.learningLogs || [];
      return (dateString ? list.filter(x => x.date === dateString) : [...list])
        .sort((a,b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
    }

    getWeeklyReview(referenceDate = new Date()) {
      const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
      const day = (end.getDay() + 6) % 7; // Monday start
      const start = new Date(end); start.setDate(end.getDate() - day);
      const prevStart = new Date(start); prevStart.setDate(start.getDate() - 7);
      const fmt = d => localDate(d);
      const logs = this.data.learningLogs || [];
      const sessions = this.data.focusSessions || [];
      const daily = this.data.dailyTasks || [];
      const range = (a,b) => ({ logs: logs.filter(x=>x.date>=fmt(a)&&x.date<=fmt(b)), sessions:sessions.filter(x=>x.date>=fmt(a)&&x.date<=fmt(b)), tasks:daily.filter(x=>x.date>=fmt(a)&&x.date<=fmt(b)) });
      const summarize = r => ({ minutes:r.logs.reduce((n,x)=>n+x.minutes,0)+r.sessions.reduce((n,x)=>n+x.minutes,0),
        entries:r.logs.length, completed:r.tasks.filter(x=>x.completed).length, total:r.tasks.length,
        activeDays:new Set([...r.logs.map(x=>x.date),...r.sessions.map(x=>x.date)]).size });
      const current = summarize(range(start,end)), previous = summarize(range(prevStart,new Date(start.getTime()-86400000)));
      current.hours = Math.round(current.minutes/60*10)/10; previous.hours=Math.round(previous.minutes/60*10)/10;
      current.completion = current.total ? Math.round(current.completed/current.total*100) : 0;
      return { start:fmt(start), end:fmt(end), current, previous, hoursChange:Math.round((current.hours-previous.hours)*10)/10 };
    }

    getLearningStreak() {
      const dates = new Set([...(this.data.learningLogs||[]).map(x=>x.date), ...(this.data.focusSessions||[]).map(x=>x.date),
        ...(this.data.dailyTasks||[]).filter(x=>x.completed).map(x=>x.date)]);
      let cursor = new Date(); cursor.setHours(0,0,0,0);
      if (!dates.has(localDate(cursor))) cursor.setDate(cursor.getDate()-1);
      let streak=0; while (dates.has(localDate(cursor)) && streak<3660) { streak++; cursor.setDate(cursor.getDate()-1); }
      return streak;
    }

    getPomodoroSettings() {
      return { ...DEFAULT_POMODORO, ...(this.data.settings.pomodoro || {}) };
    }

    // ---------------- Global search ---------------- //
    // Returns [{type, domainId, tab, targetId, title, subtitle, domainName, color}]
    searchAll(query, limit = 30) {
      const q = normalizeText(query);
      if (q.length < 2) return [];
      const hit = (...fields) => fields.some(f => normalizeText(f).includes(q));
      const results = [];
      const push = (r) => { if (results.length < limit) results.push(r); };

      for (const d of this.data.domains) {
        const base = { domainId: d.id, domainName: d.name, color: d.color };
        if (hit(d.name, d.description, d.targetGoal)) {
          push({ ...base, type: 'domain', tab: 'plan', targetId: '', title: d.name, subtitle: d.description });
        }
        for (const s of d.stages) {
          if (hit(s.title, s.description)) {
            push({ ...base, type: 'stage', tab: 'plan', targetId: 'stage-card-' + s.id, title: s.title, subtitle: s.description });
          }
          for (const t of s.tasks) {
            if (hit(t.title, t.description, t.notes)) {
              push({ ...base, type: 'task', tab: 'plan', targetId: 'task-' + t.id, title: t.title, subtitle: t.description || t.notes });
            }
          }
        }
        for (const r of d.resources) {
          if (hit(r.title, r.description)) {
            push({ ...base, type: 'resource', tab: 'resources', targetId: 'res-' + r.id, title: r.title, subtitle: r.description });
          }
        }
        for (const p of d.projects) {
          if (hit(p.title, p.description, p.skills)) {
            push({ ...base, type: 'project', tab: 'projects', targetId: 'proj-' + p.id, title: p.title, subtitle: p.description });
          }
        }
        for (const n of d.notes) {
          if (hit(n.title, n.content)) {
            push({ ...base, type: 'note', tab: 'notes', targetId: 'note-' + n.id, title: n.title, subtitle: n.content });
          }
        }
        if (results.length >= limit) break;
      }
      return results;
    }

    // ---------------- Activities & Stats ---------------- //
    logActivity(type, domainId, domainName, title) {
      const act = {
        id: uid('act'),
        type,
        domainId: domainId || null,
        domainName: domainName || 'عام',
        title: title || '',
        timestamp: new Date().toISOString()
      };
      this.data.activityLog.unshift(act);
      // Keep up to 100 entries
      if (this.data.activityLog.length > 100) {
        this.data.activityLog = this.data.activityLog.slice(0, 100);
      }
    }

    // Calculate overall analytics
    getAnalytics() {
      const domains = this.data.domains;
      const totalDomains = domains.length;
      const activeDomains = domains.filter(d => d.status === 'active').length;
      const pausedDomains = domains.filter(d => d.status === 'paused').length;
      const completedDomains = domains.filter(d => d.status === 'completed').length;

      let totalTasks = 0;
      let completedTasks = 0;
      let inProgressTasks = 0;
      let todoTasks = 0;
      let overdueTasks = 0;
      const todayStr = localDate();

      const domainStats = domains.map(d => {
        let dTotal = 0;
        let dCompleted = 0;
        let dStagesTotal = d.stages.length;
        let dStagesCompleted = 0;

        d.stages.forEach(s => {
          if (s.status === 'completed') dStagesCompleted++;
          s.tasks.forEach(t => {
            dTotal++;
            if (t.status === 'completed') dCompleted++;
            else if (t.status === 'in-progress') inProgressTasks++;
            else todoTasks++;

            // Overdue check
            if (t.dueDate && t.dueDate < todayStr && t.status !== 'completed') {
              overdueTasks++;
            }
          });
        });

        totalTasks += dTotal;
        completedTasks += dCompleted;

        const progressPercent = dTotal > 0 ? Math.round((dCompleted / dTotal) * 100) : 0;
        return {
          id: d.id,
          name: d.name,
          color: d.color,
          icon: d.icon,
          status: d.status,
          totalTasks: dTotal,
          completedTasks: dCompleted,
          totalStages: dStagesTotal,
          completedStages: dStagesCompleted,
          progress: progressPercent
        };
      });

      const sessions = this.data.focusSessions || [];
      const focusMinutes = sessions.reduce((sum, f) => sum + (f.minutes || 0), 0);
      const focusToday = sessions.filter(f => f.date === todayStr).reduce((sum, f) => sum + (f.minutes || 0), 0);
      const manualHours = this.data.settings?.studyHoursTracked || 0;
      const journalMinutes = (this.data.learningLogs || []).reduce((sum, item) => sum + (item.minutes || 0), 0);
      const hoursTracked = Math.round((manualHours + (focusMinutes + journalMinutes) / 60) * 10) / 10;

      const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Daily plan stats for today
      const todayTasks = this.getDailyTasks(todayStr);
      const dailyTotal = todayTasks.length;
      const dailyDone = todayTasks.filter(t => t.completed).length;
      const dailyProgress = dailyTotal > 0 ? Math.round((dailyDone / dailyTotal) * 100) : 0;

      return {
        totalDomains,
        activeDomains,
        pausedDomains,
        completedDomains,
        totalTasks,
        completedTasks,
        remainingTasks: totalTasks - completedTasks,
        inProgressTasks,
        todoTasks,
        overdueTasks,
        overallProgress,
        dailyTotal,
        dailyDone,
        dailyProgress,
        domainStats,
        hoursTracked: hoursTracked,
        focusMinutesTotal: focusMinutes,
        focusMinutesToday: focusToday,
        activityLog: this.data.activityLog || []
      };
    }
  }

  // Expose store globally
  window.LearningStore = new DataStore();
  window.LearningUtils = {
    escapeHtml, safeUrl, normalizeText, localDate, uid, sanitizeData, defaultData, hashData, mergeData,
    DEFAULT_POMODORO
  };

})(window);
