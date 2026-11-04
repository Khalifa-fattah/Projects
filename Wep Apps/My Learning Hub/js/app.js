// app.js - Main Application Controller & Event Wiring
(function(window) {
  'use strict';

  const App = {
    currentRoute: 'dashboard',
    currentDomainId: null,
    currentDomainTab: 'plan',
    domainFilter: { status: 'all', search: '' },

    init() {
      // 1. Setup Theme from Store
      const settings = LearningStore.getSettings();
      this.applyTheme(settings.theme || 'light');

      // 2. Setup Navigation listeners
      this.setupNavigation();

      // 3. Setup Store reactivity
      LearningStore.subscribe(() => {
        this.renderCurrentView();
      });

      // 4. Initial Render
      this.renderCurrentView();

      // 5. Close dropdowns when clicking outside
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown')) {
          document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.add('hidden'));
        }
      });
    },

    // ---------------- Router & Navigation ---------------- //
    navigate(route, params = {}) {
      this.currentRoute = route;
      if (params.domainId) {
        this.currentDomainId = params.domainId;
      }
      if (params.tab) {
        this.currentDomainTab = params.tab;
      }

      // Update Nav active classes
      document.querySelectorAll('.nav-link').forEach(link => {
        if (link.dataset.route === route) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });

      // Close mobile sidebar if open
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.remove('sidebar-open');

      this.renderCurrentView();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    renderCurrentView() {
      const container = document.getElementById('main-content');
      if (!container) return;

      switch (this.currentRoute) {
        case 'dashboard':
          Views.renderDashboard(container);
          break;
        case 'domains':
          Views.renderDomains(container, this.domainFilter);
          break;
        case 'domain-detail':
          Views.renderDomainDetail(container, this.currentDomainId, this.currentDomainTab);
          break;
        case 'daily':
          Views.renderDailyPlan(container);
          break;
        case 'stats':
          Views.renderStats(container);
          break;
        case 'settings':
          Views.renderSettings(container);
          break;
        default:
          Views.renderDashboard(container);
      }
    },

    setupNavigation() {
      // Sidebar Links
      document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const route = link.dataset.route;
          this.navigate(route);
        });
      });

      // Mobile Menu Toggle
      const menuBtn = document.getElementById('mobile-menu-btn');
      const sidebar = document.getElementById('sidebar');
      if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', () => {
          sidebar.classList.toggle('sidebar-open');
        });
      }

      // Theme toggle in header
      const themeBtn = document.getElementById('theme-toggle-btn');
      if (themeBtn) {
        themeBtn.addEventListener('click', () => {
          const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
          const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
          this.setTheme(nextTheme);
        });
      }
    },

    // ---------------- Theme Management ---------------- //
    setTheme(theme) {
      LearningStore.updateSettings({ theme });
      this.applyTheme(theme);
      UI.showToast(`تم التبديل إلى ${theme === 'dark' ? 'الوضع الداكن' : 'الوضع الفاتح'}`);
    },

    applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      const themeIconSpan = document.getElementById('theme-toggle-icon');
      if (themeIconSpan) {
        themeIconSpan.innerHTML = theme === 'dark' ? UI.getIcon('sun') : UI.getIcon('moon');
      }
    },

    // ---------------- Domains Actions ---------------- //
    openDomain(domainId) {
      this.navigate('domain-detail', { domainId, tab: 'plan' });
    },

    switchDomainTab(domainId, tab) {
      this.currentDomainId = domainId;
      this.currentDomainTab = tab;
      this.renderCurrentView();
    },

    filterDomains(status) {
      this.domainFilter.status = status;
      this.renderCurrentView();
    },

    onDomainSearch(query) {
      this.domainFilter.search = query;
      this.renderCurrentView();
      // Keep search input focused and preserve caret
      const input = document.getElementById('domain-search-input');
      if (input) {
        input.focus();
        input.selectionStart = input.selectionEnd = input.value.length;
      }
    },

    toggleDropdown(event, menuId) {
      event.stopPropagation();
      const menu = document.getElementById(menuId);
      const isHidden = menu.classList.contains('hidden');
      document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.add('hidden'));
      if (isHidden) {
        menu.classList.remove('hidden');
      }
    },

    changeDomainStatus(id, newStatus) {
      LearningStore.updateDomainStatus(id, newStatus);
      UI.showToast('تم تحديث حالة المجال التعليمي');
    },

    openNewDomainModal() {
      const html = `
        <div class="form-group">
          <label class="form-label">اسم المجال التعليمي *</label>
          <input type="text" id="m-domain-name" class="form-control" placeholder="مثال: تطوير تطبيقات Flutter، إدارة المنتجات، الذكاء الاصطناعي">
        </div>
        <div class="form-row">
          <div class="form-group flex-1">
            <label class="form-label">الأيقونة</label>
            <select id="m-domain-icon" class="form-control">
              <option value="code">برمجة وأكواد</option>
              <option value="chart">بيانات ورسوم</option>
              <option value="languages">لغات وترجمة</option>
              <option value="book">قراءة وكتب</option>
              <option value="design">تصميم وفنون</option>
              <option value="brain">تطوير ذات وتفكير</option>
            </select>
          </div>
          <div class="form-group flex-1">
            <label class="form-label">اللون المميز</label>
            <select id="m-domain-color" class="form-control">
              <option value="#3B82F6">أزرق سماوي</option>
              <option value="#10B981">أخضر زمردي</option>
              <option value="#8B5CF6">بنفسجي هادئ</option>
              <option value="#F59E0B">كهرماني / برتقالي</option>
              <option value="#EC4899">وردي</option>
              <option value="#6366F1">نيلي</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">وصف المجال</label>
          <textarea id="m-domain-desc" class="form-control" rows="2" placeholder="ما هي المهارات والمعارف المندرجة تحت هذا المجال؟"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">🎯 الهدف النهائي</label>
          <input type="text" id="m-domain-target-goal" class="form-control" placeholder="ما الذي تريد أن تصبح قادراً على فعله بعد إتقان هذا المجال؟">
        </div>
        <div class="form-row">
          <div class="form-group flex-1">
            <label class="form-label">المستوى الحالي</label>
            <input type="text" id="m-domain-current-level" class="form-control" value="مبتدئ">
          </div>
          <div class="form-group flex-1">
            <label class="form-label">المستوى المستهدف</label>
            <input type="text" id="m-domain-target-level" class="form-control" value="متقدم / محترف">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group flex-1">
            <label class="form-label">تاريخ البداية</label>
            <input type="date" id="m-domain-start-date" class="form-control" value="${new Date().toISOString().slice(0, 10)}">
          </div>
          <div class="form-group flex-1">
            <label class="form-label">تاريخ الانتهاء المستهدف (اختياري)</label>
            <input type="date" id="m-domain-target-date" class="form-control">
          </div>
        </div>
      `;

      UI.openModal('إضافة مجال تعليمي جديد', html, () => {
        const name = document.getElementById('m-domain-name').value.trim();
        if (!name) {
          UI.showToast('يرجى كتابة اسم المجال التعليمي', 'error');
          return false;
        }

        LearningStore.saveDomain({
          name,
          icon: document.getElementById('m-domain-icon').value,
          color: document.getElementById('m-domain-color').value,
          description: document.getElementById('m-domain-desc').value.trim(),
          targetGoal: document.getElementById('m-domain-target-goal').value.trim(),
          currentLevel: document.getElementById('m-domain-current-level').value.trim(),
          targetLevel: document.getElementById('m-domain-target-level').value.trim(),
          startDate: document.getElementById('m-domain-start-date').value,
          targetDate: document.getElementById('m-domain-target-date').value,
          status: 'active'
        });

        UI.showToast('تمت إضافة المجال التعليمي بنجاح!');
        return true;
      }, 'حفظ المجال');
    },

    openEditDomainModal(domainId) {
      const domain = LearningStore.getDomainById(domainId);
      if (!domain) return;

      const html = `
        <div class="form-group">
          <label class="form-label">اسم المجال التعليمي *</label>
          <input type="text" id="m-domain-name" class="form-control" value="${domain.name}">
        </div>
        <div class="form-row">
          <div class="form-group flex-1">
            <label class="form-label">الأيقونة</label>
            <select id="m-domain-icon" class="form-control">
              <option value="code" ${domain.icon === 'code' ? 'selected' : ''}>برمجة وأكواد</option>
              <option value="chart" ${domain.icon === 'chart' ? 'selected' : ''}>بيانات ورسوم</option>
              <option value="languages" ${domain.icon === 'languages' ? 'selected' : ''}>لغات وترجمة</option>
              <option value="book" ${domain.icon === 'book' ? 'selected' : ''}>قراءة وكتب</option>
              <option value="design" ${domain.icon === 'design' ? 'selected' : ''}>تصميم وفنون</option>
              <option value="brain" ${domain.icon === 'brain' ? 'selected' : ''}>تطوير ذات وتفكير</option>
            </select>
          </div>
          <div class="form-group flex-1">
            <label class="form-label">اللون المميز</label>
            <select id="m-domain-color" class="form-control">
              <option value="#3B82F6" ${domain.color === '#3B82F6' ? 'selected' : ''}>أزرق سماوي</option>
              <option value="#10B981" ${domain.color === '#10B981' ? 'selected' : ''}>أخضر زمردي</option>
              <option value="#8B5CF6" ${domain.color === '#8B5CF6' ? 'selected' : ''}>بنفسجي هادئ</option>
              <option value="#F59E0B" ${domain.color === '#F59E0B' ? 'selected' : ''}>كهرماني / برتقالي</option>
              <option value="#EC4899" ${domain.color === '#EC4899' ? 'selected' : ''}>وردي</option>
              <option value="#6366F1" ${domain.color === '#6366F1' ? 'selected' : ''}>نيلي</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">الحالة</label>
          <select id="m-domain-status" class="form-control">
            <option value="active" ${domain.status === 'active' ? 'selected' : ''}>نشط</option>
            <option value="paused" ${domain.status === 'paused' ? 'selected' : ''}>متوقف مؤقتاً</option>
            <option value="completed" ${domain.status === 'completed' ? 'selected' : ''}>مكتمل</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">وصف المجال</label>
          <textarea id="m-domain-desc" class="form-control" rows="2">${domain.description || ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">🎯 الهدف النهائي</label>
          <input type="text" id="m-domain-target-goal" class="form-control" value="${domain.targetGoal || ''}">
        </div>
        <div class="form-row">
          <div class="form-group flex-1">
            <label class="form-label">المستوى الحالي</label>
            <input type="text" id="m-domain-current-level" class="form-control" value="${domain.currentLevel || ''}">
          </div>
          <div class="form-group flex-1">
            <label class="form-label">المستوى المستهدف</label>
            <input type="text" id="m-domain-target-level" class="form-control" value="${domain.targetLevel || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group flex-1">
            <label class="form-label">تاريخ البداية</label>
            <input type="date" id="m-domain-start-date" class="form-control" value="${domain.startDate || ''}">
          </div>
          <div class="form-group flex-1">
            <label class="form-label">تاريخ الانتهاء المستهدف</label>
            <input type="date" id="m-domain-target-date" class="form-control" value="${domain.targetDate || ''}">
          </div>
        </div>
      `;

      UI.openModal('تعديل المجال التعليمي', html, () => {
        const name = document.getElementById('m-domain-name').value.trim();
        if (!name) {
          UI.showToast('اسم المجال مطلوب', 'error');
          return false;
        }

        LearningStore.saveDomain({
          id: domain.id,
          name,
          icon: document.getElementById('m-domain-icon').value,
          color: document.getElementById('m-domain-color').value,
          status: document.getElementById('m-domain-status').value,
          description: document.getElementById('m-domain-desc').value.trim(),
          targetGoal: document.getElementById('m-domain-target-goal').value.trim(),
          currentLevel: document.getElementById('m-domain-current-level').value.trim(),
          targetLevel: document.getElementById('m-domain-target-level').value.trim(),
          startDate: document.getElementById('m-domain-start-date').value,
          targetDate: document.getElementById('m-domain-target-date').value
        });

        UI.showToast('تم تحديث بيانات المجال');
        return true;
      }, 'حفظ التغييرات');
    },

    deleteDomain(domainId) {
      const domain = LearningStore.getDomainById(domainId);
      if (!domain) return;

      UI.confirmDialog('تأكيد حذف المجال', `هل أنت متأكد من رغبتك في حذف مجال "${domain.name}"؟ سيتم حذف جميع مراحله ومهامه ومصادره المرتبطة به.`, () => {
        LearningStore.deleteDomain(domainId);
        UI.showToast('تم حذف المجال التعليمي بنجاح');
        if (this.currentRoute === 'domain-detail') {
          this.navigate('domains');
        }
      });
    },

    // ---------------- Stages Actions ---------------- //
    openAddStageModal(domainId) {
      const html = `
        <div class="form-group">
          <label class="form-label">اسم المرحلة *</label>
          <input type="text" id="m-stage-title" class="form-control" placeholder="مثال: 1. أساسيات لغة البرمجة، 2. بناء واجهات المستخدم">
        </div>
        <div class="form-group">
          <label class="form-label">وصف تفصيلي للمرحلة</label>
          <textarea id="m-stage-desc" class="form-control" rows="3" placeholder="ما هي المخرجات المتوقعة من إنجاز هذه المرحلة؟"></textarea>
        </div>
      `;

      UI.openModal('إضافة مرحلة تعليمية', html, () => {
        const title = document.getElementById('m-stage-title').value.trim();
        if (!title) {
          UI.showToast('يرجى كتابة عنوان المرحلة', 'error');
          return false;
        }

        LearningStore.addStage(domainId, {
          title,
          description: document.getElementById('m-stage-desc').value.trim()
        });

        UI.showToast('تمت إضافة المرحلة التعليمية بنجاح!');
        return true;
      }, 'إضافة المرحلة');
    },

    openEditStageModal(domainId, stageId) {
      const domain = LearningStore.getDomainById(domainId);
      const stage = domain ? domain.stages.find(s => s.id === stageId) : null;
      if (!stage) return;

      const html = `
        <div class="form-group">
          <label class="form-label">اسم المرحلة *</label>
          <input type="text" id="m-stage-title" class="form-control" value="${stage.title}">
        </div>
        <div class="form-group">
          <label class="form-label">وصف المرحلة</label>
          <textarea id="m-stage-desc" class="form-control" rows="3">${stage.description || ''}</textarea>
        </div>
      `;

      UI.openModal('تعديل المرحلة', html, () => {
        const title = document.getElementById('m-stage-title').value.trim();
        if (!title) {
          UI.showToast('عنوان المرحلة مطلوب', 'error');
          return false;
        }

        LearningStore.updateStage(domainId, stageId, {
          title,
          description: document.getElementById('m-stage-desc').value.trim()
        });

        UI.showToast('تم تعديل المرحلة');
        return true;
      }, 'حفظ');
    },

    deleteStage(domainId, stageId) {
      UI.confirmDialog('حذف المرحلة التعليمية', 'هل أنت متأكد من حذف هذه المرحلة وجميع مهامها؟', () => {
        LearningStore.deleteStage(domainId, stageId);
        UI.showToast('تم حذف المرحلة');
      });
    },

    // ---------------- Tasks Actions ---------------- //
    openAddTaskModal(domainId, stageId) {
      const html = `
        <div class="form-group">
          <label class="form-label">عنوان المهمة *</label>
          <input type="text" id="m-task-title" class="form-control" placeholder="مثال: تطبيق عملي على Async/Await، حل 5 تمارين">
        </div>
        <div class="form-group">
          <label class="form-label">وصف تفصيلي</label>
          <textarea id="m-task-desc" class="form-control" rows="2" placeholder="تفاصيل الخطوات وملاحظات التنفيذ..."></textarea>
        </div>
        <div class="form-row">
          <div class="form-group flex-1">
            <label class="form-label">الأولوية</label>
            <select id="m-task-priority" class="form-control">
              <option value="urgent">عاجلة جداً</option>
              <option value="high">مرتفعة</option>
              <option value="medium" selected>متوسطة</option>
              <option value="low">منخفضة</option>
            </select>
          </div>
          <div class="form-group flex-1">
            <label class="form-label">الحالة البدائية</label>
            <select id="m-task-status" class="form-control">
              <option value="todo" selected>لم تبدأ</option>
              <option value="in-progress">قيد التنفيذ</option>
              <option value="completed">مكتملة</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group flex-1">
            <label class="form-label">تاريخ الاستحقاق (اختياري)</label>
            <input type="date" id="m-task-duedate" class="form-control">
          </div>
          <div class="form-group flex-1">
            <label class="form-label">المدة التقديرية (ساعات)</label>
            <input type="number" id="m-task-hours" class="form-control" placeholder="مثال: 2" min="0" step="0.5">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">رابط مرجع مرتبط بالمهمة (اختياري)</label>
          <input type="url" id="m-task-link" class="form-control" placeholder="https://...">
        </div>
        <div class="form-group">
          <label class="form-label">ملاحظات إضافية</label>
          <input type="text" id="m-task-notes" class="form-control" placeholder="أي ملاحظة أو تذكير خاص">
        </div>
      `;

      UI.openModal('إضافة مهمة جديدة', html, () => {
        const title = document.getElementById('m-task-title').value.trim();
        if (!title) {
          UI.showToast('يرجى إدخال عنوان المهمة', 'error');
          return false;
        }

        const linkVal = document.getElementById('m-task-link').value.trim();
        const links = linkVal ? [linkVal] : [];

        LearningStore.addTask(domainId, stageId, {
          title,
          description: document.getElementById('m-task-desc').value.trim(),
          priority: document.getElementById('m-task-priority').value,
          status: document.getElementById('m-task-status').value,
          dueDate: document.getElementById('m-task-duedate').value,
          estimatedHours: document.getElementById('m-task-hours').value,
          notes: document.getElementById('m-task-notes').value.trim(),
          links
        });

        UI.showToast('تمت إضافة المهمة بنجاح');
        return true;
      }, 'إضافة المهمة');
    },

    openEditTaskModal(domainId, stageId, taskId) {
      const domain = LearningStore.getDomainById(domainId);
      const stage = domain ? domain.stages.find(s => s.id === stageId) : null;
      const task = stage ? stage.tasks.find(t => t.id === taskId) : null;
      if (!task) return;

      const html = `
        <div class="form-group">
          <label class="form-label">عنوان المهمة *</label>
          <input type="text" id="m-task-title" class="form-control" value="${task.title}">
        </div>
        <div class="form-group">
          <label class="form-label">الوصف</label>
          <textarea id="m-task-desc" class="form-control" rows="2">${task.description || ''}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group flex-1">
            <label class="form-label">الأولوية</label>
            <select id="m-task-priority" class="form-control">
              <option value="urgent" ${task.priority === 'urgent' ? 'selected' : ''}>عاجلة جداً</option>
              <option value="high" ${task.priority === 'high' ? 'selected' : ''}>مرتفعة</option>
              <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>متوسطة</option>
              <option value="low" ${task.priority === 'low' ? 'selected' : ''}>منخفضة</option>
            </select>
          </div>
          <div class="form-group flex-1">
            <label class="form-label">الحالة</label>
            <select id="m-task-status" class="form-control">
              <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>لم تبدأ</option>
              <option value="in-progress" ${task.status === 'in-progress' ? 'selected' : ''}>قيد التنفيذ</option>
              <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>مكتملة</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group flex-1">
            <label class="form-label">تاريخ الاستحقاق</label>
            <input type="date" id="m-task-duedate" class="form-control" value="${task.dueDate || ''}">
          </div>
          <div class="form-group flex-1">
            <label class="form-label">المدة التقديرية (ساعات)</label>
            <input type="number" id="m-task-hours" class="form-control" value="${task.estimatedHours || 0}" min="0" step="0.5">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">رابط مرجع</label>
          <input type="url" id="m-task-link" class="form-control" value="${(task.links && task.links[0]) || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">ملاحظات</label>
          <input type="text" id="m-task-notes" class="form-control" value="${task.notes || ''}">
        </div>
      `;

      UI.openModal('تعديل المهمة', html, () => {
        const title = document.getElementById('m-task-title').value.trim();
        if (!title) {
          UI.showToast('عنوان المهمة مطلوب', 'error');
          return false;
        }

        const linkVal = document.getElementById('m-task-link').value.trim();
        const links = linkVal ? [linkVal] : [];

        LearningStore.updateTask(domainId, stageId, taskId, {
          title,
          description: document.getElementById('m-task-desc').value.trim(),
          priority: document.getElementById('m-task-priority').value,
          status: document.getElementById('m-task-status').value,
          dueDate: document.getElementById('m-task-duedate').value,
          estimatedHours: document.getElementById('m-task-hours').value,
          notes: document.getElementById('m-task-notes').value.trim(),
          links
        });

        UI.showToast('تم تحديث المهمة');
        return true;
      }, 'حفظ');
    },

    toggleTask(domainId, stageId, taskId) {
      const domain = LearningStore.getDomainById(domainId);
      const stage = domain ? domain.stages.find(s => s.id === stageId) : null;
      const task = stage ? stage.tasks.find(t => t.id === taskId) : null;
      
      const willBeCompleted = task && task.status !== 'completed';
      LearningStore.toggleTaskStatus(domainId, stageId, taskId);

      if (willBeCompleted) {
        UI.showToast(`🎯 أحسنت! أنجزت: "${task.title}"`, 'success');
        // Check if stage is now 100% complete
        const updatedStage = domain.stages.find(s => s.id === stageId);
        if (updatedStage && updatedStage.status === 'completed') {
          UI.celebrateStageCompletion(updatedStage.title);
        }
      }
    },

    deleteTask(domainId, stageId, taskId) {
      UI.confirmDialog('حذف المهمة', 'هل أنت متأكد من حذف هذه المهمة؟', () => {
        LearningStore.deleteTask(domainId, stageId, taskId);
        UI.showToast('تم حذف المهمة');
      });
    },

    // ---------------- Resources Actions ---------------- //
    openAddResourceModal(domainId) {
      const html = `
        <div class="form-group">
          <label class="form-label">عنوان المصدر *</label>
          <input type="text" id="m-res-title" class="form-control" placeholder="مثال: دورة JavaScript الكاملة، توثيق React، كتاب Clean Code">
        </div>
        <div class="form-group">
          <label class="form-label">الرابط الإلكتروني (URL) *</label>
          <input type="url" id="m-res-url" class="form-control" placeholder="https://...">
        </div>
        <div class="form-group">
          <label class="form-label">نوع المصدر</label>
          <select id="m-res-type" class="form-control">
            <option value="youtube">فيديو أو قائمة YouTube</option>
            <option value="course">دورة تدريبية (Course)</option>
            <option value="book">كتاب PDF أو ورقي</option>
            <option value="website">موقع أو توثيق رسمي</option>
            <option value="article">مقال برمجي أو مدونة</option>
            <option value="other">مرجع آخر</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">وصف مختصر للمصدر</label>
          <textarea id="m-res-desc" class="form-control" rows="2" placeholder="ما الذي يميز هذا المرجع؟"></textarea>
        </div>
      `;

      UI.openModal('إضافة مصدر تعليمي', html, () => {
        const title = document.getElementById('m-res-title').value.trim();
        const url = document.getElementById('m-res-url').value.trim();
        if (!title || !url) {
          UI.showToast('يرجى إدخال العنوان ورابط المصدر', 'error');
          return false;
        }

        LearningStore.addResource(domainId, {
          title,
          url,
          type: document.getElementById('m-res-type').value,
          description: document.getElementById('m-res-desc').value.trim()
        });

        UI.showToast('تم حفظ المصدر بنجاح');
        return true;
      }, 'إضافة المصدر');
    },

    deleteResource(domainId, resId) {
      UI.confirmDialog('حذف المصدر', 'هل أنت متأكد من حذف هذا المصدر التعليمي؟', () => {
        LearningStore.deleteResource(domainId, resId);
        UI.showToast('تم حذف المصدر');
      });
    },

    // ---------------- Projects Actions ---------------- //
    openAddProjectModal(domainId) {
      const html = `
        <div class="form-group">
          <label class="form-label">اسم المشروع *</label>
          <input type="text" id="m-proj-title" class="form-control" placeholder="مثال: تطبيق لإدارة المصاريف، موقع شخصي">
        </div>
        <div class="form-group">
          <label class="form-label">وصف المشروع وفكرته</label>
          <textarea id="m-proj-desc" class="form-control" rows="2" placeholder="ما المشكلة التي يحلها هذا المشروع؟"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">المهارات والتقنيات المستهدفة</label>
          <input type="text" id="m-proj-skills" class="form-control" placeholder="مثال: React, REST APIs, Tailwind CSS, LocalStorage">
        </div>
        <div class="form-group">
          <label class="form-label">المهام والخطوات لتنفيذه</label>
          <textarea id="m-proj-tasks" class="form-control" rows="2" placeholder="1. تصميم الواجهة، 2. بناء المكونات، 3. النشر"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group flex-1">
            <label class="form-label">حالة المشروع</label>
            <select id="m-proj-status" class="form-control">
              <option value="planned">مخطط له</option>
              <option value="in-progress">قيد التطوير والتنفيذ</option>
              <option value="completed">منجز ومكتمل</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group flex-1">
            <label class="form-label">رابط المعاينة الحية (Live URL)</label>
            <input type="url" id="m-proj-live" class="form-control" placeholder="https://...">
          </div>
          <div class="form-group flex-1">
            <label class="form-label">رابط المستودع (GitHub / GitLab)</label>
            <input type="url" id="m-proj-repo" class="form-control" placeholder="https://github.com/...">
          </div>
        </div>
      `;

      UI.openModal('إضافة مشروع تطبيقي', html, () => {
        const title = document.getElementById('m-proj-title').value.trim();
        if (!title) {
          UI.showToast('يرجى إدخال اسم المشروع', 'error');
          return false;
        }

        LearningStore.addProject(domainId, {
          title,
          description: document.getElementById('m-proj-desc').value.trim(),
          skills: document.getElementById('m-proj-skills').value.trim(),
          tasksNeeded: document.getElementById('m-proj-tasks').value.trim(),
          status: document.getElementById('m-proj-status').value,
          liveUrl: document.getElementById('m-proj-live').value.trim(),
          repoUrl: document.getElementById('m-proj-repo').value.trim()
        });

        UI.showToast('تمت إضافة المشروع بنجاح');
        return true;
      }, 'حفظ المشروع');
    },

    deleteProject(domainId, projId) {
      UI.confirmDialog('حذف المشروع', 'هل أنت متأكد من حذف هذا المشروع التطبيقي؟', () => {
        LearningStore.deleteProject(domainId, projId);
        UI.showToast('تم حذف المشروع');
      });
    },

    // ---------------- Notes Actions ---------------- //
    openAddNoteModal(domainId) {
      const html = `
        <div class="form-group">
          <label class="form-label">عنوان الملاحظة *</label>
          <input type="text" id="m-note-title" class="form-control" placeholder="مثال: أهم المفاهيم في React Hooks، خلاصة المقال">
        </div>
        <div class="form-group">
          <label class="form-label">نص الملاحظة والاستنتاجات *</label>
          <textarea id="m-note-content" class="form-control" rows="5" placeholder="اكتب أفكارك وملاحظاتك بالتفصيل..."></textarea>
        </div>
      `;

      UI.openModal('تدوين ملاحظة جديدة', html, () => {
        const title = document.getElementById('m-note-title').value.trim();
        const content = document.getElementById('m-note-content').value.trim();
        if (!title || !content) {
          UI.showToast('العنوان والمحتوى مطلوبان', 'error');
          return false;
        }

        LearningStore.addNote(domainId, { title, content });
        UI.showToast('تم حفظ الملاحظة');
        return true;
      }, 'حفظ الملاحظة');
    },

    deleteNote(domainId, noteId) {
      UI.confirmDialog('حذف الملاحظة', 'هل أنت متأكد من حذف هذه الملاحظة؟', () => {
        LearningStore.deleteNote(domainId, noteId);
        UI.showToast('تم حذف الملاحظة');
      });
    },

    // ---------------- Daily Plan Actions ---------------- //
    addDomainTaskToDaily(domainId, stageId, taskId) {
      const domain = LearningStore.getDomainById(domainId);
      const stage = domain ? domain.stages.find(s => s.id === stageId) : null;
      const task = stage ? stage.tasks.find(t => t.id === taskId) : null;
      if (!task) return;

      // Check if already in today's list
      const todayStr = new Date().toISOString().slice(0, 10);
      const existing = LearningStore.getDailyTasks(todayStr).find(dt => dt.taskId === taskId);
      if (existing) {
        UI.showToast('هذه المهمة موجودة بالفعل في خطة اليوم', 'info');
        return;
      }

      LearningStore.addDailyTask({
        domainId: domain.id,
        stageId: stage.id,
        taskId: task.id,
        title: task.title,
        domainName: domain.name,
        domainColor: domain.color,
        priority: task.priority,
        estimatedHours: task.estimatedHours || 1,
        date: todayStr,
        completed: task.status === 'completed',
        notes: task.notes || ''
      });

      UI.showToast('✅ تمت إضافة المهمة إلى خطة اليوم بنجاح!');
    },

    openAddDailyTaskModal() {
      // Gather incomplete domain tasks as quick-select options
      const domains = LearningStore.getDomains();
      let domainTasksOptions = `<option value="">-- مهمة مخصصة حرة (ليست من المسارات) --</option>`;

      domains.forEach(d => {
        d.stages.forEach(s => {
          s.tasks.forEach(t => {
            if (t.status !== 'completed') {
              domainTasksOptions += `<option value="${d.id}:::${s.id}:::${t.id}">${d.name} &gt; ${t.title}</option>`;
            }
          });
        });
      });

      const html = `
        <div class="form-group">
          <label class="form-label">اختر من مهام مساراتك التعليمية (اختياري)</label>
          <select id="m-daily-preset" class="form-control" onchange="App.onDailyPresetSelect(this.value)">
            ${domainTasksOptions}
          </select>
        </div>
        <hr class="divider">
        <div class="form-group">
          <label class="form-label">عنوان مهمة اليوم *</label>
          <input type="text" id="m-daily-title" class="form-control" placeholder="اكتب ما تنوي إنجازه اليوم...">
        </div>
        <div class="form-row">
          <div class="form-group flex-1">
            <label class="form-label">الأولوية</label>
            <select id="m-daily-priority" class="form-control">
              <option value="urgent">عاجلة</option>
              <option value="high">مرتفعة</option>
              <option value="medium" selected>متوسطة</option>
              <option value="low">منخفضة</option>
            </select>
          </div>
          <div class="form-group flex-1">
            <label class="form-label">الوقت التقديري (ساعات)</label>
            <input type="number" id="m-daily-hours" class="form-control" value="1" min="0.5" step="0.5">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">ملاحظات لليوم</label>
          <input type="text" id="m-daily-notes" class="form-control" placeholder="مثال: التركيز على حل التمارين وتدوين الأسئلة">
        </div>
      `;

      UI.openModal('جدولة مهمة جديدة لليوم', html, () => {
        const title = document.getElementById('m-daily-title').value.trim();
        if (!title) {
          UI.showToast('عنوان المهمة مطلوب', 'error');
          return false;
        }

        const presetVal = document.getElementById('m-daily-preset').value;
        let domainId = null, stageId = null, taskId = null, domainName = 'مهمة حرة', domainColor = '#3B82F6';

        if (presetVal) {
          const parts = presetVal.split(':::');
          domainId = parts[0];
          stageId = parts[1];
          taskId = parts[2];
          const d = LearningStore.getDomainById(domainId);
          if (d) {
            domainName = d.name;
            domainColor = d.color;
          }
        }

        LearningStore.addDailyTask({
          domainId,
          stageId,
          taskId,
          title,
          domainName,
          domainColor,
          priority: document.getElementById('m-daily-priority').value,
          estimatedHours: document.getElementById('m-daily-hours').value,
          notes: document.getElementById('m-daily-notes').value.trim()
        });

        UI.showToast('تمت جدولة المهمة لليوم بنجاح');
        return true;
      }, 'إضافة للخطة');
    },

    onDailyPresetSelect(val) {
      if (!val) return;
      const [domainId, stageId, taskId] = val.split(':::');
      const domain = LearningStore.getDomainById(domainId);
      const stage = domain ? domain.stages.find(s => s.id === stageId) : null;
      const task = stage ? stage.tasks.find(t => t.id === taskId) : null;

      if (task) {
        document.getElementById('m-daily-title').value = task.title;
        document.getElementById('m-daily-priority').value = task.priority || 'medium';
        document.getElementById('m-daily-hours').value = task.estimatedHours || 1;
        document.getElementById('m-daily-notes').value = task.notes || '';
      }
    },

    toggleDailyTask(dailyId) {
      LearningStore.toggleDailyTask(dailyId);
      const todayTasks = LearningStore.getDailyTasks();
      const item = todayTasks.find(t => t.id === dailyId);
      if (item && item.completed) {
        UI.showToast('🎉 أحسنت! اكتملت مهمة اليوم.');
      }
    },

    deleteDailyTask(dailyId) {
      UI.confirmDialog('إزالة من خطة اليوم', 'هل تريد إزالة هذه المهمة من خطة اليوم؟ (لن يتم حذفها من مسار التعلم الأصلي)', () => {
        LearningStore.deleteDailyTask(dailyId);
        UI.showToast('تمت إزالة المهمة من خطة اليوم');
      }, 'إزالة', false);
    },

    // ---------------- Settings & Backup ---------------- //
    saveGeneralSettings() {
      const userName = document.getElementById('setting-user-name').value.trim();
      const studyHoursTracked = Number(document.getElementById('setting-hours').value) || 0;

      LearningStore.updateSettings({ userName, studyHoursTracked });
      UI.showToast('تم حفظ الإعدادات بنجاح');
    },

    exportBackup() {
      const dataStr = LearningStore.exportJSON();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `my_learning_journey_backup_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      UI.showToast('تم تنزيل النسخة الاحتياطية بنجاح');
    },

    importBackup(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        const res = LearningStore.importJSON(content);
        if (res.success) {
          UI.showToast('تم استيراد البيانات بنجاح واستعادتها!');
        } else {
          UI.showToast('فشل في استيراد الملف: ' + res.error, 'error');
        }
      };
      reader.readAsText(file);
    },

    resetWithSampleData() {
      UI.confirmDialog('استعادة البيانات التجريبية', 'هل أنت متأكد من استبدال البيانات الحالية بالبيانات الاسترشادية النموذجية؟', () => {
        LearningStore.resetData(true);
        UI.showToast('تمت استعادة البيانات التجريبية');
      });
    },

    clearAllData() {
      UI.confirmDialog('مسح كافة البيانات', 'تحذير: سيتم مسح كافة المجالات والمهام والخطط نهائياً. هل ترغب في الاستمرار؟', () => {
        LearningStore.resetData(false);
        UI.showToast('تم تفريغ كافة البيانات');
      });
    },

    // ---------------- Helper Labels ---------------- //
    getStatusLabel(status) {
      switch (status) {
        case 'active': return 'نشط';
        case 'paused': return 'متوقف مؤقتاً';
        case 'completed': return 'مكتمل';
        default: return 'نشط';
      }
    },

    getTaskStatusLabel(status) {
      switch (status) {
        case 'todo': return 'لم تبدأ';
        case 'in-progress': return 'قيد التنفيذ';
        case 'completed': return 'مكتملة';
        default: return status;
      }
    },

    getPriorityLabel(priority) {
      switch (priority) {
        case 'urgent': return 'عاجل جداً';
        case 'high': return 'مرتفع';
        case 'medium': return 'متوسط';
        case 'low': return 'منخفض';
        default: return 'عادي';
      }
    },

    getResourceTypeLabel(type) {
      switch (type) {
        case 'youtube': return '📺 يوتيوب';
        case 'course': return '🎓 دورة تدريبية';
        case 'book': return '📚 كتاب';
        case 'website': return '🌐 موقع إلكتروني';
        case 'article': return '📝 مقال';
        default: return '📌 مرجع';
      }
    },

    getProjectStatusLabel(status) {
      switch (status) {
        case 'planned': return 'مخطط له';
        case 'in-progress': return 'قيد التنفيذ';
        case 'completed': return 'مكتمل';
        default: return status;
      }
    }
  };

  // Run on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    App.init();
  });

  window.App = App;

})(window);
