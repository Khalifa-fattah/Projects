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
    aiPlanDraft: null,
    aiRequesting: false,
    freeChatMessages: [],
    freeChatBusy: false,
    aiForm: { goal: '', currentLevel: 'مبتدئ', targetLevel: '', daysPerWeek: 5, targetDate: '', purpose: '', learningStyle: 'متوازن (شرح وتطبيق)', context: '' },

    init() {
      this.restoreAiState();
      this.restoreFreeChat();

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

      // 4b. Cloud sync (Google Drive). Inactive until a Client ID is saved in Settings.
      CloudSync.subscribe((st) => this.onSyncState(st));
      CloudSync.attach(LearningStore);
      this.onSyncState(CloudSync.getState());

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

      ['change', 'input', 'submit'].forEach(type => {
        document.addEventListener(type, (e) => {
          const el = e.target.closest('[data-action]');
          if (!el || el.dataset.event !== type) return;
          if (type === 'submit') e.preventDefault();
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
        case 'ai-assistant':
          this.persistAiState();
          Views.renderAiAssistant(container, this.aiPlanDraft, this.aiRequesting, this.aiForm);
          break;
        case 'ai-chat':
          Views.renderFreeChat(container, this.freeChatMessages, this.freeChatBusy);
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

    // ---------------- Cloud sync (Google Drive) ---------------- //
    onSyncState(st) {
      const config = CloudSync.getConfig();
      const chip = document.getElementById('sync-chip');
      if (chip) {
        const labels = {
          syncing: ['⟳', 'جارٍ المزامنة'],
          idle: ['☁', 'تمت المزامنة'],
          'needs-auth': ['☁', 'اتصال'],
          conflict: ['⚠', 'تعارض'],
          error: ['⚠', 'خطأ في المزامنة']
        };
        const label = labels[st.status];
        chip.classList.toggle('hidden', !config.configured || !label);
        if (label) {
          document.getElementById('sync-chip-icon').textContent = label[0];
          document.getElementById('sync-chip-text').textContent = label[1];
          chip.dataset.state = st.status;
          chip.title = st.error || `المزامنة السحابية: ${label[1]}`;
        }
      }
      const statusEl = document.getElementById('sync-status-text');
      if (statusEl) statusEl.textContent = Views.syncStatusText(st, config);
      if (st.status === 'conflict' && st.conflict) this.showSyncConflict();
      // Refresh the buttons (connect vs. sync-now) without touching the typed Client ID.
      if (this.currentRoute === 'settings' && this._lastSyncStatus !== st.status &&
          !(document.activeElement && document.activeElement.id === 'sync-client-id')) {
        this.renderCurrentView();
      }
      this._lastSyncStatus = st.status;
    },

    showSyncConflict() {
      const st = CloudSync.getState();
      if (!st.conflict) return;
      const dialog = document.getElementById('app-modal');
      if (dialog && dialog.open) {
        // Never overwrite a form the user is working in; show this when it closes.
        if (!this._conflictWaiting) {
          this._conflictWaiting = true;
          dialog.addEventListener('close', () => { this._conflictWaiting = false; this.showSyncConflict(); }, { once: true });
        }
        return;
      }
      const fmt = (iso) => (iso ? new Date(iso).toLocaleString('ar-EG') : 'غير معروف');
      const { local, remote } = st.conflict;
      const body = h`
        <p>تغيّرت البيانات على هذا الجهاز وعلى السحابة. اختر ما تريد فعله:</p>
        <div class="sync-compare">
          <div><strong>هذا الجهاز</strong><br>${local.domains} مجالات • ${local.tasks} مهمة<br><small>آخر تعديل: ${fmt(local.updated)}</small></div>
          <div><strong>السحابة</strong><br>${remote.domains} مجالات • ${remote.tasks} مهمة<br><small>آخر تعديل: ${fmt(remote.updated)}</small></div>
        </div>
        <fieldset class="sync-choices">
          <legend class="sr-only">طريقة الحل</legend>
          <label class="sync-choice"><input type="radio" name="sync-choice" value="merge" checked> <span><strong>دمج الاثنين (الأكثر أمانًا)</strong><br><small>يحتفظ بكل ما في الجهتين. قد يعود عنصر حذفته على جهاز إذا كان لا يزال موجودًا على الآخر.</small></span></label>
          <label class="sync-choice"><input type="radio" name="sync-choice" value="cloud"> <span><strong>استخدام بيانات السحابة</strong><br><small>تُستبدل بيانات هذا الجهاز (تبقى نسخة منها محفوظة في المتصفح للاسترجاع).</small></span></label>
          <label class="sync-choice"><input type="radio" name="sync-choice" value="local"> <span><strong>استخدام بيانات هذا الجهاز</strong><br><small>تُستبدل نسخة السحابة ببيانات هذا الجهاز.</small></span></label>
        </fieldset>`;
      UI.openModal('تعارض في المزامنة', body, () => {
        const picked = document.querySelector('input[name="sync-choice"]:checked');
        CloudSync.resolveConflict(picked ? picked.value : 'merge');
      }, 'تنفيذ', 'btn-primary');
    },

    syncChipClick() {
      const st = CloudSync.getState();
      if (st.status === 'conflict') this.showSyncConflict();
      else this.syncNowCloud();
    },

    saveSyncClientId() {
      const input = document.getElementById('sync-client-id');
      if (!input) return;
      try {
        CloudSync.setClientId(input.value);
        UI.showToast('تم حفظ معرّف العميل. اضغط «اتصال ومزامنة».');
        this.renderCurrentView();
        this.onSyncState(CloudSync.getState());
      } catch (error) {
        UI.showToast(error.message || 'تعذّر حفظ المعرّف.', 'error');
      }
    },

    async syncNowCloud(el) {
      if (el) el.disabled = true;
      try {
        const result = await CloudSync.syncNow();
        if (result === 'uploaded') UI.showToast('تم رفع بياناتك إلى Google Drive.');
        else if (result === 'downloaded') UI.showToast('تم تحديث بياناتك من السحابة.');
        else if (result === 'unchanged') UI.showToast('كل شيء محدّث.');
      } catch (error) {
        UI.showToast(error && error.message ? error.message : 'تعذّرت المزامنة.', 'error', 8000);
      } finally {
        if (el) el.disabled = false;
      }
    },

    disconnectCloudSync() {
      UI.confirmDialog('إيقاف المزامنة', 'ستتوقف المزامنة على هذا الجهاز. تبقى بياناتك المحلية ونسخة السحابة كما هي. هل تريد المتابعة؟', () => {
        CloudSync.disconnect();
        this.renderCurrentView();
        UI.showToast('تم إيقاف المزامنة على هذا الجهاز.');
      }, 'إيقاف المزامنة', true);
    },

    // ---------------- Gemini Coach & adaptive replanning ---------------- //
    buildDomainLearningSnapshot(domain) {
      const review = LearningStore.getWeeklyReview();
      const stages = (domain.stages || []).map(stage => ({
        id: stage.id, title: stage.title, status: stage.status,
        tasks: (stage.tasks || []).map(task => ({ id: task.id, title: task.title, status: task.status,
          priority: task.priority, dueDate: task.dueDate || '', estimatedHours: task.estimatedHours || 0 }))
      }));
      const allTasks = stages.flatMap(stage => stage.tasks);
      const logs = (LearningStore.getLearningLogs() || []).filter(x => x.domainId === domain.id).slice(0,40)
        .map(x => ({ date:x.date, minutes:x.minutes, concentration:x.concentration, summary:x.summary }));
      return { domain:{ name:domain.name, goal:domain.targetGoal, currentLevel:domain.currentLevel, targetLevel:domain.targetLevel, targetDate:domain.targetDate },
        stages, stats:{ total:allTasks.length, completed:allTasks.filter(t=>t.status==='completed').length,
          overdue:allTasks.filter(t=>t.status!=='completed' && t.dueDate && t.dueDate < today()).length },
        weeklyReview:review.current, weeklyHoursAvailable:5, learningLogs:logs };
    },

    async runGeminiCoach(domainId, el) {
      const domain = LearningStore.getDomainById(domainId); if (!domain) return;
      if (!GeminiAssistant.hasKey()) { UI.showToast('أضف مفتاح Gemini API من الإعدادات أولًا.', 'error'); return; }
      if (el) el.disabled = true;
      UI.showToast('يجري Gemini تحليل تقدمك…');
      try {
        const report = await GeminiAssistant.coachProgress(this.buildDomainLearningSnapshot(domain));
        const safe = String(report).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])).replace(/\n/g,'<br>');
        UI.openModal('تقرير مدرب Gemini', `<div class="gemini-coach-report">${safe}</div>`, null);
      } catch (error) { UI.showToast(error.message || 'تعذر تحليل التقدم.', 'error', 7000); }
      finally { if (el) el.disabled = false; }
    },

    async replanDomain(domainId, el) {
      const domain = LearningStore.getDomainById(domainId); if (!domain) return;
      if (!GeminiAssistant.hasKey()) { UI.showToast('أضف مفتاح Gemini API من الإعدادات أولًا.', 'error'); return; }
      const tasks = (domain.stages || []).flatMap(stage => (stage.tasks || []).filter(t=>t.status!=='completed').map(t=>({ id:t.id, title:t.title, status:t.status, priority:t.priority, dueDate:t.dueDate||'', estimatedHours:t.estimatedHours||0 })));
      if (!tasks.length) { UI.showToast('لا توجد مهام غير مكتملة لإعادة جدولتها.'); return; }
      if (el) el.disabled = true;
      UI.showToast('يجري Gemini إعادة توزيع المهام…');
      try {
        const result = await GeminiAssistant.replanTasks({ domainName:domain.name, goal:domain.targetGoal, tasks,
          hoursPerWeek:5, daysPerWeek:5, today:today() });
        const taskMap = new Map(tasks.map(t=>[t.id,t]));
        const valid = result.schedule.filter(item=>taskMap.has(item.taskId));
        if (!valid.length) throw new Error('لم ينتج Gemini تواريخ صالحة للمهام.');
        const rows = valid.map(item=>`<li>${taskMap.get(item.taskId).title}: <strong>${UI.formatDate(item.dueDate)}</strong></li>`).join('');
        const note = String(result.note||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        UI.openModal('مراجعة إعادة التخطيط', `<p>سيتم تحديث مواعيد ${valid.length} من ${tasks.length} مهمة غير مكتملة. لن تتغير عناوين المهام أو حالات إنجازها.</p><ul class="replan-preview-list">${rows}</ul><p class="text-muted">${note}</p>`, () => {
          let updated=0;
          for (const item of valid) {
            for (const stage of domain.stages) {
              if ((stage.tasks||[]).some(t=>t.id===item.taskId)) {
                if (LearningStore.updateTask(domain.id, stage.id, item.taskId, { dueDate:item.dueDate })) updated++;
                break;
              }
            }
          }
          this.renderCurrentView(); UI.showToast(`تم تحديث مواعيد ${updated} مهمة.`);
        }, 'اعتماد الجدول');
      } catch (error) { UI.showToast(error.message || 'تعذرت إعادة التخطيط.', 'error', 7000); }
      finally { if (el) el.disabled = false; }
    },

    // ---------------- Free Gemini conversation ---------------- //
    persistFreeChat() {
      try { sessionStorage.setItem('my_learning_hub_free_chat_v1', JSON.stringify(this.freeChatMessages.slice(-40))); } catch (_) {}
    },
    restoreFreeChat() {
      try {
        const saved = JSON.parse(sessionStorage.getItem('my_learning_hub_free_chat_v1') || '[]');
        if (Array.isArray(saved)) this.freeChatMessages = saved.filter(m => m && ['user','model'].includes(m.role) && typeof m.text === 'string').slice(-40).map(m => ({ role:m.role, text:m.text.slice(0,5000) }));
      } catch (_) { this.freeChatMessages = []; }
    },
    openChatFromDashboard(form) {
      const field = form?.querySelector('[name="dashboard-chat-prompt"]');
      const prompt = String(field?.value || '').trim();
      if (!prompt) return;
      if (!GeminiAssistant.hasKey()) {
        UI.showToast('أضف مفتاح Gemini API من الإعدادات أولًا.', 'error');
        this.navigate('settings');
        return;
      }
      this.navigate('ai-chat');
      const chatInput = document.getElementById('free-chat-input');
      if (chatInput) { chatInput.value = prompt; this.sendFreeChat(); }
    },

    async sendFreeChat(form) {
      if (this.freeChatBusy) return;
      const input = document.getElementById('free-chat-input');
      const text = String(input?.value || '').trim();
      if (!text) return;
      if (!GeminiAssistant.hasKey()) { UI.showToast('أضف مفتاح Gemini API من الإعدادات أولًا.', 'error'); return; }
      this.freeChatMessages.push({ role:'user', text:text.slice(0,4000) });
      this.freeChatMessages = this.freeChatMessages.slice(-40);
      this.freeChatBusy = true;
      this.persistFreeChat();
      this.renderCurrentView();
      try {
        const answer = await GeminiAssistant.chat(this.freeChatMessages);
        this.freeChatMessages.push({ role:'model', text:answer });
        this.persistFreeChat();
      } catch (error) {
        // Keep the user's message so it can be retried, but show the API error clearly.
        UI.showToast(error?.message || 'تعذر إرسال الرسالة إلى Gemini.', 'error', 9000);
      } finally {
        this.freeChatBusy = false;
        if (this.currentRoute === 'ai-chat') this.renderCurrentView();
      }
    },
    clearFreeChat() {
      if (!this.freeChatMessages.length) return;
      UI.confirmDialog('بدء محادثة جديدة', 'سيتم مسح سجل المحادثة الحالية من جلسة هذا المتصفح. هل تريد المتابعة؟', () => {
        this.freeChatMessages = [];
        this.persistFreeChat();
        this.renderCurrentView();
      }, 'محادثة جديدة');
    },

    // ---------------- Gemini plan assistant ---------------- //
    // The form and draft survive re-renders and page navigation (sessionStorage, this tab only).
    persistAiState() {
      try {
        sessionStorage.setItem('my_learning_hub_ai_state_v1', JSON.stringify({ form: this.aiForm, draft: this.aiPlanDraft }));
      } catch (e) { /* best effort */ }
    },

    restoreAiState() {
      try {
        const saved = JSON.parse(sessionStorage.getItem('my_learning_hub_ai_state_v1') || 'null');
        if (!saved) return;
        if (saved.form && typeof saved.form === 'object') {
          const f = saved.form;
          this.aiForm = {
            goal: String(f.goal || '').slice(0, 240),
            currentLevel: String(f.currentLevel ?? 'مبتدئ').slice(0, 80),
            targetLevel: String(f.targetLevel || '').slice(0, 80),
            purpose: String(f.purpose || '').slice(0, 240),
            learningStyle: String(f.learningStyle || 'متوازن (شرح وتطبيق)').slice(0, 80),
            daysPerWeek: Number(f.daysPerWeek) || 5,
            targetDate: /^\d{4}-\d{2}-\d{2}$/.test(f.targetDate || '') ? f.targetDate : '',
            context: String(f.context || '').slice(0, 700)
          };
        }
        if (saved.draft && Array.isArray(saved.draft.stages)) {
          // Re-validate: sessionStorage is still untrusted input.
          this.aiPlanDraft = GeminiAssistant.validatePlan(saved.draft, { goal: this.aiForm.goal || 'خطة تعلم', currentLevel: this.aiForm.currentLevel, targetLevel: this.aiForm.targetLevel, targetDate: saved.draft.targetDate });
        }
      } catch (e) { /* ignore unusable saved state */ }
    },

    aiFormInput(field, el) {
      if (!el || !(field in this.aiForm)) return;
      this.aiForm[field] = el.value;
      this.persistAiState();
    },

    saveGeminiKey() {
      const input = document.getElementById('setting-gemini-api-key');
      const modelInput = document.getElementById('setting-gemini-model');
      if (!input) return;
      try {
        const typed = input.value.trim();
        if (typed) GeminiAssistant.saveKey(typed);
        else if (!GeminiAssistant.hasKey()) throw new Error('أدخل مفتاح Gemini API صحيحًا.');
        if (modelInput) GeminiAssistant.saveModel(modelInput.value);
        input.value = '';
        UI.showToast('تم حفظ الإعدادات في هذا المتصفح فقط.');
        this.renderCurrentView();
      } catch (error) {
        UI.showToast(error.message || 'تعذّر حفظ الإعدادات.', 'error');
      }
    },

    async testGeminiConnection(el) {
      if (el) el.disabled = true;
      try {
        const res = await GeminiAssistant.testConnection();
        UI.showToast(`الاتصال بـ Gemini ناجح (${res.model}).`);
      } catch (error) {
        UI.showToast(error.message || 'فشل اختبار الاتصال.', 'error', 9000);
      } finally {
        if (el) el.disabled = false;
      }
    },

    removeGeminiKey() {
      UI.confirmDialog('حذف مفتاح Gemini', 'سيُحذف المفتاح من هذا المتصفح. يمكنك إضافته مجددًا لاحقًا من Google AI Studio. هل تريد المتابعة؟', () => {
        GeminiAssistant.removeKey();
        this.renderCurrentView();
        UI.showToast('تم حذف مفتاح Gemini من هذا المتصفح.');
      }, 'حذف المفتاح', true);
    },

    async generateAiPlan() {
      if (this.aiRequesting) return;
      const f = this.aiForm;
      const goal = String(f.goal || '').trim();
      if (!goal) {
        UI.showToast('اكتب هدف التعلّم أولًا.', 'error');
        document.getElementById('ai-goal')?.focus();
        return;
      }
      const inputs = {
        goal: goal.slice(0, 240),
        currentLevel: String(f.currentLevel || '').trim().slice(0, 80) || 'مبتدئ',
        targetLevel: String(f.targetLevel || '').trim().slice(0, 80),
        purpose: String(f.purpose || '').trim().slice(0, 240),
        learningStyle: String(f.learningStyle || 'متوازن (شرح وتطبيق)').slice(0, 80),
        daysPerWeek: Math.min(7, Math.max(1, Number(f.daysPerWeek) || 5)),
        targetDate: f.targetDate || '',
        context: String(f.context || '').trim().slice(0, 700)
      };
      this.aiRequesting = true;
      this.renderCurrentView();
      try {
        this.aiPlanDraft = await GeminiAssistant.generatePlan(inputs);
        UI.showToast('اكتملت الخطة المقترحة. راجعها وعدّلها قبل الحفظ.');
      } catch (error) {
        UI.showToast(error && error.message ? error.message : 'تعذّر إنشاء الخطة.', 'error', 9000);
      } finally {
        this.aiRequesting = false;
        if (this.currentRoute === 'ai-assistant') this.renderCurrentView();
        else this.persistAiState();
      }
    },

    editAiPlanField(field, el) {
      if (!this.aiPlanDraft || !el) return;
      if (field === 'domainName' || field === 'targetGoal') { this.aiPlanDraft[field] = el.value; this.persistAiState(); }
    },

    editAiStageField(stageIndex, field, el) {
      if (!this.aiPlanDraft || !el) return;
      const stage = this.aiPlanDraft.stages[Number(stageIndex)];
      if (stage && (field === 'title' || field === 'description')) { stage[field] = el.value; this.persistAiState(); }
    },

    editAiTaskField(stageIndex, taskIndex, field, el) {
      if (!this.aiPlanDraft || !el) return;
      const task = this.aiPlanDraft.stages[Number(stageIndex)]?.tasks[Number(taskIndex)];
      if (!task || !['title', 'description', 'priority', 'estimatedHours', 'dueDate'].includes(field)) return;
      task[field] = field === 'estimatedHours' ? Math.min(40, Math.max(0.25, Number(el.value) || 0.25)) : el.value;
      this.persistAiState();
    },

    addAiStage() {
      if (!this.aiPlanDraft || this.aiPlanDraft.stages.length >= 10) return;
      this.aiPlanDraft.stages.push({ title: `مرحلة ${this.aiPlanDraft.stages.length + 1}`, description: '', tasks: [] });
      this.renderCurrentView();
    },

    removeAiStage(stageIndex) {
      if (!this.aiPlanDraft) return;
      this.aiPlanDraft.stages.splice(Number(stageIndex), 1);
      this.renderCurrentView();
    },

    addAiTask(stageIndex) {
      if (!this.aiPlanDraft) return;
      const stage = this.aiPlanDraft.stages[Number(stageIndex)];
      if (!stage || stage.tasks.length >= 10) return;
      stage.tasks.push({ title: 'مهمة جديدة', description: '', priority: 'medium', estimatedHours: 1, dueDate: '' });
      this.renderCurrentView();
    },

    removeAiTask(stageIndex, taskIndex) {
      if (!this.aiPlanDraft) return;
      const stage = this.aiPlanDraft.stages[Number(stageIndex)];
      if (!stage) return;
      stage.tasks.splice(Number(taskIndex), 1);
      this.renderCurrentView();
    },

    discardAiPlan() {
      this.aiPlanDraft = null;
      this.renderCurrentView();
      UI.showToast('تم إلغاء مسودة الخطة.');
    },

    acceptAiPlan() {
      if (!this.aiPlanDraft || !this.aiPlanDraft.stages.some(stage => stage.tasks.length)) {
        UI.showToast('أضف مرحلة واحدة على الأقل ومهمة واحدة قبل الحفظ.', 'error');
        return;
      }
      const domain = LearningStore.addGeneratedPlan(this.aiPlanDraft);
      if (!domain) {
        UI.showToast('تعذّر حفظ الخطة. راجع البيانات وحاول مجددًا.', 'error');
        return;
      }
      this.aiPlanDraft = null;
      this.persistAiState();
      this.navigate('domain-detail', { domainId: domain.id, tab: 'plan' });
      UI.showToast('تم حفظ خطة التعلّم ومهامها ضمن مجالات التعلم.');
    },

    addLearningLog(form, event) {
      if (event) event.preventDefault();
      const entry = LearningStore.addLearningLog({
        domainId: document.getElementById('log-domain').value || null,
        minutes: document.getElementById('log-minutes').value,
        concentration: document.getElementById('log-focus').value,
        summary: document.getElementById('log-summary').value.trim()
      });
      if (!entry) { UI.showToast('أدخل مدة صحيحة بين دقيقة و24 ساعة.', 'error'); return; }
      UI.showToast('تم تسجيل جلسة التعلم.');
    },

    printWeeklyReview() {
      const w = LearningStore.getWeeklyReview();
      const title = `تقرير التعلم الأسبوعي ${w.start} — ${w.end}`;
      const report = `<html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#172033;line-height:1.8}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{border:1px solid #ddd;padding:12px;text-align:right}.muted{color:#64748b}</style></head><body><h1>${title}</h1><p>ملخص أدائك خلال الأسبوع الحالي</p><table><tr><th>المؤشر</th><th>النتيجة</th></tr><tr><td>ساعات التعلم المسجلة</td><td>${w.current.hours} ساعة</td></tr><tr><td>أيام النشاط</td><td>${w.current.activeDays} من 7</td></tr><tr><td>المهام المنجزة</td><td>${w.current.completed} من ${w.current.total}</td></tr><tr><td>التغير عن الأسبوع السابق</td><td>${w.hoursChange} ساعة</td></tr></table><p class="muted">تم إنشاء التقرير من My Learning Hub.</p><script>window.onload=()=>window.print()<\/script></body></html>`;
      const win = window.open('', '_blank');
      if (!win) { UI.showToast('اسمح بالنوافذ المنبثقة لتصدير التقرير.', 'error'); return; }
      win.document.open(); win.document.write(report); win.document.close();
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
