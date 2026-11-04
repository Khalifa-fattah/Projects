// store.js - Data Store & LocalStorage Management for My Learning Journey
(function(window) {
  'use strict';

  const STORAGE_KEY = 'my_learning_journey_data_v1';

  class DataStore {
    constructor() {
      this.data = null;
      this.listeners = [];
      this.init();
    }

    init() {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          this.data = JSON.parse(stored);
          this.ensureSchemaIntegrity();
        } catch (e) {
          console.error('Failed to parse stored learning data, fallback to initial:', e);
          this.loadInitial();
        }
      } else {
        this.loadInitial();
      }
    }

    loadInitial() {
      if (typeof INITIAL_DATA !== 'undefined') {
        this.data = JSON.parse(JSON.stringify(INITIAL_DATA));
      } else {
        this.data = {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
          settings: { theme: "light", userName: "متعلم", studyHoursTracked: 0 },
          domains: [],
          dailyTasks: [],
          activityLog: []
        };
      }
      this.save();
    }

    ensureSchemaIntegrity() {
      if (!this.data.domains) this.data.domains = [];
      if (!this.data.dailyTasks) this.data.dailyTasks = [];
      if (!this.data.activityLog) this.data.activityLog = [];
      if (!this.data.settings) this.data.settings = { theme: "light", userName: "متعلم", studyHoursTracked: 0 };
      
      // Ensure each domain has sub-arrays
      this.data.domains.forEach(d => {
        if (!d.stages) d.stages = [];
        if (!d.resources) d.resources = [];
        if (!d.projects) d.projects = [];
        if (!d.notes) d.notes = [];
        d.stages.forEach(s => {
          if (!s.tasks) s.tasks = [];
        });
      });
    }

    save() {
      this.data.lastUpdated = new Date().toISOString();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        this.notify();
      } catch (err) {
        console.error('LocalStorage save error:', err);
      }
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
      return this.data.settings || { theme: "light", userName: "متعلم", studyHoursTracked: 0 };
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
        const parsed = JSON.parse(jsonString);
        if (!parsed.domains || !Array.isArray(parsed.domains)) {
          throw new Error('ملف البيانات غير صالح: مصفوفة المجالات مفقودة');
        }
        this.data = parsed;
        this.ensureSchemaIntegrity();
        this.save();
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    resetData(useSample = true) {
      if (useSample && typeof INITIAL_DATA !== 'undefined') {
        this.data = JSON.parse(JSON.stringify(INITIAL_DATA));
      } else {
        this.data = {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
          settings: { theme: "light", userName: "متعلم", studyHoursTracked: 0 },
          domains: [],
          dailyTasks: [],
          activityLog: []
        };
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
        const q = filter.search.trim().toLowerCase();
        list = list.filter(d => 
          (d.name && d.name.toLowerCase().includes(q)) || 
          (d.description && d.description.toLowerCase().includes(q))
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
          id: 'domain-' + Date.now(),
          name: domainData.name || 'مجال تعليمي جديد',
          icon: domainData.icon || 'book',
          color: domainData.color || '#3B82F6',
          description: domainData.description || '',
          targetGoal: domainData.targetGoal || '',
          startDate: domainData.startDate || new Date().toISOString().slice(0, 10),
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
        id: 'stage-' + Date.now(),
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
        id: 'task-' + Date.now(),
        title: taskData.title || 'مهمة جديدة',
        description: taskData.description || '',
        priority: taskData.priority || 'medium', // 'urgent', 'high', 'medium', 'low'
        status: taskData.status || 'todo', // 'todo', 'in-progress', 'completed'
        dueDate: taskData.dueDate || '',
        estimatedHours: Number(taskData.estimatedHours) || 0,
        notes: taskData.notes || '',
        links: taskData.links || [],
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
        id: 'res-' + Date.now(),
        title: resData.title || 'مصدر تعليمي',
        url: resData.url || '',
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
        id: 'proj-' + Date.now(),
        title: projData.title || 'مشروع جديد',
        description: projData.description || '',
        skills: projData.skills || '',
        tasksNeeded: projData.tasksNeeded || '',
        status: projData.status || 'planned',
        liveUrl: projData.liveUrl || '',
        repoUrl: projData.repoUrl || ''
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
        id: 'note-' + Date.now(),
        title: noteData.title || 'ملاحظة',
        content: noteData.content || '',
        updatedAt: new Date().toISOString().slice(0, 10)
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
      Object.assign(note, updateData, { updatedAt: new Date().toISOString().slice(0, 10) });
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
      const date = dateString || new Date().toISOString().slice(0, 10);
      return this.data.dailyTasks.filter(t => !t.date || t.date === date);
    }

    addDailyTask(taskData) {
      const newTask = {
        id: 'daily-' + Date.now(),
        domainId: taskData.domainId || null,
        stageId: taskData.stageId || null,
        taskId: taskData.taskId || null,
        title: taskData.title || 'مهمة اليوم',
        domainName: taskData.domainName || 'مهمة حرة',
        domainColor: taskData.domainColor || '#3B82F6',
        priority: taskData.priority || 'medium',
        estimatedHours: Number(taskData.estimatedHours) || 1,
        date: taskData.date || new Date().toISOString().slice(0, 10),
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

    // ---------------- Activities & Stats ---------------- //
    logActivity(type, domainId, domainName, title) {
      const act = {
        id: 'act-' + Date.now(),
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
      const todayStr = new Date().toISOString().slice(0, 10);

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
        hoursTracked: this.data.settings?.studyHoursTracked || 0,
        activityLog: this.data.activityLog || []
      };
    }
  }

  // Expose store globally
  window.LearningStore = new DataStore();

})(window);
