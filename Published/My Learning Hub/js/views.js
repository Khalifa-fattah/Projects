// views.js - Rendering Logic for All Sections
(function(window) {
  'use strict';

  const { h } = UI;

  const Views = {
    // ---------------- 1. DASHBOARD VIEW ---------------- //
    renderDashboard(container) {
      const stats = LearningStore.getAnalytics();
      const settings = LearningStore.getSettings();
      const todayStr = LearningUtils.localDate();
      const todayTasks = LearningStore.getDailyTasks(todayStr);

      container.innerHTML = h`
        <div class="view-header">
          <div class="greeting-box">
            <h1 class="page-title">مرحباً بك، ${settings.userName || 'متعلم'} 👋</h1>
            <p class="page-subtitle">رحلتك التعليمية مستمرة، إليك ملخص لأدائك وإنجازاتك اليوم.</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-primary" data-action="navigate" data-arg0="daily">
              ${UI.getIcon('daily')} خطة اليوم (${stats.dailyDone}/${stats.dailyTotal})
            </button>
            <button class="btn btn-outline" data-action="openNewDomainModal">
              ${UI.getIcon('plus')} مجال جديد
            </button>
          </div>
        </div>

        <!-- Metric KPI Cards -->
        <div class="stats-grid dashboard-stats-grid">
          <div class="stat-card">
            <div class="stat-icon-wrapper color-blue">
              ${UI.getIcon('domains')}
            </div>
            <div class="stat-info">
              <span class="stat-label">المجالات التعليمية</span>
              <div class="stat-value-group">
                <span class="stat-value">${stats.totalDomains}</span>
                <span class="stat-sublabel">(${stats.activeDomains} نشط)</span>
              </div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon-wrapper color-green">
              ${UI.getIcon('checkCircle')}
            </div>
            <div class="stat-info">
              <span class="stat-label">المهام المكتملة</span>
              <div class="stat-value-group">
                <span class="stat-value">${stats.completedTasks}</span>
                <span class="stat-sublabel">من أصل ${stats.totalTasks}</span>
              </div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon-wrapper color-purple">
              ${UI.getIcon('target')}
            </div>
            <div class="stat-info">
              <span class="stat-label">نسبة الإنجاز الكلية</span>
              <div class="stat-value-group">
                <span class="stat-value">${stats.overallProgress}%</span>
              </div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon-wrapper color-amber">
              ${UI.getIcon('clock')}
            </div>
            <div class="stat-info">
              <span class="stat-label">ساعات التعلم المسجلة</span>
              <div class="stat-value-group">
                <span class="stat-value">${stats.hoursTracked}</span>
                <span class="stat-sublabel">ساعة</span>
              </div>
            </div>
          </div>
        </div>

        ${(() => { const week = LearningStore.getWeeklyReview(); const streak = LearningStore.getLearningStreak(); const next = stats.domainStats.find(d => d.status === 'active' && d.progress < 100); return h`
          <section class="card dashboard-week-card mt-4">
            <div class="card-body dashboard-week-row">
              <div><span class="text-muted">ساعات هذا الأسبوع</span><strong>${week.current.hours} س</strong></div>
              <div><span class="text-muted">أيام النشاط</span><strong>${week.current.activeDays}/7</strong></div>
              <div><span class="text-muted">سلسلة الالتزام</span><strong>🔥 ${streak} يوم</strong></div>
              <div class="dashboard-continue"><span class="text-muted">${next ? 'تابع تقدمك' : 'ابدأ مجالاً جديداً'}</span>
                <button class="btn btn-primary btn-sm" data-action="${next ? 'openDomain' : 'openNewDomainModal'}" ${next ? `data-arg0="${next.id}"` : ''}>${next ? 'متابعة التعلم' : 'إضافة مجال'}</button></div>
            </div>
          </section>`; })()}

        <!-- Main Dashboard Split Sections -->
        <div class="dashboard-grid">
          <!-- Left Column: Progress by Domain & Charts -->
          <div class="dashboard-col">
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">${UI.getIcon('chart')} تقدم المجالات التعليمية</h3>
                <button class="btn-text" data-action="navigate" data-arg0="domains">عرض الكل</button>
              </div>
              <div class="card-body">
                ${stats.domainStats.length === 0 ? h`
                  <div class="empty-state">
                    <p>لا توجد مجالات تعليمية حالياً. ابدأ بإنشاء أول مجال تعليمي لك!</p>
                    <button class="btn btn-primary btn-sm" data-action="openNewDomainModal">+ إضافة مجال</button>
                  </div>
                ` : h`
                  <div class="domain-progress-list">
                    ${stats.domainStats.map(d => h`
                      <div class="domain-progress-item" role="button" tabindex="0" data-action="openDomain" data-arg0="${d.id}">
                        <div class="domain-item-header">
                          <span class="domain-name font-bold">
                            <span class="status-dot ${d.status}"></span>
                            ${d.name}
                          </span>
                          <span class="domain-percent">${d.progress}%</span>
                        </div>
                        <div class="progress-bar-bg" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${d.progress}">
                          <div class="progress-bar-fill" style="width: ${d.progress}%; background-color: ${d.color || '#3B82F6'};"></div>
                        </div>
                        <div class="domain-item-footer text-muted">
                          <span>${d.completedTasks} من ${d.totalTasks} مهمة مكتملة</span>
                          <span>${d.completedStages} من ${d.totalStages} مرحلة</span>
                        </div>
                      </div>
                    `)}
                  </div>
                `}
              </div>
            </div>

            <!-- Learning Hours & Overall Analytics Card -->
            <div class="card mt-4">
              <div class="card-header">
                <h3 class="card-title">${UI.getIcon('target')} مؤشرات الإنجاز العامة</h3>
              </div>
              <div class="card-body">
                <div class="overall-progress-box">
                  <div class="radial-progress-wrapper">
                    <svg viewBox="0 0 36 36" class="circular-chart">
                      <path class="circle-bg"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path class="circle"
                        stroke-dasharray="${stats.overallProgress}, 100"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <text x="18" y="20.35" class="percentage">${stats.overallProgress}%</text>
                    </svg>
                  </div>
                  <div class="overall-details">
                    <p class="font-bold">حالة إنجاز خطتك الكلية</p>
                    <p class="text-muted">متبقي ${stats.remainingTasks} مهمة لإكمال جميع المراحل الحالية.</p>
                    <div class="chips-row">
                      <span class="badge badge-success">${stats.completedTasks} مكتملة</span>
                      <span class="badge badge-warning">${stats.inProgressTasks} قيد التنفيذ</span>
                      <span class="badge badge-neutral">${stats.todoTasks} لم تبدأ</span>
                      ${stats.overdueTasks > 0 ? h`<span class="badge badge-danger">${stats.overdueTasks} متأخرة</span>` : ''}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Today's Tasks & Recent Activity -->
          <div class="dashboard-col">
            <!-- Today's Tasks preview -->
            <div class="card">
              <div class="card-header">
                <div class="card-title-group">
                  <h3 class="card-title">${UI.getIcon('daily')} مهام اليوم</h3>
                  <span class="badge badge-primary">${todayTasks.filter(t => t.completed).length} / ${todayTasks.length}</span>
                </div>
                <button class="btn btn-outline btn-sm" data-action="openAddDailyTaskModal">+ مهمة</button>
              </div>
              <div class="card-body">
                ${todayTasks.length === 0 ? h`
                  <div class="empty-state">
                    <p>لا توجد مهام مجدولة لليوم حتى الآن. ابدأ يومك بإضافة مهمة!</p>
                    <button class="btn btn-outline btn-sm" data-action="openAddDailyTaskModal">+ جدولة مهمة لليوم</button>
                  </div>
                ` : h`
                  <div class="task-list">
                    ${todayTasks.map(task => h`
                      <div class="task-item ${task.completed ? 'task-done' : ''}">
                        <label class="custom-checkbox">
                          <input type="checkbox" aria-label="${'إنجاز المهمة: ' + task.title}" ${task.completed ? 'checked' : ''} data-action="toggleDailyTask" data-event="change" data-arg0="${task.id}">
                          <span class="checkmark"></span>
                        </label>
                        <div class="task-details">
                          <span class="task-title ${task.completed ? 'line-through' : ''}">${task.title}</span>
                          <div class="task-tags">
                            <span class="task-domain-badge" style="border-right-color: ${task.domainColor || '#3B82F6'}">${task.domainName || 'عام'}</span>
                            <span class="priority-tag priority-${task.priority}">${App.getPriorityLabel(task.priority)}</span>
                            ${task.estimatedHours ? h`<span class="hours-tag">${task.estimatedHours} س</span>` : ''}
                          </div>
                        </div>
                      </div>
                    `)}
                  </div>
                `}
              </div>
            </div>

            <!-- Activity Log preview -->
            <div class="card mt-4">
              <div class="card-header">
                <h3 class="card-title">${UI.getIcon('award')} سجل النشاط الأخير</h3>
                <button class="btn-text" data-action="navigate" data-arg0="stats">كل السجل</button>
              </div>
              <div class="card-body">
                ${stats.activityLog.length === 0 ? h`
                  <p class="text-muted text-center py-4">لا توجد أنشطة مسجلة بعد. عند إنجازك للمهام ستظهر هنا.</p>
                ` : h`
                  <div class="timeline">
                    ${stats.activityLog.slice(0, 5).map(act => h`
                      <div class="timeline-item">
                        <div class="timeline-dot"></div>
                        <div class="timeline-content">
                          <p class="timeline-text">
                            <strong>${act.title}</strong>
                            ${act.domainName ? h`<span class="timeline-domain">(${act.domainName})</span>` : ''}
                          </p>
                          <span class="timeline-time">${UI.timeAgo(act.timestamp)}</span>
                        </div>
                      </div>
                    `)}
                  </div>
                `}
              </div>
            </div>
          </div>
        </div>

        <section class="dashboard-chat-entry" aria-label="ابدأ محادثة مع Gemini">
          <div class="dashboard-chat-copy"><strong>لديك سؤال أو فكرة؟</strong><span>ابدأ محادثة مع Gemini مباشرة.</span></div>
          <form class="dashboard-chat-form" data-action="openChatFromDashboard" data-event="submit">
            <input class="form-control" type="text" name="dashboard-chat-prompt" maxlength="4000" placeholder="اكتب رسالتك هنا…" aria-label="اكتب رسالة إلى Gemini" required>
            <button class="btn btn-primary" type="submit" aria-label="فتح المحادثة">➤ إرسال</button>
          </form>
        </section>
      `;
    },

    // ---------------- 2. DOMAINS LIST VIEW ---------------- //
    renderDomains(container, filter = {}) {
      const domains = LearningStore.getDomains(filter);
      const currentFilter = filter.status || 'all';
      const currentSearch = filter.search || '';

      container.innerHTML = h`
        <div class="view-header">
          <div>
            <h1 class="page-title">مجالات التعلم والتطوير الذاتي</h1>
            <p class="page-subtitle">نظّم جميع مهاراتك ومساراتك التعليمية مع خطط مرحلية واضحة ومقاسة.</p>
          </div>
          <button class="btn btn-primary" data-action="openNewDomainModal">
            ${UI.getIcon('plus')} إضافة مجال تعليمي جديد
          </button>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="toolbar-card">
          <div class="search-input-wrapper">
            <span class="search-icon">${UI.getIcon('search')}</span>
            <input type="search" id="domain-search-input" class="search-input" aria-label="بحث في المجالات" placeholder="ابحث في المجالات والأوصاف..." value="${currentSearch}" data-action="onDomainSearch" data-event="input">
          </div>

          <div class="filter-tabs">
            <button type="button" aria-pressed="${currentFilter === 'all' ? 'true' : 'false'}" class="filter-tab ${currentFilter === 'all' ? 'active' : ''}" data-action="filterDomains" data-arg0="all">الكل</button>
            <button type="button" aria-pressed="${currentFilter === 'active' ? 'true' : 'false'}" class="filter-tab ${currentFilter === 'active' ? 'active' : ''}" data-action="filterDomains" data-arg0="active">نشط</button>
            <button type="button" aria-pressed="${currentFilter === 'paused' ? 'true' : 'false'}" class="filter-tab ${currentFilter === 'paused' ? 'active' : ''}" data-action="filterDomains" data-arg0="paused">متوقف مؤقتاً</button>
            <button type="button" aria-pressed="${currentFilter === 'completed' ? 'true' : 'false'}" class="filter-tab ${currentFilter === 'completed' ? 'active' : ''}" data-action="filterDomains" data-arg0="completed">مكتمل</button>
          </div>
        </div>

        <!-- Domains Cards Grid -->
        ${domains.length === 0 ? h`
          <div class="card empty-container">
            <div class="empty-state">
              <div class="empty-icon">${UI.getIcon('domains')}</div>
              <h3>لا توجد مجالات تعليمية مطابقة</h3>
              <p>جرّب تغيير عبارة البحث أو إضافة مجال تعليمي جديد لبدء مسار التعلم.</p>
              <button class="btn btn-primary" data-action="openNewDomainModal">
                ${UI.getIcon('plus')} إنشاء أول مجال الآن
              </button>
            </div>
          </div>
        ` : h`
          <div class="domains-grid">
            ${domains.map(d => {
              // Calculate domain progress
              let total = 0, completed = 0;
              d.stages.forEach(s => {
                s.tasks.forEach(t => {
                  total++;
                  if (t.status === 'completed') completed++;
                });
              });
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

              return h`
                <div class="domain-card" style="border-top: 4px solid ${d.color || '#3B82F6'}">
                  <div class="domain-card-header">
                    <div class="domain-card-title-group" role="button" tabindex="0" data-action="openDomain" data-arg0="${d.id}">
                      <div class="domain-avatar" style="background-color: ${d.color || '#3B82F6'}15; color: ${d.color || '#3B82F6'}">
                        ${UI.getIcon(d.icon || 'book')}
                      </div>
                      <div>
                        <h3 class="domain-title">${d.name}</h3>
                        <span class="status-pill status-${d.status}">${App.getStatusLabel(d.status)}</span>
                      </div>
                    </div>
                    <div class="dropdown">
                      <button type="button" class="btn-icon" aria-label="خيارات المجال" aria-haspopup="true" data-action="toggleDropdown" data-arg0="menu-${d.id}">
                        &vellip;
                      </button>
                      <div id="menu-${d.id}" class="dropdown-menu hidden">
                        <button data-action="openEditDomainModal" data-arg0="${d.id}">${UI.getIcon('edit')} تعديل المجال</button>
                        ${d.status === 'active' ? h`
                          <button data-action="changeDomainStatus" data-arg0="${d.id}" data-arg1="paused">${UI.getIcon('pause')} إيقاف مؤقت</button>
                        ` : h`
                          <button data-action="changeDomainStatus" data-arg0="${d.id}" data-arg1="active">${UI.getIcon('play')} استئناف التعلم</button>
                        `}
                        <button class="text-danger" data-action="deleteDomain" data-arg0="${d.id}">${UI.getIcon('trash')} حذف المجال</button>
                      </div>
                    </div>
                  </div>

                  <p class="domain-desc">${d.description || 'لا يوجد وصف مضاف لهذا المجال.'}</p>

                  <div class="domain-meta-info">
                    <div class="meta-row">
                      <span>المستوى: <strong>${d.currentLevel || 'مبتدئ'}</strong> &rarr; <strong>${d.targetLevel || 'متقدم'}</strong></span>
                    </div>
                    <div class="meta-row text-muted">
                      <span>${d.stages.length} مراحل &bull; ${completed}/${total} مهام</span>
                      <span>${pct}% إنجاز</span>
                    </div>
                  </div>

                  <div class="progress-bar-bg" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
                    <div class="progress-bar-fill" style="width: ${pct}%; background-color: ${d.color || '#3B82F6'}"></div>
                  </div>

                  <div class="domain-card-footer">
                    <button class="btn btn-outline btn-block" data-action="openDomain" data-arg0="${d.id}">
                      عرض الخطة والمراحل ${UI.getIcon('chevronLeft')}
                    </button>
                  </div>
                </div>
              `;
            })}
          </div>
        `}
      `;
    },

    // ---------------- 3. SINGLE DOMAIN DETAILS VIEW ---------------- //
    renderDomainDetail(container, domainId, activeTab = 'plan') {
      const domain = LearningStore.getDomainById(domainId);
      if (!domain) {
        container.innerHTML = h`
          <div class="card empty-container">
            <div class="empty-state">
              <h3>المجال التعليمي غير موجود</h3>
              <p>قد يكون تم حذفه أو تغييره.</p>
              <button class="btn btn-primary" data-action="navigate" data-arg0="domains">العودة إلى المجالات</button>
            </div>
          </div>
        `;
        return;
      }

      // Calculate progress
      let totalTasks = 0, completedTasks = 0;
      domain.stages.forEach(s => {
        s.tasks.forEach(t => {
          totalTasks++;
          if (t.status === 'completed') completedTasks++;
        });
      });
      const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      container.innerHTML = h`
        <!-- Domain Details Header -->
        <div class="detail-header-card" style="border-right: 5px solid ${domain.color || '#3B82F6'}">
          <div class="detail-header-top">
            <button class="btn-back" data-action="navigate" data-arg0="domains">
              ${UI.getIcon('chevronRight')} كل المجالات
            </button>
            <div class="detail-actions">
              <button class="btn btn-outline btn-sm" data-action="openEditDomainModal" data-arg0="${domain.id}">
                ${UI.getIcon('edit')} تعديل البيانات
              </button>
              <button class="btn btn-outline btn-sm" data-action="runGeminiCoach" data-arg0="${domain.id}">✨ مدرب Gemini</button>
              <button class="btn btn-outline btn-sm" data-action="replanDomain" data-arg0="${domain.id}">↻ إعادة التخطيط</button>
              <button class="btn btn-danger-outline btn-sm" data-action="deleteDomain" data-arg0="${domain.id}">
                ${UI.getIcon('trash')} حذف
              </button>
            </div>
          </div>

          <div class="detail-main-info">
            <div class="domain-avatar-large" style="background-color: ${domain.color || '#3B82F6'}20; color: ${domain.color || '#3B82F6'}">
              ${UI.getIcon(domain.icon || 'book')}
            </div>
            <div class="detail-title-desc">
              <div class="flex-row items-center gap-2">
                <h1 class="page-title">${domain.name}</h1>
                <span class="status-pill status-${domain.status}">${App.getStatusLabel(domain.status)}</span>
              </div>
              <p class="domain-long-desc">${domain.description || 'لم يتم إضافة وصف بعد.'}</p>
              ${domain.targetGoal ? h`
                <div class="target-goal-banner">
                  <span class="goal-label">🎯 الهدف النهائي:</span>
                  <span>${domain.targetGoal}</span>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Metadata Badges -->
          <div class="detail-meta-grid">
            <div class="meta-item">
              <span class="meta-label">تاريخ البداية</span>
              <span class="meta-val">${UI.formatDate(domain.startDate)}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">الموعد المستهدف</span>
              <span class="meta-val">${UI.formatDate(domain.targetDate)}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">المستوى الحالي</span>
              <span class="meta-val">${domain.currentLevel || 'مبتدئ'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">المستوى المستهدف</span>
              <span class="meta-val">${domain.targetLevel || 'متقدم'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">نسبة الإنجاز</span>
              <span class="meta-val font-bold" style="color: ${domain.color || '#3B82F6'}">${progressPct}% (${completedTasks}/${totalTasks} مهمة)</span>
            </div>
          </div>

          <div class="progress-bar-bg mt-3" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPct}">
            <div class="progress-bar-fill" style="width: ${progressPct}%; background-color: ${domain.color || '#3B82F6'}"></div>
          </div>
        </div>

        <!-- Section Tabs Navigation -->
        <div class="section-tabs" role="tablist" aria-label="أقسام المجال">
          <button type="button" role="tab" aria-selected="${activeTab === 'plan' ? 'true' : 'false'}" class="section-tab ${activeTab === 'plan' ? 'active' : ''}" data-action="switchDomainTab" data-arg0="${domain.id}" data-arg1="plan">
            ${UI.getIcon('target')} الخطة والمراحل (${domain.stages.length})
          </button>
          <button type="button" role="tab" aria-selected="${activeTab === 'resources' ? 'true' : 'false'}" class="section-tab ${activeTab === 'resources' ? 'active' : ''}" data-action="switchDomainTab" data-arg0="${domain.id}" data-arg1="resources">
            ${UI.getIcon('book')} المصادر التعليمية (${domain.resources.length})
          </button>
          <button type="button" role="tab" aria-selected="${activeTab === 'projects' ? 'true' : 'false'}" class="section-tab ${activeTab === 'projects' ? 'active' : ''}" data-action="switchDomainTab" data-arg0="${domain.id}" data-arg1="projects">
            ${UI.getIcon('code')} المشاريع التطبيقية (${domain.projects.length})
          </button>
          <button type="button" role="tab" aria-selected="${activeTab === 'notes' ? 'true' : 'false'}" class="section-tab ${activeTab === 'notes' ? 'active' : ''}" data-action="switchDomainTab" data-arg0="${domain.id}" data-arg1="notes">
            ${UI.getIcon('edit')} الملاحظات (${domain.notes.length})
          </button>
        </div>

        <!-- Tab Content Area -->
        <div class="tab-content mt-4" role="tabpanel">
          ${activeTab === 'plan' ? this.renderStagesTab(domain) : ''}
          ${activeTab === 'resources' ? this.renderResourcesTab(domain) : ''}
          ${activeTab === 'projects' ? this.renderProjectsTab(domain) : ''}
          ${activeTab === 'notes' ? this.renderNotesTab(domain) : ''}
        </div>
      `;
    },

    // Stages & Tasks sub-tab
    renderStagesTab(domain) {
      if (!domain.stages || domain.stages.length === 0) {
        return h`
          <div class="card empty-container">
            <div class="empty-state">
              <h3>لم تقم بإضافة مراحل بعد لهذا المجال</h3>
              <p>قسّم خطة تعلمك إلى مراحل متسلسلة (مثل: الأساسيات، التطبيق، المفاهيم المتقدمة).</p>
              <button class="btn btn-primary" data-action="openAddStageModal" data-arg0="${domain.id}">
                ${UI.getIcon('plus')} إضافة أول مرحلة
              </button>
            </div>
          </div>
        `;
      }

      return h`
        <div class="stages-header-row mb-3">
          <h2 class="sub-heading">مراحل الخطة التعليمية</h2>
          <button class="btn btn-primary btn-sm" data-action="openAddStageModal" data-arg0="${domain.id}">
            ${UI.getIcon('plus')} إضافة مرحلة جديدة
          </button>
        </div>

        <div class="stages-accordion">
          ${domain.stages.map((stage, sIdx) => {
            const sTotal = stage.tasks.length;
            const sDone = stage.tasks.filter(t => t.status === 'completed').length;
            const sPct = sTotal > 0 ? Math.round((sDone / sTotal) * 100) : 0;

            return h`
              <div class="stage-card" id="stage-card-${stage.id}">
                <div class="stage-card-header">
                  <div class="stage-header-title">
                    <span class="stage-index-badge">${sIdx + 1}</span>
                    <div>
                      <h3 class="stage-title">${stage.title}</h3>
                      <p class="stage-desc text-muted">${stage.description || 'لا يوجد وصف للمرحلة'}</p>
                    </div>
                  </div>

                  <div class="stage-header-right">
                    <div class="stage-progress-indicator">
                      <span class="text-xs font-bold">${sDone}/${sTotal} مهام (${sPct}%)</span>
                      <div class="progress-bar-bg mini" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${sPct}">
                        <div class="progress-bar-fill" style="width: ${sPct}%; background-color: ${sPct === 100 ? '#10B981' : '#3B82F6'}"></div>
                      </div>
                    </div>

                    <div class="stage-actions">
                      <button class="btn btn-outline btn-sm" data-action="openAddTaskModal" data-arg0="${domain.id}" data-arg1="${stage.id}" title="إضافة مهمة">
                        ${UI.getIcon('plus')} مهمة
                      </button>
                      <button class="btn-icon" data-action="openEditStageModal" data-arg0="${domain.id}" data-arg1="${stage.id}" title="تعديل المرحلة">
                        ${UI.getIcon('edit')}
                      </button>
                      <button class="btn-icon text-danger" data-action="deleteStage" data-arg0="${domain.id}" data-arg1="${stage.id}" title="حذف المرحلة">
                        ${UI.getIcon('trash')}
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Stage Tasks List -->
                <div class="stage-tasks-container">
                  ${stage.tasks.length === 0 ? h`
                    <p class="empty-tasks-text">لا توجد مهام في هذه المرحلة بعد. <button type="button" class="link-btn" data-action="openAddTaskModal" data-arg0="${domain.id}" data-arg1="${stage.id}">أضف مهمة جديدة الآن</button></p>
                  ` : h`
                    <div class="tasks-table">
                      ${stage.tasks.map(task => h`
                        <div class="task-row ${task.status === 'completed' ? 'task-row-done' : ''}" id="${'task-' + task.id}">
                          <div class="task-check-cell">
                            <label class="custom-checkbox">
                              <input type="checkbox" aria-label="${'إنجاز المهمة: ' + task.title}" ${task.status === 'completed' ? 'checked' : ''} data-action="toggleTask" data-event="change" data-arg0="${domain.id}" data-arg1="${stage.id}" data-arg2="${task.id}">
                              <span class="checkmark"></span>
                            </label>
                          </div>

                          <div class="task-info-cell">
                            <span class="task-name ${task.status === 'completed' ? 'line-through' : ''}">${task.title}</span>
                            ${task.description ? h`<p class="task-small-desc">${task.description}</p>` : ''}
                            ${task.notes ? h`<p class="task-notes-callout">${task.notes}</p>` : ''}
                            
                            <!-- Task Links if any -->
                            ${(task.links || []).map(UI.safeUrl).filter(Boolean).length > 0 ? h`
                              <div class="task-links-list">
                                ${(task.links || []).map(UI.safeUrl).filter(Boolean).map(l => h`<a href="${l}" target="_blank" rel="noopener noreferrer">${UI.getIcon('external')} مرجع مرتبط</a>`)}
                              </div>
                            ` : ''}
                          </div>

                          <div class="task-badges-cell">
                            <span class="priority-tag priority-${task.priority}">${App.getPriorityLabel(task.priority)}</span>
                            <span class="status-badge status-${task.status}">${App.getTaskStatusLabel(task.status)}</span>
                            ${task.dueDate ? h`<span class="due-badge ${task.dueDate < LearningUtils.localDate() && task.status !== 'completed' ? 'overdue' : ''}">${UI.getIcon('calendar')} ${task.dueDate}</span>` : ''}
                            ${task.estimatedHours ? h`<span class="hours-badge">${task.estimatedHours} س</span>` : ''}
                          </div>

                          <div class="task-actions-cell">
                            <button class="btn-icon" data-action="addDomainTaskToDaily" data-arg0="${domain.id}" data-arg1="${stage.id}" data-arg2="${task.id}" title="إضافة لخطة اليوم">
                              ${UI.getIcon('daily')}
                            </button>
                            <button class="btn-icon" data-action="openEditTaskModal" data-arg0="${domain.id}" data-arg1="${stage.id}" data-arg2="${task.id}" title="تعديل المهمة">
                              ${UI.getIcon('edit')}
                            </button>
                            <button class="btn-icon text-danger" data-action="deleteTask" data-arg0="${domain.id}" data-arg1="${stage.id}" data-arg2="${task.id}" title="حذف المهمة">
                              ${UI.getIcon('trash')}
                            </button>
                          </div>
                        </div>
                      `)}
                    </div>
                  `}
                </div>
              </div>
            `;
          })}
        </div>
      `;
    },

    // Resources Tab
    renderResourcesTab(domain) {
      return h`
        <div class="tab-header-row mb-3">
          <h2 class="sub-heading">المصادر والدورات والكتب المرجعية</h2>
          <button class="btn btn-primary btn-sm" data-action="openAddResourceModal" data-arg0="${domain.id}">
            ${UI.getIcon('plus')} إضافة مصدر تعليمي
          </button>
        </div>

        ${domain.resources.length === 0 ? h`
          <div class="card empty-container">
            <div class="empty-state">
              <h3>لا توجد مصادر تعليمية مضافة</h3>
              <p>احتفظ بروابط الدورات التدريبية، قنوات اليوتيوب، الكتب، والتوثيقات الرسمية هنا.</p>
              <button class="btn btn-primary" data-action="openAddResourceModal" data-arg0="${domain.id}">
                ${UI.getIcon('plus')} إضافة أول مصدر
              </button>
            </div>
          </div>
        ` : h`
          <div class="resources-grid">
            ${domain.resources.map(res => h`
              <div class="resource-card" id="${'res-' + res.id}">
                <div class="resource-top">
                  <span class="resource-type-badge">${App.getResourceTypeLabel(res.type)}</span>
                  <button class="btn-icon text-danger" data-action="deleteResource" data-arg0="${domain.id}" data-arg1="${res.id}" title="حذف">
                    ${UI.getIcon('trash')}
                  </button>
                </div>
                <h4 class="resource-title">${res.title}</h4>
                <p class="resource-desc text-muted">${res.description || 'لا يوجد وصف مضاف'}</p>
                <div class="resource-footer">
                  ${UI.safeUrl(res.url) ? h`<a href="${UI.safeUrl(res.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm btn-block">
                    فتح الرابط ${UI.getIcon('external')}
                  </a>` : h`<span class="text-muted text-sm">لا يوجد رابط صالح</span>`}
                </div>
              </div>
            `)}
          </div>
        `}
      `;
    },

    // Projects Tab
    renderProjectsTab(domain) {
      return h`
        <div class="tab-header-row mb-3">
          <h2 class="sub-heading">المشاريع التطبيقية العملية</h2>
          <button class="btn btn-primary btn-sm" data-action="openAddProjectModal" data-arg0="${domain.id}">
            ${UI.getIcon('plus')} إضافة مشروع تطبيقي
          </button>
        </div>

        ${domain.projects.length === 0 ? h`
          <div class="card empty-container">
            <div class="empty-state">
              <h3>لا توجد مشاريع عملية مضافة</h3>
              <p>التعلم الحقيقي يبدأ بالتطبيق العملي. خطط لمشروعك الأول لبناء معرض أعمال قوي.</p>
              <button class="btn btn-primary" data-action="openAddProjectModal" data-arg0="${domain.id}">
                ${UI.getIcon('plus')} إضافة أول مشروع
              </button>
            </div>
          </div>
        ` : h`
          <div class="projects-grid">
            ${domain.projects.map(proj => h`
              <div class="project-card" id="${'proj-' + proj.id}">
                <div class="project-header">
                  <h4 class="project-title">${proj.title}</h4>
                  <span class="status-pill status-${proj.status}">${App.getProjectStatusLabel(proj.status)}</span>
                </div>
                <p class="project-desc">${proj.description || 'لا يوجد وصف تفصيلي'}</p>
                
                ${proj.skills ? h`
                  <div class="project-info-row">
                    <strong>المهارات المستهدفة:</strong>
                    <span>${proj.skills}</span>
                  </div>
                ` : ''}

                ${proj.tasksNeeded ? h`
                  <div class="project-info-row">
                    <strong>المهام المطلوبة:</strong>
                    <span>${proj.tasksNeeded}</span>
                  </div>
                ` : ''}

                <div class="project-links-row">
                  ${UI.safeUrl(proj.liveUrl) ? h`<a href="${UI.safeUrl(proj.liveUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">${UI.getIcon('external')} معاينة حية</a>` : ''}
                  ${UI.safeUrl(proj.repoUrl) ? h`<a href="${UI.safeUrl(proj.repoUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">${UI.getIcon('code')} المستودع البرمجي</a>` : ''}
                  <button class="btn-icon text-danger mr-auto" data-action="deleteProject" data-arg0="${domain.id}" data-arg1="${proj.id}" title="حذف">${UI.getIcon('trash')}</button>
                </div>
              </div>
            `)}
          </div>
        `}
      `;
    },

    // Notes Tab
    renderNotesTab(domain) {
      return h`
        <div class="tab-header-row mb-3">
          <h2 class="sub-heading">الملاحظات والاستنتاجات الشخصية</h2>
          <button class="btn btn-primary btn-sm" data-action="openAddNoteModal" data-arg0="${domain.id}">
            ${UI.getIcon('plus')} إضافة ملاحظة
          </button>
        </div>

        ${domain.notes.length === 0 ? h`
          <div class="card empty-container">
            <div class="empty-state">
              <h3>لا توجد ملاحظات مدونة</h3>
              <p>دوّن الخلاصة الذهبية لكل كتاب أو دورة، والحلول للمشاكل التقنية التي واجهتك.</p>
              <button class="btn btn-primary" data-action="openAddNoteModal" data-arg0="${domain.id}">
                ${UI.getIcon('plus')} تدوين أول ملاحظة
              </button>
            </div>
          </div>
        ` : h`
          <div class="notes-grid">
            ${domain.notes.map(note => h`
              <div class="note-card" id="${'note-' + note.id}">
                <div class="note-header">
                  <h4 class="note-title">${note.title}</h4>
                  <div class="note-actions">
                    <span class="note-date text-muted">${UI.formatDate(note.updatedAt)}</span>
                    <button class="btn-icon text-danger" data-action="deleteNote" data-arg0="${domain.id}" data-arg1="${note.id}" title="حذف">
                      ${UI.getIcon('trash')}
                    </button>
                  </div>
                </div>
                <div class="note-body">
                  ${note.content}
                </div>
              </div>
            `)}
          </div>
        `}
      `;
    },

    // ---------------- 4. DAILY PLAN VIEW ---------------- //
    renderDailyPlan(container) {
      const todayStr = LearningUtils.localDate();
      const tasks = LearningStore.getDailyTasks(todayStr);
      const total = tasks.length;
      const done = tasks.filter(t => t.completed).length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;

      container.innerHTML = h`
        <div class="view-header">
          <div>
            <h1 class="page-title">خطة اليوم - ${UI.formatDate(todayStr)}</h1>
            <p class="page-subtitle">حدد أولوياتك اليومية وأنجز بتركيز وهدوء دون تشتت.</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-primary" data-action="openAddDailyTaskModal">
              ${UI.getIcon('plus')} إضافة مهمة لليوم
            </button>
          </div>
        </div>

        <!-- Daily Progress Banner -->
        <div class="daily-progress-banner">
          <div class="daily-banner-info">
            <h3 class="daily-banner-title">إنجاز اليوم: ${done} من ${total} مهمة (${pct}%)</h3>
            <p class="daily-banner-subtitle">${pct === 100 && total > 0 ? 'رائع جداً! لقد أكملت جميع مهامك المحددة لهذا اليوم 🚀' : 'استمر خطوة بخطوة نحو تحقيق أهدافك التعليمية.'}</p>
          </div>
          <div class="daily-banner-bar">
            <div class="progress-bar-bg" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
              <div class="progress-bar-fill" style="width: ${pct}%; background-color: #10B981;"></div>
            </div>
          </div>
        </div>

        <!-- Daily Tasks Table/List -->
        <div class="card mt-4">
          <div class="card-header">
            <h3 class="card-title">${UI.getIcon('daily')} المهام المجدولة</h3>
            <span class="text-muted text-sm">ملاحظة: حذف المهمة من هنا لا يحذفها من مسار التعلم الأصلي.</span>
          </div>
          <div class="card-body">
            ${tasks.length === 0 ? h`
              <div class="empty-state">
                <div class="empty-icon">${UI.getIcon('daily')}</div>
                <h3>قائمة مهام اليوم فارغة</h3>
                <p>اختر من مهام مجالاتك التعليمية الحالية أو أضف مهمة حرة لليوم.</p>
                <button class="btn btn-primary" data-action="openAddDailyTaskModal">
                  ${UI.getIcon('plus')} جدولة أول مهمة اليوم
                </button>
              </div>
            ` : h`
              <div class="daily-tasks-list">
                ${tasks.map(t => h`
                  <div class="daily-task-item ${t.completed ? 'daily-done' : ''}">
                    <div class="daily-check-col">
                      <label class="custom-checkbox">
                        <input type="checkbox" aria-label="${'إنجاز المهمة: ' + t.title}" ${t.completed ? 'checked' : ''} data-action="toggleDailyTask" data-event="change" data-arg0="${t.id}">
                        <span class="checkmark"></span>
                      </label>
                    </div>

                    <div class="daily-content-col">
                      <span class="daily-task-title ${t.completed ? 'line-through' : ''}">${t.title}</span>
                      <div class="daily-task-tags">
                        <span class="task-domain-badge" style="border-right-color: ${t.domainColor || '#3B82F6'}">${t.domainName || 'مهمة حرة'}</span>
                        <span class="priority-tag priority-${t.priority}">${App.getPriorityLabel(t.priority)}</span>
                        ${t.estimatedHours ? h`<span class="hours-tag">${t.estimatedHours} ساعة متوقعة</span>` : ''}
                      </div>
                      ${t.notes ? h`<p class="daily-task-notes">${t.notes}</p>` : ''}
                    </div>

                    <div class="daily-actions-col">
                      <button class="btn-icon text-danger" data-action="deleteDailyTask" data-arg0="${t.id}" title="إزالة من خطة اليوم">
                        ${UI.getIcon('trash')}
                      </button>
                    </div>
                  </div>
                `)}
              </div>
            `}
          </div>
        </div>
      `;
    },

    // ---------------- 5. STATS & ACTIVITY VIEW ---------------- //
    renderStats(container) {
      const stats = LearningStore.getAnalytics();

      container.innerHTML = h`
        <div class="view-header">
          <div>
            <h1 class="page-title">سجل التعلم والإحصائيات</h1>
            <p class="page-subtitle">رؤية تفصيلية لتطور أدائك ومعدل إنجاز المهام على مر الوقت.</p>
          </div>
        </div>

        ${(() => { const w = LearningStore.getWeeklyReview(); const streak = LearningStore.getLearningStreak(); return h`
          <section class="card weekly-review-card mb-4">
            <div class="card-header"><h3 class="card-title">مراجعة الأسبوع</h3><button class="btn btn-outline btn-sm" data-action="printWeeklyReview">تصدير التقرير / PDF</button></div>
            <div class="card-body">
              <div class="stats-grid compact-stats">
                <div class="stat-card"><div class="stat-info"><span class="stat-label">وقت التعلم</span><span class="stat-value">${w.current.hours} س</span></div></div>
                <div class="stat-card"><div class="stat-info"><span class="stat-label">أيام النشاط</span><span class="stat-value">${w.current.activeDays}/7</span></div></div>
                <div class="stat-card"><div class="stat-info"><span class="stat-label">مهام خطة اليوم</span><span class="stat-value">${w.current.completed}/${w.current.total}</span></div></div>
                <div class="stat-card"><div class="stat-info"><span class="stat-label">سلسلة الالتزام</span><span class="stat-value">🔥 ${streak} يوم</span></div></div>
              </div>
              <p class="form-hint">مقارنة بالأسبوع السابق: ${w.hoursChange > 0 ? '+' : ''}${w.hoursChange} ساعة.</p>
            </div>
          </section>`; })()}

        <section class="card learning-log-form mb-4">
          <div class="card-header"><h3 class="card-title">تسجيل جلسة تعلم</h3></div>
          <div class="card-body">
            <form data-action="addLearningLog" data-event="submit" class="learning-log-fields">
              <div class="form-group"><label class="form-label" for="log-domain">المجال</label><select class="form-control" id="log-domain"><option value="">تعلم عام</option>${LearningStore.getDomains().map(d=>h`<option value="${d.id}">${d.name}</option>`)}</select></div>
              <div class="form-group"><label class="form-label" for="log-minutes">المدة بالدقائق</label><input class="form-control" id="log-minutes" type="number" min="1" max="1440" value="30" required></div>
              <div class="form-group"><label class="form-label" for="log-focus">التركيز</label><select class="form-control" id="log-focus"><option value="high">مرتفع</option><option value="medium" selected>متوسط</option><option value="low">منخفض</option></select></div>
              <div class="form-group log-summary-field"><label class="form-label" for="log-summary">ماذا تعلمت؟ (اختياري)</label><input class="form-control" id="log-summary" maxlength="1200" placeholder="ملخص قصير لما أنجزته"></div>
              <button class="btn btn-primary" type="submit">حفظ الجلسة</button>
            </form>
          </div>
        </section>

        <!-- Metric summary -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon-wrapper color-green">${UI.getIcon('checkCircle')}</div>
            <div class="stat-info">
              <span class="stat-label">إجمالي المهام المنجزة</span>
              <span class="stat-value">${stats.completedTasks}</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon-wrapper color-blue">${UI.getIcon('domains')}</div>
            <div class="stat-info">
              <span class="stat-label">المجالات المكتملة كلياً</span>
              <span class="stat-value">${stats.completedDomains}</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon-wrapper color-purple">${UI.getIcon('target')}</div>
            <div class="stat-info">
              <span class="stat-label">نسبة الإنجاز الإجمالية</span>
              <span class="stat-value">${stats.overallProgress}%</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon-wrapper color-amber">${UI.getIcon('clock')}</div>
            <div class="stat-info">
              <span class="stat-label">ساعات التعلم الكلية</span>
              <span class="stat-value">${stats.hoursTracked} س</span>
            </div>
          </div>
        </div>

        ${(() => { const a = LearningStore.getAnalytics(); const streak = LearningStore.getLearningStreak(); const badges = [
          {label:'أول إنجاز',ok:a.completedTasks>=1,icon:'🎯'}, {label:'10 مهام مكتملة',ok:a.completedTasks>=10,icon:'🏅'},
          {label:'5 ساعات تعلم',ok:a.hoursTracked>=5,icon:'⏱️'}, {label:'3 أيام التزام',ok:streak>=3,icon:'🔥'},
          {label:'أول مجال مكتمل',ok:a.completedDomains>=1,icon:'🏆'}]; return h`<section class="card mt-4"><div class="card-header"><h3 class="card-title">إنجازاتك</h3></div><div class="card-body achievement-list">${badges.map(b=>h`<div class="achievement-badge ${b.ok?'is-earned':'is-locked'}"><span>${b.icon}</span><strong>${b.label}</strong><small>${b.ok?'تم فتحها':'لم تُفتح بعد'}</small></div>`)}</div></section>`; })()}

        <section class="card mt-4">
          <div class="card-header"><h3 class="card-title">سجل جلسات التعلم</h3><span class="badge badge-neutral">${LearningStore.getLearningLogs().length} جلسة</span></div>
          <div class="card-body">${LearningStore.getLearningLogs().slice(0,12).length ? h`<div class="learning-log-list">${LearningStore.getLearningLogs().slice(0,12).map(x=>h`<div class="learning-log-item"><div><strong>${x.domainName}</strong><p class="text-muted">${x.summary || 'جلسة تعلم مسجلة'} · ${UI.formatDate(x.date)}</p></div><span class="badge badge-primary">${x.minutes} دقيقة</span></div>`)}</div>` : h`<p class="text-muted">سجّل جلساتك لتكوين سجل واضح لتقدمك.</p>`}</div>
        </section>

        <div class="grid-2-cols mt-4">
          <!-- Domain breakdown table -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">${UI.getIcon('chart')} نشاط ومستوى المجالات</h3>
            </div>
            <div class="card-body">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>المجال</th>
                    <th>الحالة</th>
                    <th>المهام</th>
                    <th>التقدم</th>
                  </tr>
                </thead>
                <tbody>
                  ${stats.domainStats.map(d => h`
                    <tr>
                      <td class="font-bold">${d.name}</td>
                      <td><span class="status-pill status-${d.status}">${App.getStatusLabel(d.status)}</span></td>
                      <td>${d.completedTasks}/${d.totalTasks}</td>
                      <td>
                        <div class="progress-cell">
                          <span>${d.progress}%</span>
                          <div class="progress-bar-bg mini" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${d.progress}">
                            <div class="progress-bar-fill" style="width: ${d.progress}%; background-color: ${d.color || '#3B82F6'}"></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  `)}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Activity History List -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">${UI.getIcon('award')} سجل الأنشطة والإنجازات الكامل</h3>
            </div>
            <div class="card-body">
              ${stats.activityLog.length === 0 ? h`
                <p class="text-muted text-center py-4">لا توجد أنشطة مسجلة بعد.</p>
              ` : h`
                <div class="timeline">
                  ${stats.activityLog.map(act => h`
                    <div class="timeline-item">
                      <div class="timeline-dot"></div>
                      <div class="timeline-content">
                        <p class="timeline-text">
                          <strong>${act.title}</strong>
                          ${act.domainName ? h`<span class="timeline-domain">(${act.domainName})</span>` : ''}
                        </p>
                        <span class="timeline-time">${UI.formatDate(act.timestamp)} &bull; ${UI.timeAgo(act.timestamp)}</span>
                      </div>
                    </div>
                  `)}
                </div>
              `}
            </div>
          </div>
        </div>
      `;
    },

    // ---------------- 5b. FOCUS (POMODORO) VIEW ---------------- //
    renderFocus(container) {
      const st = Focus.state;
      const pomo = LearningStore.getPomodoroSettings();
      const stats = LearningStore.getAnalytics();
      const todayStr = LearningUtils.localDate();
      const todaySessions = LearningStore.getFocusSessions(todayStr);
      const recent = LearningStore.getFocusSessions().slice(-8).reverse();
      const domains = LearningStore.getDomains();
      const locked = st.running;

      container.innerHTML = h`
        <div class="view-header">
          <div>
            <h1 class="page-title">مؤقت التركيز (بومودورو)</h1>
            <p class="page-subtitle">اعمل بتركيز في جلسات قصيرة. كل جلسة مكتملة تُضاف تلقائياً إلى ساعات التعلم.</p>
          </div>
        </div>

        <div class="grid-2-cols">
          <div class="card">
            <div class="card-body pomo-panel">
              <div class="pomo-modes" role="group" aria-label="نوع الجلسة">
                ${Focus.MODES.map(m => h`
                  <button type="button" class="filter-tab ${st.mode === m ? 'active' : ''}" aria-pressed="${st.mode === m ? 'true' : 'false'}"
                    ${locked ? 'disabled' : ''} data-action="setFocusMode" data-arg0="${m}">${Focus.MODE_LABELS[m]}</button>
                `)}
              </div>

              <div class="pomo-time" id="pomo-time" role="timer" aria-live="off">${Focus.format(Focus.getRemainingMs())}</div>
              <div class="progress-bar-bg" id="pomo-progress" role="progressbar" aria-label="تقدم الجلسة" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Focus.getProgressPct()}">
                <div class="progress-bar-fill" style="width: ${Focus.getProgressPct()}%; background-color: ${st.mode === 'focus' ? '#2563eb' : '#10B981'};"></div>
              </div>

              <div class="pomo-controls">
                ${st.running
                  ? h`<button type="button" class="btn btn-primary" data-action="focusPause">${UI.getIcon('pause')} إيقاف مؤقت</button>`
                  : h`<button type="button" class="btn btn-primary" data-action="focusStart">${UI.getIcon('play')} ${Focus.getRemainingMs() < Focus.durationMs(st.mode) ? 'استئناف' : 'ابدأ'}</button>`}
                <button type="button" class="btn btn-outline" data-action="focusReset">${UI.getIcon('refresh')} إعادة ضبط</button>
                ${st.mode !== 'focus' ? h`<button type="button" class="btn btn-outline" data-action="focusSkipBreak">تخطي الاستراحة</button>` : ''}
              </div>

              <div class="form-group pomo-domain">
                <label class="form-label" for="pomo-domain-select">المجال الذي تدرسه الآن (اختياري)</label>
                <select id="pomo-domain-select" class="form-control" data-action="focusSetDomain" data-event="change">
                  <option value="">بدون تحديد</option>
                  ${domains.map(d => h`<option value="${d.id}" ${st.domainId === d.id ? 'selected' : ''}>${d.name}</option>`)}
                </select>
              </div>
              <p class="text-muted text-sm">الجلسات المنجزة في الدورة الحالية: ${st.cycle % 4} من 4 قبل الاستراحة الطويلة.</p>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title">${UI.getIcon('clock')} إحصائيات التركيز</h3>
            </div>
            <div class="card-body">
              <div class="pomo-stats">
                <div><span class="stat-value">${todaySessions.length}</span><span class="text-muted">جلسات اليوم</span></div>
                <div><span class="stat-value">${Math.round(stats.focusMinutesToday)}</span><span class="text-muted">دقيقة اليوم</span></div>
                <div><span class="stat-value">${stats.hoursTracked}</span><span class="text-muted">إجمالي الساعات</span></div>
              </div>

              <h4 class="sub-heading mt-4">آخر الجلسات</h4>
              ${recent.length === 0 ? h`<p class="text-muted">لا توجد جلسات بعد. ابدأ أول جلسة تركيز!</p>` : h`
                <ul class="pomo-sessions">
                  ${recent.map(f => h`<li><span>${UI.formatDate(f.date)}${f.domainName ? ' • ' + f.domainName : ''}</span><strong>${Math.round(f.minutes)} د</strong></li>`)}
                </ul>`}

              <hr class="divider">
              <h4 class="sub-heading">تخصيص المدد (بالدقائق)</h4>
              <div class="form-row">
                <div class="form-group flex-1">
                  <label class="form-label" for="pomo-set-focus">التركيز</label>
                  <input type="number" id="pomo-set-focus" class="form-control" min="1" max="180" value="${pomo.focus}">
                </div>
                <div class="form-group flex-1">
                  <label class="form-label" for="pomo-set-short">استراحة قصيرة</label>
                  <input type="number" id="pomo-set-short" class="form-control" min="1" max="180" value="${pomo.short}">
                </div>
                <div class="form-group flex-1">
                  <label class="form-label" for="pomo-set-long">استراحة طويلة</label>
                  <input type="number" id="pomo-set-long" class="form-control" min="1" max="180" value="${pomo.long}">
                </div>
              </div>
              <button type="button" class="btn btn-outline" ${locked ? 'disabled' : ''} data-action="savePomodoroSettings">حفظ المدد</button>
              ${locked ? h`<span class="form-hint">أوقف المؤقت أولاً لتعديل المدد.</span>` : ''}
            </div>
          </div>
        </div>
      `;
    },

    // ---------------- 6. SETTINGS VIEW ---------------- //
    renderFreeChat(container, messages = [], busy = false) {
      const hasKey = window.GeminiAssistant.hasKey();
      container.innerHTML = h`
        <div class="view-header free-chat-header">
          <div><h1 class="page-title">محادثة حرة مع Gemini</h1><p class="page-subtitle">اسأل عمّا تريد، وتابع الحوار في نفس المحادثة.</p></div>
          <div class="header-actions"><button class="btn btn-outline" data-action="clearFreeChat" ${messages.length ? '' : 'disabled'}>محادثة جديدة</button></div>
        </div>
        ${!hasKey ? h`<div class="card"><div class="card-body"><p>أضف مفتاح Gemini API أولاً لتفعيل المحادثة.</p><button class="btn btn-primary" data-action="navigate" data-arg0="settings">فتح إعدادات Gemini</button></div></div>` : h`
          <section class="card free-chat-card" aria-label="محادثة Gemini">
            <div class="free-chat-messages" id="free-chat-messages" aria-live="polite">
              ${messages.length ? messages.map(m => h`<article class="free-chat-message ${m.role === 'user' ? 'from-user' : 'from-model'}"><div class="free-chat-role">${m.role === 'user' ? 'أنت' : 'Gemini'}</div><div class="free-chat-text">${m.text}</div></article>`) : h`<div class="free-chat-empty"><span>✦</span><strong>ابدأ سؤالك الأول</strong><p>يمكنك السؤال عن التعلم أو العمل أو البرمجة أو أي موضوع آخر.</p></div>`}
              ${busy ? h`<article class="free-chat-message from-model"><div class="free-chat-role">Gemini</div><div class="free-chat-text typing-indicator">يفكر الآن…</div></article>` : ''}
            </div>
            <form class="free-chat-composer" data-action="sendFreeChat" data-event="submit">
              <textarea id="free-chat-input" class="form-control" rows="2" maxlength="4000" placeholder="اكتب رسالتك هنا…" aria-label="رسالتك إلى Gemini" ${busy ? 'disabled' : ''} required></textarea>
              <button type="submit" class="btn btn-primary" ${busy ? 'disabled' : ''}>${busy ? 'جارٍ الإرسال…' : 'إرسال'}</button>
            </form>
            <p class="free-chat-note">قد يخطئ النموذج؛ تحقّق من المعلومات المهمة. تُرسل رسائلك إلى Google Gemini لمعالجتها.</p>
          </section>`}
      `;
      const box = document.getElementById('free-chat-messages');
      if (box) box.scrollTop = box.scrollHeight;
    },

    renderAiAssistant(container, draft, requesting = false, form = {}) {
      const usage = window.GeminiAssistant.getUsage();
      const hasKey = window.GeminiAssistant.hasKey();
      const taskCount = draft ? draft.stages.reduce((sum, stage) => sum + stage.tasks.length, 0) : 0;
      container.innerHTML = h`
        <div class="view-header">
          <div>
            <h1 class="page-title">مساعد إنشاء خطة تعلّم</h1>
            <p class="page-subtitle">اكتب هدفك، وسيقترح Gemini مراحل ومهامًا عملية يمكنك مراجعتها وتعديلها قبل حفظها.</p>
            <p class="form-hint ai-privacy-note">عند استخدام المساعد أو المدرب، تُرسل إلى Google Gemini بيانات الهدف والمهام والتقدم وسجل التعلم اللازم للتحليل. لا تُرسل معلومات حساسة؛ وقد تُستخدم البيانات وفق شروط Google وخطتك.</p>
          </div>
        </div>

        <div class="card ai-usage-card">
          <div class="card-body ai-usage-row">
            <div>
              <strong>${hasKey ? 'Gemini جاهز للاستخدام' : 'يلزم إعداد مفتاح Gemini أولًا'}</strong>
              <p class="text-muted mb-0">استخدام اليوم من هذا المتصفح: ${usage.requests} طلب. هذا عدّاد محلي وليس قياسًا للحصة المتبقية لدى Google.</p>
            </div>
            <button type="button" class="btn btn-outline" data-action="navigate" data-arg0="settings">إعدادات مفتاح Gemini</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h2 class="card-title">معلومات الخطة</h2></div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label" for="ai-goal">ما المهارة أو الهدف الذي تريد تعلمه؟</label>
              <input id="ai-goal" class="form-control" maxlength="240" placeholder="مثال: تعلم تطوير واجهات الويب باستخدام React" required value="${form.goal || ''}" data-action="aiFormInput" data-event="input" data-arg0="goal">
            </div>
            <div class="form-row">
              <div class="form-group flex-1">
                <label class="form-label" for="ai-current-level">مستواك الحالي</label>
                <input id="ai-current-level" class="form-control" maxlength="80" value="${form.currentLevel ?? 'مبتدئ'}" placeholder="مبتدئ، متوسط…" data-action="aiFormInput" data-event="input" data-arg0="currentLevel">
              </div>
              <div class="form-group flex-1">
                <label class="form-label" for="ai-target-level">المستوى الذي تريد الوصول إليه</label>
                <input id="ai-target-level" class="form-control" maxlength="80" placeholder="اتركه فارغًا ليقترحه المساعد" value="${form.targetLevel || ''}" data-action="aiFormInput" data-event="input" data-arg0="targetLevel">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="ai-purpose">ما الذي تريد تحقيقه من تعلم هذه المهارة؟</label>
              <input id="ai-purpose" class="form-control" maxlength="240" placeholder="مثال: استخدامها في عملي أو بناء مشروع مستقل" value="${form.purpose || ''}" data-action="aiFormInput" data-event="input" data-arg0="purpose">
            </div>
            <div class="form-row">
              <div class="form-group flex-1">
                <label class="form-label" for="ai-learning-style">ما أسلوب التعلم الذي تفضله؟</label>
                <select id="ai-learning-style" class="form-control" data-action="aiFormInput" data-event="change" data-arg0="learningStyle">
                  ${['متوازن (شرح وتطبيق)','مشاريع عملية','دروس وفيديوهات','قراءة ومراجع','تمارين واختبارات'].map(x => h`<option value="${x}" ${(form.learningStyle || 'متوازن (شرح وتطبيق)') === x ? 'selected' : ''}>${x}</option>`)}
                </select>
              </div>
              <div class="form-group flex-1">
                <label class="form-label" for="ai-days-week">أيام الدراسة أسبوعيًا</label>
                <input id="ai-days-week" type="number" class="form-control" min="1" max="7" value="${form.daysPerWeek ?? 5}" data-action="aiFormInput" data-event="input" data-arg0="daysPerWeek">
              </div>
              <div class="form-group flex-1">
                <label class="form-label" for="ai-target-date">موعد مستهدف (اختياري)</label>
                <input id="ai-target-date" type="date" class="form-control" value="${form.targetDate || ''}" data-action="aiFormInput" data-event="input" data-arg0="targetDate">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="ai-context">ما معرفتك السابقة أو القيود التي ينبغي مراعاتها؟ (اختياري)</label>
              <textarea id="ai-context" class="form-control" rows="2" maxlength="700" placeholder="مثال: أعرف أساسيات Python، وأستخدم هاتفًا فقط حاليًا." data-action="aiFormInput" data-event="input" data-arg0="context">${form.context || ''}</textarea>
            </div>
            <button type="button" class="btn btn-primary" data-action="generateAiPlan" ${(hasKey && !requesting) ? '' : 'disabled'}>
              ${UI.getIcon('brain')} ${requesting ? 'جارٍ إنشاء الخطة…' : (draft ? 'إنشاء اقتراح جديد' : 'أنشئ خطة بالذكاء الاصطناعي')}
            </button>
            ${!hasKey ? h`<span class="form-hint ai-key-hint">اذهب إلى الإعدادات وأضف مفتاح Gemini API لتفعيل الإنشاء.</span>` : ''}
          </div>
        </div>

        ${draft ? h`
          <section class="ai-preview-section" aria-labelledby="ai-preview-title">
            <div class="ai-preview-heading">
              <div><h2 id="ai-preview-title" class="sub-heading">راجع الخطة وعدّلها قبل الحفظ</h2><p class="text-muted">${draft.stages.length} مراحل • ${taskCount} مهام تقريبًا. يمكنك تعديل العناوين والأوصاف والأولويات والوقت.</p></div>
              <div class="ai-preview-actions">
                <button type="button" class="btn btn-outline" data-action="discardAiPlan">إلغاء الاقتراح</button>
                <button type="button" class="btn btn-primary" data-action="acceptAiPlan">حفظ الخطة في مجالات التعلم</button>
              </div>
            </div>
            <div class="card ai-domain-preview">
              <div class="card-body">
                <div class="form-group">
                  <label class="form-label" for="ai-draft-domainName">اسم المجال</label>
                  <input id="ai-draft-domainName" class="form-control" maxlength="120" data-action="editAiPlanField" data-event="input" data-arg0="domainName" value="${draft.domainName}">
                </div>
                <div class="form-group">
                  <label class="form-label" for="ai-draft-targetGoal">الهدف النهائي</label>
                  <textarea id="ai-draft-targetGoal" class="form-control" rows="2" maxlength="1000" data-action="editAiPlanField" data-event="input" data-arg0="targetGoal">${draft.targetGoal}</textarea>
                </div>
                <p class="text-muted">المستوى: ${draft.currentLevel} ← ${draft.targetLevel}${draft.targetDate ? ` • الموعد: ${draft.targetDate}` : ''}</p>
              </div>
            </div>
            ${draft.stages.map((stage, stageIndex) => h`
              <article class="card ai-stage-preview">
                <div class="card-header ai-stage-header">
                  <div class="form-group ai-stage-title-group">
                    <label class="form-label" for="ai-stage-title-${stageIndex}">المرحلة ${stageIndex + 1}</label>
                    <input id="ai-stage-title-${stageIndex}" class="form-control" maxlength="140" data-action="editAiStageField" data-event="input" data-arg0="${stageIndex}" data-arg1="title" value="${stage.title}">
                  </div>
                  <button type="button" class="btn btn-danger-outline btn-sm" data-action="removeAiStage" data-arg0="${stageIndex}" aria-label="حذف المرحلة ${stageIndex + 1}">حذف المرحلة</button>
                </div>
                <div class="card-body">
                  <label class="form-label" for="ai-stage-desc-${stageIndex}">وصف المرحلة</label>
                  <textarea id="ai-stage-desc-${stageIndex}" class="form-control" rows="2" maxlength="800" data-action="editAiStageField" data-event="input" data-arg0="${stageIndex}" data-arg1="description">${stage.description}</textarea>
                  <div class="ai-task-list">
                    ${stage.tasks.map((task, taskIndex) => h`
                      <div class="ai-task-edit-row">
                        <div class="form-group ai-task-main">
                          <label class="form-label" for="ai-task-title-${stageIndex}-${taskIndex}">المهمة ${taskIndex + 1}</label>
                          <input id="ai-task-title-${stageIndex}-${taskIndex}" class="form-control" maxlength="160" data-action="editAiTaskField" data-event="input" data-arg0="${stageIndex}" data-arg1="${taskIndex}" data-arg2="title" value="${task.title}">
                          <textarea class="form-control ai-task-description" rows="2" maxlength="800" aria-label="وصف المهمة ${taskIndex + 1}" data-action="editAiTaskField" data-event="input" data-arg0="${stageIndex}" data-arg1="${taskIndex}" data-arg2="description">${task.description}</textarea>
                        </div>
                        <div class="ai-task-meta">
                          <label class="form-label" for="ai-task-priority-${stageIndex}-${taskIndex}">الأولوية</label>
                          <select id="ai-task-priority-${stageIndex}-${taskIndex}" class="form-control" data-action="editAiTaskField" data-event="change" data-arg0="${stageIndex}" data-arg1="${taskIndex}" data-arg2="priority">
                            <option value="urgent" ${task.priority === 'urgent' ? 'selected' : ''}>عاجل جدًا</option>
                            <option value="high" ${task.priority === 'high' ? 'selected' : ''}>مرتفع</option>
                            <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>متوسط</option>
                            <option value="low" ${task.priority === 'low' ? 'selected' : ''}>منخفض</option>
                          </select>
                          <label class="form-label" for="ai-task-hours-${stageIndex}-${taskIndex}">الساعات</label>
                          <input id="ai-task-hours-${stageIndex}-${taskIndex}" type="number" min="0.25" max="40" step="0.25" class="form-control" data-action="editAiTaskField" data-event="change" data-arg0="${stageIndex}" data-arg1="${taskIndex}" data-arg2="estimatedHours" value="${task.estimatedHours}">
                          <label class="form-label" for="ai-task-date-${stageIndex}-${taskIndex}">تاريخ الاستحقاق (اختياري)</label>
                          <input id="ai-task-date-${stageIndex}-${taskIndex}" type="date" class="form-control" data-action="editAiTaskField" data-event="change" data-arg0="${stageIndex}" data-arg1="${taskIndex}" data-arg2="dueDate" value="${task.dueDate}">
                          <button type="button" class="btn btn-outline btn-sm" data-action="removeAiTask" data-arg0="${stageIndex}" data-arg1="${taskIndex}">حذف</button>
                        </div>
                      </div>
                    `)}
                    <button type="button" class="btn btn-outline btn-sm" data-action="addAiTask" data-arg0="${stageIndex}">+ إضافة مهمة</button>
                  </div>
                </div>
              </article>
            `)}
            <button type="button" class="btn btn-outline" data-action="addAiStage">+ إضافة مرحلة</button>
            <p class="text-muted ai-disclaimer">لن تُحفظ الخطة إلا عند الضغط على «حفظ الخطة». راجع ملاءمة المحتوى والتواريخ قبل الاعتماد.</p>
          </section>
        ` : ''}
      `;
    },

    syncStatusText(st, config) {
      if (!config.configured) return 'لم يتم إعداد المزامنة بعد. أدخل معرّف العميل أولًا.';
      const when = config.lastSyncAt ? ` آخر مزامنة: ${new Date(config.lastSyncAt).toLocaleString('ar-EG')}.` : '';
      switch (st.status) {
        case 'syncing': return 'جارٍ المزامنة…';
        case 'conflict': return 'يوجد تعارض بين بيانات هذا الجهاز وبيانات السحابة. اضغط على شارة المزامنة في الأعلى لحله.';
        case 'error': return `تعذرت المزامنة: ${st.error}${when}`;
        case 'needs-auth': return `غير متصل حاليًا. اضغط «اتصال ومزامنة».${st.error ? ' ' + st.error : ''}${when}`;
        case 'idle': return `متصل ومتزامن.${when}`;
        default: return 'المزامنة متوقفة.' + when;
      }
    },

    renderSettings(container) {
      const settings = LearningStore.getSettings();
      const syncConfig = CloudSync.getConfig();

      container.innerHTML = h`
        <div class="view-header">
          <div>
            <h1 class="page-title">إدارة البيانات والإعدادات</h1>
            <p class="page-subtitle">إدارة المظهر والمزامنة والنسخ الاحتياطية والذكاء الاصطناعي.</p>
          </div>
        </div>

        <div class="settings-grid">
          <!-- User Profile & Theme Settings -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">${UI.getIcon('settings')} تفضيلات المستخدم والمظهر</h3>
            </div>
            <div class="card-body">
              <div class="form-group">
                <label class="form-label">اسم المتعلم</label>
                <input type="text" id="setting-user-name" class="form-control" value="${settings.userName || ''}">
              </div>

              <div class="form-group">
                <label class="form-label">إجمالي ساعات التعلم التقديرية</label>
                <input type="number" id="setting-hours" class="form-control" value="${settings.studyHoursTracked || 0}" step="0.5">
                <span class="form-hint">تُضاف جلسات التركيز المكتملة تلقائياً.</span>
              </div>

              <div class="form-group">
                <label class="form-label">السمة والمظهر</label>
                <div class="theme-options">
                  <button type="button" class="btn ${settings.theme === 'light' ? 'btn-primary' : 'btn-outline'}" data-action="setTheme" data-arg0="light">
                    ${UI.getIcon('sun')} الوضع الفاتح
                  </button>
                  <button type="button" class="btn ${settings.theme === 'dark' ? 'btn-primary' : 'btn-outline'}" data-action="setTheme" data-arg0="dark">
                    ${UI.getIcon('moon')} الوضع الداكن
                  </button>
                </div>
              </div>

              <button class="btn btn-primary" data-action="saveGeneralSettings">حفظ التعديلات</button>
            </div>
          </div>

          <div class="card" id="cloud-sync-card">
            <div class="card-header">
              <h3 class="card-title">☁ المزامنة السحابية (Google Drive)</h3>
            </div>
            <div class="card-body">
              <p class="text-muted mb-3">زامن بيانات التعلم بين أجهزتك عبر Google Drive.</p>
              ${location.protocol === 'file:' ? h`<p class="form-hint sync-warning" role="alert">أنت تفتح الملف مباشرة من الجهاز (file://). تسجيل الدخول بـ Google يحتاج أن يعمل الموقع من عنوان https (مثل GitHub Pages) أو من http://localhost.</p>` : ''}
              <details class="sync-setup">
                <summary>خطوات الإعداد لمرة واحدة</summary>
                <ol>
                  <li>افتح <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener noreferrer">Google Cloud Console</a> وأنشئ مشروعًا جديدًا.</li>
                  <li>من «APIs &amp; Services ← Library» فعّل <strong>Google Drive API</strong>.</li>
                  <li>من «OAuth consent screen»: اختر <strong>External</strong>، واكتب اسم التطبيق وبريدك، ثم أضف بريدك في «Test users».</li>
                  <li>من «Credentials ← Create credentials ← OAuth client ID»: النوع <strong>Web application</strong>، وفي «Authorized JavaScript origins» أضف عنوان موقعك: <code dir="ltr">${location.origin === 'null' ? '(عنوان موقعك)' : location.origin}</code></li>
                  <li>انسخ «Client ID» وألصقه أدناه، ثم اضغط «حفظ المعرّف» وبعده «اتصال ومزامنة».</li>
                </ol>
                <p class="form-hint">سيعرض Google تحذير «تطبيق غير موثّق» لأنك المطوّر والمستخدم الوحيد؛ هذا طبيعي للاستخدام الشخصي.</p>
              </details>
              <div class="form-group">
                <label class="form-label" for="sync-client-id">معرّف عميل Google (Client ID)</label>
                <input type="text" id="sync-client-id" class="form-control" dir="ltr" autocomplete="off" spellcheck="false" placeholder="123456789-abc.apps.googleusercontent.com" value="${syncConfig.clientId}">
              </div>
              <p id="sync-status-text" class="form-hint" role="status">${Views.syncStatusText(CloudSync.getState(), syncConfig)}</p>
              <div class="backup-actions">
                <button type="button" class="btn btn-outline" data-action="saveSyncClientId">حفظ المعرّف</button>
                ${syncConfig.configured ? h`
                  <button type="button" class="btn btn-primary" data-action="syncNowCloud">${syncConfig.connected ? 'مزامنة الآن' : 'اتصال ومزامنة'}</button>
                  <button type="button" class="btn btn-outline" data-action="disconnectCloudSync">إيقاف المزامنة على هذا الجهاز</button>` : ''}
              </div>
              <p class="form-hint mt-3">قد يُطلب تسجيل الدخول مجدداً. لن تُحذف بيانات عند تعارض المزامنة دون موافقتك.</p>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title">${UI.getIcon('brain')} إعداد Gemini API</h3>
            </div>
            <div class="card-body">
              <p class="text-muted mb-3">أدخل مفتاح API لإنشاء الخطط. يُحفظ على هذا الجهاز ولا يدخل في النسخ الاحتياطية.</p>
              <div class="form-group">
                <label class="form-label" for="setting-gemini-api-key">مفتاح Gemini API</label>
                <input type="password" id="setting-gemini-api-key" class="form-control" autocomplete="new-password" autocapitalize="off" spellcheck="false" placeholder="ألصق المفتاح هنا">
                <span class="form-hint" role="status">${window.GeminiAssistant.hasKey() ? 'يوجد مفتاح محفوظ في هذا المتصفح.' : 'لا يوجد مفتاح محفوظ حتى الآن.'}</span>
              </div>
              <div class="form-group">
                <label class="form-label" for="setting-gemini-model">اسم النموذج</label>
                <input type="text" id="setting-gemini-model" class="form-control" list="gemini-model-list" dir="ltr" autocomplete="off" spellcheck="false" value="${window.GeminiAssistant.model}" placeholder="${window.GeminiAssistant.defaultModel}">
                <datalist id="gemini-model-list">${window.GeminiAssistant.modelSuggestions.map(m => h`<option value="${m}"></option>`)}</datalist>
                <span class="form-hint">النموذج الافتراضي: gemini-3.5-flash-lite.</span>
              </div>
              <div class="backup-actions">
                <button type="button" class="btn btn-primary" data-action="saveGeminiKey">حفظ الإعدادات على هذا الجهاز</button>
                ${window.GeminiAssistant.hasKey() ? h`<button type="button" class="btn btn-outline" data-action="testGeminiConnection">اختبار الاتصال</button>` : ''}
                ${window.GeminiAssistant.hasKey() ? h`<button type="button" class="btn btn-outline" data-action="removeGeminiKey">حذف المفتاح المحفوظ</button>` : ''}
              </div>
              <p class="form-hint mt-3">لا تشارك المفتاح أو تضعه داخل ملفات المشروع.</p>
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">إنشاء أو إدارة مفتاح Gemini في Google AI Studio</a>
            </div>
          </div>

          <!-- Backup & Data Portability -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">${UI.getIcon('download')} النسخ الاحتياطي ونقل البيانات</h3>
            </div>
            <div class="card-body">
              <p class="text-muted mb-3">صدّر بياناتك أو استورد نسخة احتياطية بصيغة JSON.</p>

              <div class="backup-actions">
                <button class="btn btn-outline" data-action="exportBackup">
                  ${UI.getIcon('download')} تصدير نسخة احتياطية (JSON)
                </button>

                <label class="btn btn-outline cursor-pointer">
                  ${UI.getIcon('upload')} استيراد نسخة من ملف
                  <input type="file" id="import-file-input" class="sr-only" accept=".json,application/json" data-action="importBackup" data-event="change">
                </label>
              </div>

              <hr class="divider">

              <h4 class="sub-heading text-danger">إعادة ضبط البيانات</h4>
              <p class="text-muted mb-3">إجراءات نهائية؛ تأكد من وجود نسخة احتياطية أولاً.</p>

              <div class="reset-buttons">
                <button class="btn btn-outline" data-action="resetWithSampleData">
                  ${UI.getIcon('refresh')} استعادة البيانات التجريبية
                </button>
                <button class="btn btn-danger-outline" data-action="clearAllData">
                  ${UI.getIcon('trash')} مسح كافة البيانات
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  };

  window.Views = Views;

})(window);
