// app.js - Main Application Controller & Event Wiring
(function(window) {
  'use strict';

  const { h } = UI;
  const today = () => LearningUtils.localDate();

  const App = {
    currentRoute: 'dashboard',
    currentDomainId: null,
    currentDomainTab: 'plan',
    domainFilter: { status: 'all', search: '' },

    init() {
      // 1. Setup Theme from Store
      const settings = LearningStore.getSettings();
      this.applyTheme(settings.theme || 'light');

      // 2. Surface storage problems instead of failing silently
      LearningStore.onSaveError = () => {
        UI.showToast('تعذّر حفظ البيانات في المتصفح (المساحة ممتلئة أو التخزين معطّل). صدّر نسخة احتياطية الآن.', 'error', 9000);
      };
      if (LearningStore.loadError === 'corrupt-data') {
        UI.showToast('تعذّرت قراءة البيانات المخزّنة فبدأنا ببيانات جديدة. نسخة التالف محفوظة في المتصفح للاسترجاع اليدوي.', 'error', 10000);
      } else if (LearningStore.loadError === 'storage-unavailable') {
        UI.showToast('التخزين المحلي معطّل في هذا المتصفح، لن تُحفظ بياناتك بعد إغلاق الصفحة.', 'error', 10000);
      }

      // 3. Navigation, delegated events, global search
      this.setupNavigation();
      this.setupDelegatedEvents();
      this.setupGlobalSearch();

      // 4. Store reactivity
      LearningStore.subscribe(() => {
        this.renderCurrentView();
      });

      // 5. Focus timer (re-render only the focus page when its state changes)
      Focus.init();
      Focus.subscribe(() => {
        if (this.currentRoute === 'focus') this.renderCurrentView();
      });

      // 6. Initial Render
      this.renderCurrentView();

      // 7. Close dropdowns when clicking outside / Escape
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown')) {
          document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.add('hidden'));
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.add('hidden'));
          this.closeSidebar();
        }
      });

      // 8. Offline support (needs http(s) or localhost, ignored on file://)
      this.registerServiceWorker();
    },

    // Single listener set replaces all inline on* handlers.
    // Markup: data-action="methodName" data-arg0=".." data-arg1=".." [data-event="change|input"]
    // The method receives (...args, element, event).
    setupDelegatedEvents() {
      const dispatch = (el, event) => {
        const name = el.dataset.action;
        if (typeof this[name] !== 'function') return;
        const args = [];
        for (let i = 0; el.dataset['arg' + i] !== undefined; i++) args.push(el.dataset['arg' + i]);
        this[name](...args, el, event);
      };

      document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el || (el.dataset.event && el.dataset.event !== 'click')) return;
        if (el.matches('a')) e.preventDefault();
        dispatch(el, e);
      });

      ['change', 'input'].forEach(type => {
        document.addEventListener(type, (e) => {
          const el = e.target.closest('[data-action]');
          if (!el || el.dataset.event !== type) return;
          dispatch(el, e);
        });
      });

      // Keyboard activation for non-button elements that act as buttons.
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const el = e.target.closest('[role="button"][data-action]');
        if (!el || el !== e.target || el.matches('button, a, input')) return;
        e.preventDefault();
        dispatch(el, e);
      });
    },

    // ---------------- Router & Navigation ---------------- //
    navigate(route, params = {}) {
      if (typeof params !== 'object' || params === null || params instanceof Node || params instanceof Event) params = {};
      this.currentRoute = route;
      if (params.domainId) {
        this.currentDomainId = params.domainId;
      }
      if (params.tab) {
        this.currentDomainTab = params.tab;
      }
      this.pendingScroll = params.scrollTo || null;

      // Update Nav active classes
      document.querySelectorAll('.nav-link').forEach(link => {
        const active = link.dataset.route === route;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });

      this.closeSidebar();
      this.renderCurrentView({ moveFocus: true });
      if (!this.pendingScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    renderCurrentView(options = {}) {
      const container = document.getElementById('main-content');
      if (!container) return;

      // Keep keyboard focus (and caret) across re-renders caused by data changes.
      const focusState = options.moveFocus ? null : this.captureFocus();

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
        case 'focus':
          Views.renderFocus(container);
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

      this.enhanceAccessibility(container);
      Focus.updateDisplay();

      if (options.moveFocus) {
        container.focus({ preventScroll: true });
      } else {
        this.restoreFocus(focusState);
      }
      this.applyPendingScroll();
    },

    // ---------------- Accessibility helpers ---------------- //
    enhanceAccessibility(container) {
      UI.linkLabels(container);
      container.querySelectorAll('button[title]:not([aria-label]), a[title]:not([aria-label])').forEach(el => {
        el.setAttribute('aria-label', el.getAttribute('title'));
      });
    },

    captureFocus() {
      const el = document.activeElement;
      const container = document.getElementById('main-content');
      if (!el || !container || !container.contains(el) || el === container) return null;
      let selector = null;
      if (el.id) {
        selector = '#' + CSS.escape(el.id);
      } else if (el.dataset && el.dataset.action) {
        selector = `[data-action="${CSS.escape(el.dataset.action)}"]`;
        for (let i = 0; el.dataset['arg' + i] !== undefined; i++) {
          selector += `[data-arg${i}="${CSS.escape(el.dataset['arg' + i])}"]`;
        }
      }
      if (!selector) return null;
      const isText = typeof el.selectionStart === 'number' && !['checkbox', 'file'].includes(el.type);
      return { selector, start: isText ? el.selectionStart : null, end: isText ? el.selectionEnd : null };
    },

    restoreFocus(state) {
      if (!state) return;
      const el = document.querySelector(state.selector);
      if (!el) return;
      el.focus({ preventScroll: true });
      if (state.start !== null && typeof el.setSelectionRange === 'function') {
        try { el.setSelectionRange(state.start, state.end); } catch (e) { /* ignore */ }
      }
    },

    applyPendingScroll() {
      if (!this.pendingScroll) return;
      const el = document.getElementById(this.pendingScroll);
      this.pendingScroll = null;
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add('flash-highlight');
      setTimeout(() => el.classList.remove('flash-highlight'), 2200);
    },

    closeSidebar() {
      const sidebar = document.getElementById('sidebar');
      const menuBtn = document.getElementById('mobile-menu-btn');
      if (sidebar) sidebar.classList.remove('sidebar-open');
      if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    },

    setupNavigation() {
      // Sidebar Links
      document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          this.navigate(link.dataset.route);
        });
      });

      // Mobile Menu Toggle
      const menuBtn = document.getElementById('mobile-menu-btn');
      const sidebar = document.getElementById('sidebar');
      if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', () => {
          const open = sidebar.classList.toggle('sidebar-open');
          menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
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

    // ---------------- Global Search ---------------- //
    setupGlobalSearch() {
      const input = document.getElementById('global-search-input');
      const panel = document.getElementById('global-search-results');
      if (!input || !panel) return;

      let timer = null;
      const close = () => {
        panel.classList.add('hidden');
        input.setAttribute('aria-expanded', 'false');
      };
      this.closeGlobalSearch = close;

      input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => this.runGlobalSearch(input.value), 120);
      });
      input.addEventListener('focus', () => {
        if (input.value.trim().length >= 2) this.runGlobalSearch(input.value);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          const first = panel.querySelector('button');
          if (first) { e.preventDefault(); first.focus(); }
        } else if (e.key === 'Escape') {
          close();
          input.blur();
        }
      });
      panel.addEventListener('keydown', (e) => {
        const items = [...panel.querySelectorAll('button')];
        const i = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); (i <= 0 ? input : items[i - 1]).focus(); }
        else if (e.key === 'Escape') { close(); input.focus(); }
      });
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.global-search')) close();
      });

      // "/" or Ctrl/Cmd+K focuses the search box.
      document.addEventListener('keydown', (e) => {
        const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]');
        const modalOpen = document.getElementById('app-modal') && document.getElementById('app-modal').open;
        if (modalOpen) return;
        if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
          e.preventDefault();
          input.focus();
          input.select();
        }
      });
    },

    runGlobalSearch(query) {
      const panel = document.getElementById('global-search-results');
      const input = document.getElementById('global-search-input');
      if (!panel || !input) return;

      if (query.trim().length < 2) {
        panel.classList.add('hidden');
        input.setAttribute('aria-expanded', 'false');
        return;
      }

      this.searchResults = LearningStore.searchAll(query);
      const typeLabels = { domain: 'مجال', stage: 'مرحلة', task: 'مهمة', resource: 'مصدر', project: 'مشروع', note: 'ملاحظة' };

      panel.innerHTML = this.searchResults.length === 0
        ? h`<p class="search-empty">لا توجد نتائج مطابقة.</p>`
        : this.searchResults.map((r, i) => h`
            <button type="button" class="search-result" role="option" data-action="openSearchResult" data-arg0="${i}">
              <span class="search-result-type" style="border-color: ${r.color}">${typeLabels[r.type]}</span>
              <span class="search-result-main">
                <strong>${r.title}</strong>
                <small>${r.type === 'domain' ? (r.subtitle || '') : r.domainName}</small>
              </span>
            </button>`).toString();
      panel.classList.remove('hidden');
      input.setAttribute('aria-expanded', 'true');
    },

    openSearchResult(index) {
      const r = (this.searchResults || [])[Number(index)];
      if (!r) return;
      this.closeGlobalSearch();
      const input = document.getElementById('global-search-input');
      if (input) { input.value = ''; input.blur(); }
      this.navigate('domain-detail', { domainId: r.domainId, tab: r.tab, scrollTo: r.targetId || null });
    },

    // ---------------- Focus timer actions ---------------- //
    setFocusMode(mode) { Focus.setMode(mode); },
    focusStart() { Focus.start(); },
    focusPause() { Focus.pause(); },
    focusReset() { Focus.reset(); },
    focusSkipBreak() { Focus.skipBreak(); },
    focusSetDomain(el) { Focus.setDomain(el.value); },
    savePomodoroSettings() {
      const read = (id) => Math.round(Number(document.getElementById(id).value));
      const vals = { focus: read('pomo-set-focus'), short: read('pomo-set-short'), long: read('pomo-set-long') };
      if (Object.values(vals).some(v => !(v >= 1 && v <= 180))) {
        UI.showToast('أدخل مدداً بين 1 و180 دقيقة', 'error');
        return;
      }
      LearningStore.updateSettings({ pomodoro: vals });
      Focus.reset();
      UI.showToast('تم حفظ مدد المؤقت');
    },

    // ---------------- PWA ---------------- //
    registerServiceWorker() {
      if (!('serviceWorker' in navigator)) return;
      if (!(location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) return;
      navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker registration failed:', err));
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
        themeIconSpan.innerHTML = String(theme === 'dark' ? UI.getIcon('sun') : UI.getIcon('moon'));
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

    onDomainSearch(el) {
      this.domainFilter.search = el.value;
      this.renderCurrentView(); // focus and caret are restored by renderCurrentView
    },

    toggleDropdown(menuId, el, event) {
      event.stopPropagation();
      const menu = document.getElementById(menuId);
      if (!menu) return;
      const isHidden = menu.classList.contains('hidden');
      document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.add('hidden'));
      if (isHidden) {
        menu.classList.remove('hidden');
        const firstItem = menu.querySelector('button');
        if (firstItem) firstItem.focus();
      }
      if (el) el.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    },

    changeDomainStatus(id, newStatus) {
      LearningStore.updateDomainStatus(id, newStatus);
      UI.showToast('تم تحديث حالة المجال التعليمي');
    },

    openNewDomainModal() {
      const html = h`
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
            <input type="date" id="m-domain-start-date" class="form-control" value="${today()}">
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

      const html = h`
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
      const html = h`
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

      const html = h`
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
      const html = h`
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
        const safeLink = linkVal ? UI.safeUrl(linkVal) : '';
        if (linkVal && !safeLink) {
          UI.showToast('الرابط غير صالح (يُسمح بروابط http/https فقط)', 'error');
          return false;
        }
        const links = safeLink ? [safeLink] : [];

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

      const html = h`
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
        const safeLink = linkVal ? UI.safeUrl(linkVal) : '';
        if (linkVal && !safeLink) {
          UI.showToast('الرابط غير صالح (يُسمح بروابط http/https فقط)', 'error');
          return false;
        }
        const links = safeLink ? [safeLink] : [];

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
      const html = h`
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
        const safeResUrl = UI.safeUrl(url);
        if (!safeResUrl) {
          UI.showToast('الرابط غير صالح (يُسمح بروابط http/https فقط)', 'error');
          return false;
        }

        LearningStore.addResource(domainId, {
          title,
          url: safeResUrl,
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
      const html = h`
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

        const liveRaw = document.getElementById('m-proj-live').value.trim();
        const repoRaw = document.getElementById('m-proj-repo').value.trim();
        if ((liveRaw && !UI.safeUrl(liveRaw)) || (repoRaw && !UI.safeUrl(repoRaw))) {
          UI.showToast('أحد الروابط غير صالح (يُسمح بروابط http/https فقط)', 'error');
          return false;
        }

        LearningStore.addProject(domainId, {
          title,
          description: document.getElementById('m-proj-desc').value.trim(),
          skills: document.getElementById('m-proj-skills').value.trim(),
          tasksNeeded: document.getElementById('m-proj-tasks').value.trim(),
          status: document.getElementById('m-proj-status').value,
          liveUrl: UI.safeUrl(liveRaw),
          repoUrl: UI.safeUrl(repoRaw)
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
      const html = h`
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
      const todayStr = today();
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
      const domainTasksOptions = h`
        <option value="">-- مهمة مخصصة حرة (ليست من المسارات) --</option>
        ${domains.map(d => d.stages.map(st => st.tasks
          .filter(t => t.status !== 'completed')
          .map(t => h`<option value="${d.id + ':::' + st.id + ':::' + t.id}">${d.name} &gt; ${t.title}</option>`)))}
      `;

      const html = h`
        <div class="form-group">
          <label class="form-label">اختر من مهام مساراتك التعليمية (اختياري)</label>
          <select id="m-daily-preset" class="form-control" data-action="onDailyPresetSelect" data-event="change">
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

    onDailyPresetSelect(el) {
      const val = el.value;
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
      link.download = `my_learning_journey_backup_${today()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      UI.showToast('تم تنزيل النسخة الاحتياطية بنجاح');
    },

    importBackup(el) {
      const input = el;
      const file = input.files && input.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        UI.showToast('الملف كبير جداً (الحد الأقصى 5 ميجابايت)', 'error');
        input.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => {
        UI.showToast('تعذّرت قراءة الملف', 'error');
        input.value = '';
      };
      reader.onload = (e) => {
        input.value = ''; // allow re-selecting the same file later
        UI.confirmDialog(
          'استيراد نسخة احتياطية',
          `سيتم استبدال جميع بياناتك الحالية ببيانات الملف "${file.name}". هل تريد المتابعة؟ (يُنصح بتصدير نسخة من بياناتك الحالية أولاً)`,
          () => {
            const res = LearningStore.importJSON(String(e.target.result));
            if (res.success) {
              UI.showToast(`تم استيراد البيانات بنجاح (${res.domains} مجال)`);
            } else {
              UI.showToast('فشل في استيراد الملف: ' + res.error, 'error', 6000);
            }
          },
          'استبدال البيانات',
          true
        );
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
