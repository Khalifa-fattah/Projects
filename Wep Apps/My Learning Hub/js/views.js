// views.js - Rendering Logic for All Sections
(function(window) {
  'use strict';

  const Views = {
    // ---------------- 1. DASHBOARD VIEW ---------------- //
    renderDashboard(container) {
      const stats = LearningStore.getAnalytics();
      const settings = LearningStore.getSettings();
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayTasks = LearningStore.getDailyTasks(todayStr);

      container.innerHTML = `
        <div class="view-header">
          <div class="greeting-box">
            <h1 class="page-title">مرحباً بك، ${settings.userName || 'متعلم'} 👋</h1>
            <p class="page-subtitle">رحلتك التعليمية مستمرة، إليك ملخص لأدائك وإنجازاتك اليوم.</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-primary" onclick="App.navigate('daily')">
              ${UI.getIcon('daily')} خطة اليوم (${stats.dailyDone}/${stats.dailyTotal})
            </button>
            <button class="btn btn-outline" onclick="App.openNewDomainModal()">
              ${UI.getIcon('plus')} مجال جديد
            </button>
          </div>
        </div>

        <!-- Metric KPI Cards -->
        <div class="stats-grid">
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

        <!-- Main Dashboard Split Sections -->
        <div class="dashboard-grid">
          <!-- Left Column: Progress by Domain & Charts -->
          <div class="dashboard-col">
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">${UI.getIcon('chart')} تقدم المجالات التعليمية</h3>
                <button class="btn-text" onclick="App.navigate('domains')">عرض الكل</button>
              </div>
              <div class="card-body">
                ${stats.domainStats.length === 0 ? `
                  <div class="empty-state">
                    <p>لا توجد مجالات تعليمية حالياً. ابدأ بإنشاء أول مجال تعليمي لك!</p>
                    <button class="btn btn-primary btn-sm" onclick="App.openNewDomainModal()">+ إضافة مجال</button>
                  </div>
                ` : `
                  <div class="domain-progress-list">
                    ${stats.domainStats.map(d => `
                      <div class="domain-progress-item" onclick="App.openDomain('${d.id}')">
                        <div class="domain-item-header">
                          <span class="domain-name font-bold">
                            <span class="status-dot ${d.status}"></span>
                            ${d.name}
                          </span>
                          <span class="domain-percent">${d.progress}%</span>
                        </div>
                        <div class="progress-bar-bg">
                          <div class="progress-bar-fill" style="width: ${d.progress}%; background-color: ${d.color || '#3B82F6'};"></div>
                        </div>
                        <div class="domain-item-footer text-muted">
                          <span>${d.completedTasks} من ${d.totalTasks} مهمة مكتملة</span>
                          <span>${d.completedStages} من ${d.totalStages} مرحلة</span>
                        </div>
                      </div>
                    `).join('')}
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
                      ${stats.overdueTasks > 0 ? `<span class="badge badge-danger">${stats.overdueTasks} متأخرة</span>` : ''}
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
                <button class="btn btn-outline btn-sm" onclick="App.openAddDailyTaskModal()">+ مهمة</button>
              </div>
              <div class="card-body">
                ${todayTasks.length === 0 ? `
                  <div class="empty-state">
                    <p>لا توجد مهام مجدولة لليوم حتى الآن. ابدأ يومك بإضافة مهمة!</p>
                    <button class="btn btn-outline btn-sm" onclick="App.openAddDailyTaskModal()">+ جدولة مهمة لليوم</button>
                  </div>
                ` : `
                  <div class="task-list">
                    ${todayTasks.map(task => `
                      <div class="task-item ${task.completed ? 'task-done' : ''}">
                        <label class="custom-checkbox">
                          <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="App.toggleDailyTask('${task.id}')">
                          <span class="checkmark"></span>
                        </label>
                        <div class="task-details">
                          <span class="task-title ${task.completed ? 'line-through' : ''}">${task.title}</span>
                          <div class="task-tags">
                            <span class="task-domain-badge" style="border-right-color: ${task.domainColor || '#3B82F6'}">${task.domainName || 'عام'}</span>
                            <span class="priority-tag priority-${task.priority}">${App.getPriorityLabel(task.priority)}</span>
                            ${task.estimatedHours ? `<span class="hours-tag">${task.estimatedHours} س</span>` : ''}
                          </div>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                `}
              </div>
            </div>

            <!-- Activity Log preview -->
            <div class="card mt-4">
              <div class="card-header">
                <h3 class="card-title">${UI.getIcon('award')} سجل النشاط الأخير</h3>
                <button class="btn-text" onclick="App.navigate('stats')">كل السجل</button>
              </div>
              <div class="card-body">
                ${stats.activityLog.length === 0 ? `
                  <p class="text-muted text-center py-4">لا توجد أنشطة مسجلة بعد. عند إنجازك للمهام ستظهر هنا.</p>
                ` : `
                  <div class="timeline">
                    ${stats.activityLog.slice(0, 5).map(act => `
                      <div class="timeline-item">
                        <div class="timeline-dot"></div>
                        <div class="timeline-content">
                          <p class="timeline-text">
                            <strong>${act.title}</strong>
                            ${act.domainName ? `<span class="timeline-domain">(${act.domainName})</span>` : ''}
                          </p>
                          <span class="timeline-time">${UI.timeAgo(act.timestamp)}</span>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                `}
              </div>
            </div>
          </div>
        </div>
      `;
    },

    // ---------------- 2. DOMAINS LIST VIEW ---------------- //
    renderDomains(container, filter = {}) {
      const domains = LearningStore.getDomains(filter);
      const currentFilter = filter.status || 'all';
      const currentSearch = filter.search || '';

      container.innerHTML = `
        <div class="view-header">
          <div>
            <h1 class="page-title">مجالات التعلم والتطوير الذاتي</h1>
            <p class="page-subtitle">نظّم جميع مهاراتك ومساراتك التعليمية مع خطط مرحلية واضحة ومقاسة.</p>
          </div>
          <button class="btn btn-primary" onclick="App.openNewDomainModal()">
            ${UI.getIcon('plus')} إضافة مجال تعليمي جديد
          </button>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="toolbar-card">
          <div class="search-input-wrapper">
            <span class="search-icon">${UI.getIcon('search')}</span>
            <input type="text" id="domain-search-input" class="search-input" placeholder="ابحث في المجالات والأوصاف..." value="${currentSearch}" oninput="App.onDomainSearch(this.value)">
          </div>

          <div class="filter-tabs">
            <button class="filter-tab ${currentFilter === 'all' ? 'active' : ''}" onclick="App.filterDomains('all')">الكل</button>
            <button class="filter-tab ${currentFilter === 'active' ? 'active' : ''}" onclick="App.filterDomains('active')">نشط</button>
            <button class="filter-tab ${currentFilter === 'paused' ? 'active' : ''}" onclick="App.filterDomains('paused')">متوقف مؤقتاً</button>
            <button class="filter-tab ${currentFilter === 'completed' ? 'active' : ''}" onclick="App.filterDomains('completed')">مكتمل</button>
          </div>
        </div>

        <!-- Domains Cards Grid -->
        ${domains.length === 0 ? `
          <div class="card empty-container">
            <div class="empty-state">
              <div class="empty-icon">${UI.getIcon('domains')}</div>
              <h3>لا توجد مجالات تعليمية مطابقة</h3>
              <p>جرّب تغيير عبارة البحث أو إضافة مجال تعليمي جديد لبدء مسار التعلم.</p>
              <button class="btn btn-primary" onclick="App.openNewDomainModal()">
                ${UI.getIcon('plus')} إنشاء أول مجال الآن
              </button>
            </div>
          </div>
        ` : `
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

              return `
                <div class="domain-card" style="border-top: 4px solid ${d.color || '#3B82F6'}">
                  <div class="domain-card-header">
                    <div class="domain-card-title-group" onclick="App.openDomain('${d.id}')">
                      <div class="domain-avatar" style="background-color: ${d.color || '#3B82F6'}15; color: ${d.color || '#3B82F6'}">
                        ${UI.getIcon(d.icon || 'book')}
                      </div>
                      <div>
                        <h3 class="domain-title">${d.name}</h3>
                        <span class="status-pill status-${d.status}">${App.getStatusLabel(d.status)}</span>
                      </div>
                    </div>
                    <div class="dropdown">
                      <button class="btn-icon" onclick="App.toggleDropdown(event, 'menu-${d.id}')">
                        &vellip;
                      </button>
                      <div id="menu-${d.id}" class="dropdown-menu hidden">
                        <button onclick="App.openEditDomainModal('${d.id}')">${UI.getIcon('edit')} تعديل المجال</button>
                        ${d.status === 'active' ? `
                          <button onclick="App.changeDomainStatus('${d.id}', 'paused')">${UI.getIcon('pause')} إيقاف مؤقت</button>
                        ` : `
                          <button onclick="App.changeDomainStatus('${d.id}', 'active')">${UI.getIcon('play')} استئناف التعلم</button>
                        `}
                        <button class="text-danger" onclick="App.deleteDomain('${d.id}')">${UI.getIcon('trash')} حذف المجال</button>
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

                  <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${pct}%; background-color: ${d.color || '#3B82F6'}"></div>
                  </div>

                  <div class="domain-card-footer">
                    <button class="btn btn-outline btn-block" onclick="App.openDomain('${d.id}')">
                      عرض الخطة والمراحل ${UI.getIcon('chevronLeft')}
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      `;
    },

    // ---------------- 3. SINGLE DOMAIN DETAILS VIEW ---------------- //
    renderDomainDetail(container, domainId, activeTab = 'plan') {
      const domain = LearningStore.getDomainById(domainId);
      if (!domain) {
        container.innerHTML = `
          <div class="card empty-container">
            <div class="empty-state">
              <h3>المجال التعليمي غير موجود</h3>
              <p>قد يكون تم حذفه أو تغييره.</p>
              <button class="btn btn-primary" onclick="App.navigate('domains')">العودة إلى المجالات</button>
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

      container.innerHTML = `
        <!-- Domain Details Header -->
        <div class="detail-header-card" style="border-right: 5px solid ${domain.color || '#3B82F6'}">
          <div class="detail-header-top">
            <button class="btn-back" onclick="App.navigate('domains')">
              ${UI.getIcon('chevronRight')} كل المجالات
            </button>
            <div class="detail-actions">
              <button class="btn btn-outline btn-sm" onclick="App.openEditDomainModal('${domain.id}')">
                ${UI.getIcon('edit')} تعديل البيانات
              </button>
              <button class="btn btn-danger-outline btn-sm" onclick="App.deleteDomain('${domain.id}')">
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
              ${domain.targetGoal ? `
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

          <div class="progress-bar-bg mt-3">
            <div class="progress-bar-fill" style="width: ${progressPct}%; background-color: ${domain.color || '#3B82F6'}"></div>
          </div>
        </div>

        <!-- Section Tabs Navigation -->
        <div class="section-tabs">
          <button class="section-tab ${activeTab === 'plan' ? 'active' : ''}" onclick="App.switchDomainTab('${domain.id}', 'plan')">
            ${UI.getIcon('target')} الخطة والمراحل (${domain.stages.length})
          </button>
          <button class="section-tab ${activeTab === 'resources' ? 'active' : ''}" onclick="App.switchDomainTab('${domain.id}', 'resources')">
            ${UI.getIcon('book')} المصادر التعليمية (${domain.resources.length})
          </button>
          <button class="section-tab ${activeTab === 'projects' ? 'active' : ''}" onclick="App.switchDomainTab('${domain.id}', 'projects')">
            ${UI.getIcon('code')} المشاريع التطبيقية (${domain.projects.length})
          </button>
          <button class="section-tab ${activeTab === 'notes' ? 'active' : ''}" onclick="App.switchDomainTab('${domain.id}', 'notes')">
            ${UI.getIcon('edit')} الملاحظات (${domain.notes.length})
          </button>
        </div>

        <!-- Tab Content Area -->
        <div class="tab-content mt-4">
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
        return `
          <div class="card empty-container">
            <div class="empty-state">
              <h3>لم تقم بإضافة مراحل بعد لهذا المجال</h3>
              <p>قسّم خطة تعلمك إلى مراحل متسلسلة (مثل: الأساسيات، التطبيق، المفاهيم المتقدمة).</p>
              <button class="btn btn-primary" onclick="App.openAddStageModal('${domain.id}')">
                ${UI.getIcon('plus')} إضافة أول مرحلة
              </button>
            </div>
          </div>
        `;
      }

      return `
        <div class="stages-header-row mb-3">
          <h2 class="sub-heading">مراحل الخطة التعليمية</h2>
          <button class="btn btn-primary btn-sm" onclick="App.openAddStageModal('${domain.id}')">
            ${UI.getIcon('plus')} إضافة مرحلة جديدة
          </button>
        </div>

        <div class="stages-accordion">
          ${domain.stages.map((stage, sIdx) => {
            const sTotal = stage.tasks.length;
            const sDone = stage.tasks.filter(t => t.status === 'completed').length;
            const sPct = sTotal > 0 ? Math.round((sDone / sTotal) * 100) : 0;

            return `
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
                      <div class="progress-bar-bg mini">
                        <div class="progress-bar-fill" style="width: ${sPct}%; background-color: ${sPct === 100 ? '#10B981' : '#3B82F6'}"></div>
                      </div>
                    </div>

                    <div class="stage-actions">
                      <button class="btn btn-outline btn-sm" onclick="App.openAddTaskModal('${domain.id}', '${stage.id}')" title="إضافة مهمة">
                        ${UI.getIcon('plus')} مهمة
                      </button>
                      <button class="btn-icon" onclick="App.openEditStageModal('${domain.id}', '${stage.id}')" title="تعديل المرحلة">
                        ${UI.getIcon('edit')}
                      </button>
                      <button class="btn-icon text-danger" onclick="App.deleteStage('${domain.id}', '${stage.id}')" title="حذف المرحلة">
                        ${UI.getIcon('trash')}
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Stage Tasks List -->
                <div class="stage-tasks-container">
                  ${stage.tasks.length === 0 ? `
                    <p class="empty-tasks-text">لا توجد مهام في هذه المرحلة بعد. <a href="javascript:void(0)" onclick="App.openAddTaskModal('${domain.id}', '${stage.id}')">أضف مهمة جديدة الآن</a></p>
                  ` : `
                    <div class="tasks-table">
                      ${stage.tasks.map(task => `
                        <div class="task-row ${task.status === 'completed' ? 'task-row-done' : ''}">
                          <div class="task-check-cell">
                            <label class="custom-checkbox">
                              <input type="checkbox" ${task.status === 'completed' ? 'checked' : ''} onchange="App.toggleTask('${domain.id}', '${stage.id}', '${task.id}')">
                              <span class="checkmark"></span>
                            </label>
                          </div>

                          <div class="task-info-cell">
                            <span class="task-name ${task.status === 'completed' ? 'line-through' : ''}">${task.title}</span>
                            ${task.description ? `<p class="task-small-desc">${task.description}</p>` : ''}
                            ${task.notes ? `<p class="task-notes-callout">${task.notes}</p>` : ''}
                            
                            <!-- Task Links if any -->
                            ${task.links && task.links.length > 0 ? `
                              <div class="task-links-list">
                                ${task.links.map(l => `<a href="${l}" target="_blank" rel="noopener">${UI.getIcon('external')} مرجع مرتبط</a>`).join(' ')}
                              </div>
                            ` : ''}
                          </div>

                          <div class="task-badges-cell">
                            <span class="priority-tag priority-${task.priority}">${App.getPriorityLabel(task.priority)}</span>
                            <span class="status-badge status-${task.status}">${App.getTaskStatusLabel(task.status)}</span>
                            ${task.dueDate ? `<span class="due-badge ${task.dueDate < new Date().toISOString().slice(0,10) && task.status !== 'completed' ? 'overdue' : ''}">${UI.getIcon('calendar')} ${task.dueDate}</span>` : ''}
                            ${task.estimatedHours ? `<span class="hours-badge">${task.estimatedHours} س</span>` : ''}
                          </div>

                          <div class="task-actions-cell">
                            <button class="btn-icon" onclick="App.addDomainTaskToDaily('${domain.id}', '${stage.id}', '${task.id}')" title="إضافة لخطة اليوم">
                              ${UI.getIcon('daily')}
                            </button>
                            <button class="btn-icon" onclick="App.openEditTaskModal('${domain.id}', '${stage.id}', '${task.id}')" title="تعديل المهمة">
                              ${UI.getIcon('edit')}
                            </button>
                            <button class="btn-icon text-danger" onclick="App.deleteTask('${domain.id}', '${stage.id}', '${task.id}')" title="حذف المهمة">
                              ${UI.getIcon('trash')}
                            </button>
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    },

    // Resources Tab
    renderResourcesTab(domain) {
      return `
        <div class="tab-header-row mb-3">
          <h2 class="sub-heading">المصادر والدورات والكتب المرجعية</h2>
          <button class="btn btn-primary btn-sm" onclick="App.openAddResourceModal('${domain.id}')">
            ${UI.getIcon('plus')} إضافة مصدر تعليمي
          </button>
        </div>

        ${domain.resources.length === 0 ? `
          <div class="card empty-container">
            <div class="empty-state">
              <h3>لا توجد مصادر تعليمية مضافة</h3>
              <p>احتفظ بروابط الدورات التدريبية، قنوات اليوتيوب، الكتب، والتوثيقات الرسمية هنا.</p>
              <button class="btn btn-primary" onclick="App.openAddResourceModal('${domain.id}')">
                ${UI.getIcon('plus')} إضافة أول مصدر
              </button>
            </div>
          </div>
        ` : `
          <div class="resources-grid">
            ${domain.resources.map(res => `
              <div class="resource-card">
                <div class="resource-top">
                  <span class="resource-type-badge">${App.getResourceTypeLabel(res.type)}</span>
                  <button class="btn-icon text-danger" onclick="App.deleteResource('${domain.id}', '${res.id}')" title="حذف">
                    ${UI.getIcon('trash')}
                  </button>
                </div>
                <h4 class="resource-title">${res.title}</h4>
                <p class="resource-desc text-muted">${res.description || 'لا يوجد وصف مضاف'}</p>
                <div class="resource-footer">
                  <a href="${res.url}" target="_blank" rel="noopener" class="btn btn-outline btn-sm btn-block">
                    فتح الرابط ${UI.getIcon('external')}
                  </a>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      `;
    },

    // Projects Tab
    renderProjectsTab(domain) {
      return `
        <div class="tab-header-row mb-3">
          <h2 class="sub-heading">المشاريع التطبيقية العملية</h2>
          <button class="btn btn-primary btn-sm" onclick="App.openAddProjectModal('${domain.id}')">
            ${UI.getIcon('plus')} إضافة مشروع تطبيقي
          </button>
        </div>

        ${domain.projects.length === 0 ? `
          <div class="card empty-container">
            <div class="empty-state">
              <h3>لا توجد مشاريع عملية مضافة</h3>
              <p>التعلم الحقيقي يبدأ بالتطبيق العملي. خطط لمشروعك الأول لبناء معرض أعمال قوي.</p>
              <button class="btn btn-primary" onclick="App.openAddProjectModal('${domain.id}')">
                ${UI.getIcon('plus')} إضافة أول مشروع
              </button>
            </div>
          </div>
        ` : `
          <div class="projects-grid">
            ${domain.projects.map(proj => `
              <div class="project-card">
                <div class="project-header">
                  <h4 class="project-title">${proj.title}</h4>
                  <span class="status-pill status-${proj.status}">${App.getProjectStatusLabel(proj.status)}</span>
                </div>
                <p class="project-desc">${proj.description || 'لا يوجد وصف تفصيلي'}</p>
                
                ${proj.skills ? `
                  <div class="project-info-row">
                    <strong>المهارات المستهدفة:</strong>
                    <span>${proj.skills}</span>
                  </div>
                ` : ''}

                ${proj.tasksNeeded ? `
                  <div class="project-info-row">
                    <strong>المهام المطلوبة:</strong>
                    <span>${proj.tasksNeeded}</span>
                  </div>
                ` : ''}

                <div class="project-links-row">
                  ${proj.liveUrl ? `<a href="${proj.liveUrl}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">${UI.getIcon('external')} معاينة حية</a>` : ''}
                  ${proj.repoUrl ? `<a href="${proj.repoUrl}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">${UI.getIcon('code')} المستودع البرمجي</a>` : ''}
                  <button class="btn-icon text-danger mr-auto" onclick="App.deleteProject('${domain.id}', '${proj.id}')" title="حذف">${UI.getIcon('trash')}</button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      `;
    },

    // Notes Tab
    renderNotesTab(domain) {
      return `
        <div class="tab-header-row mb-3">
          <h2 class="sub-heading">الملاحظات والاستنتاجات الشخصية</h2>
          <button class="btn btn-primary btn-sm" onclick="App.openAddNoteModal('${domain.id}')">
            ${UI.getIcon('plus')} إضافة ملاحظة
          </button>
        </div>

        ${domain.notes.length === 0 ? `
          <div class="card empty-container">
            <div class="empty-state">
              <h3>لا توجد ملاحظات مدونة</h3>
              <p>دوّن الخلاصة الذهبية لكل كتاب أو دورة، والحلول للمشاكل التقنية التي واجهتك.</p>
              <button class="btn btn-primary" onclick="App.openAddNoteModal('${domain.id}')">
                ${UI.getIcon('plus')} تدوين أول ملاحظة
              </button>
            </div>
          </div>
        ` : `
          <div class="notes-grid">
            ${domain.notes.map(note => `
              <div class="note-card">
                <div class="note-header">
                  <h4 class="note-title">${note.title}</h4>
                  <div class="note-actions">
                    <span class="note-date text-muted">${UI.formatDate(note.updatedAt)}</span>
                    <button class="btn-icon text-danger" onclick="App.deleteNote('${domain.id}', '${note.id}')" title="حذف">
                      ${UI.getIcon('trash')}
                    </button>
                  </div>
                </div>
                <div class="note-body">
                  ${note.content.replace(/\n/g, '<br>')}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      `;
    },

    // ---------------- 4. DAILY PLAN VIEW ---------------- //
    renderDailyPlan(container) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const tasks = LearningStore.getDailyTasks(todayStr);
      const total = tasks.length;
      const done = tasks.filter(t => t.completed).length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;

      container.innerHTML = `
        <div class="view-header">
          <div>
            <h1 class="page-title">خطة اليوم - ${UI.formatDate(todayStr)}</h1>
            <p class="page-subtitle">حدد أولوياتك اليومية وأنجز بتركيز وهدوء دون تشتت.</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-primary" onclick="App.openAddDailyTaskModal()">
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
            <div class="progress-bar-bg">
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
            ${tasks.length === 0 ? `
              <div class="empty-state">
                <div class="empty-icon">${UI.getIcon('daily')}</div>
                <h3>قائمة مهام اليوم فارغة</h3>
                <p>اختر من مهام مجالاتك التعليمية الحالية أو أضف مهمة حرة لليوم.</p>
                <button class="btn btn-primary" onclick="App.openAddDailyTaskModal()">
                  ${UI.getIcon('plus')} جدولة أول مهمة اليوم
                </button>
              </div>
            ` : `
              <div class="daily-tasks-list">
                ${tasks.map(t => `
                  <div class="daily-task-item ${t.completed ? 'daily-done' : ''}">
                    <div class="daily-check-col">
                      <label class="custom-checkbox">
                        <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="App.toggleDailyTask('${t.id}')">
                        <span class="checkmark"></span>
                      </label>
                    </div>

                    <div class="daily-content-col">
                      <span class="daily-task-title ${t.completed ? 'line-through' : ''}">${t.title}</span>
                      <div class="daily-task-tags">
                        <span class="task-domain-badge" style="border-right-color: ${t.domainColor || '#3B82F6'}">${t.domainName || 'مهمة حرة'}</span>
                        <span class="priority-tag priority-${t.priority}">${App.getPriorityLabel(t.priority)}</span>
                        ${t.estimatedHours ? `<span class="hours-tag">${t.estimatedHours} ساعة متوقعة</span>` : ''}
                      </div>
                      ${t.notes ? `<p class="daily-task-notes">${t.notes}</p>` : ''}
                    </div>

                    <div class="daily-actions-col">
                      <button class="btn-icon text-danger" onclick="App.deleteDailyTask('${t.id}')" title="إزالة من خطة اليوم">
                        ${UI.getIcon('trash')}
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      `;
    },

    // ---------------- 5. STATS & ACTIVITY VIEW ---------------- //
    renderStats(container) {
      const stats = LearningStore.getAnalytics();

      container.innerHTML = `
        <div class="view-header">
          <div>
            <h1 class="page-title">سجل التعلم والإحصائيات</h1>
            <p class="page-subtitle">رؤية تفصيلية لتطور أدائك ومعدل إنجاز المهام على مر الوقت.</p>
          </div>
        </div>

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
                  ${stats.domainStats.map(d => `
                    <tr>
                      <td class="font-bold">${d.name}</td>
                      <td><span class="status-pill status-${d.status}">${App.getStatusLabel(d.status)}</span></td>
                      <td>${d.completedTasks}/${d.totalTasks}</td>
                      <td>
                        <div class="progress-cell">
                          <span>${d.progress}%</span>
                          <div class="progress-bar-bg mini">
                            <div class="progress-bar-fill" style="width: ${d.progress}%; background-color: ${d.color || '#3B82F6'}"></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
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
              ${stats.activityLog.length === 0 ? `
                <p class="text-muted text-center py-4">لا توجد أنشطة مسجلة بعد.</p>
              ` : `
                <div class="timeline">
                  ${stats.activityLog.map(act => `
                    <div class="timeline-item">
                      <div class="timeline-dot"></div>
                      <div class="timeline-content">
                        <p class="timeline-text">
                          <strong>${act.title}</strong>
                          ${act.domainName ? `<span class="timeline-domain">(${act.domainName})</span>` : ''}
                        </p>
                        <span class="timeline-time">${UI.formatDate(act.timestamp)} &bull; ${UI.timeAgo(act.timestamp)}</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          </div>
        </div>
      `;
    },

    // ---------------- 6. SETTINGS VIEW ---------------- //
    renderSettings(container) {
      const settings = LearningStore.getSettings();

      container.innerHTML = `
        <div class="view-header">
          <div>
            <h1 class="page-title">إدارة البيانات والإعدادات</h1>
            <p class="page-subtitle">تحكم في حفظ البيانات محلياً، وتصدير واستيراد النسخ الاحتياطية وتخصيص المظهر.</p>
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
                <span class="form-hint">يمكنك زيادة الساعات يدوياً أو تتبعها.</span>
              </div>

              <div class="form-group">
                <label class="form-label">السمة والمظهر</label>
                <div class="theme-options">
                  <button type="button" class="btn ${settings.theme === 'light' ? 'btn-primary' : 'btn-outline'}" onclick="App.setTheme('light')">
                    ${UI.getIcon('sun')} الوضع الفاتح
                  </button>
                  <button type="button" class="btn ${settings.theme === 'dark' ? 'btn-primary' : 'btn-outline'}" onclick="App.setTheme('dark')">
                    ${UI.getIcon('moon')} الوضع الداكن
                  </button>
                </div>
              </div>

              <button class="btn btn-primary" onclick="App.saveGeneralSettings()">حفظ التعديلات</button>
            </div>
          </div>

          <!-- Backup & Data Portability -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">${UI.getIcon('download')} النسخ الاحتياطي ونقل البيانات</h3>
            </div>
            <div class="card-body">
              <p class="text-muted mb-3">جميع بياناتك محفوظة في متصفحك (LocalStorage). يمكنك تحميل نسخة JSON احتياطية للاحتفاظ بها أو نقلها لجهاز آخر.</p>

              <div class="backup-actions">
                <button class="btn btn-outline" onclick="App.exportBackup()">
                  ${UI.getIcon('download')} تصدير نسخة احتياطية (JSON)
                </button>

                <label class="btn btn-outline cursor-pointer">
                  ${UI.getIcon('upload')} استيراد نسخة من ملف
                  <input type="file" id="import-file-input" accept=".json" style="display: none;" onchange="App.importBackup(event)">
                </label>
              </div>

              <hr class="divider">

              <h4 class="sub-heading text-danger">إعادة ضبط البيانات</h4>
              <p class="text-muted mb-3">يمكنك إعادة تعيين البيانات للوضع الافتراضي مع بيانات تجريبية استرشادية، أو تفريغ البيانات بالكامل.</p>

              <div class="reset-buttons">
                <button class="btn btn-outline" onclick="App.resetWithSampleData()">
                  ${UI.getIcon('refresh')} استعادة البيانات التجريبية
                </button>
                <button class="btn btn-danger-outline" onclick="App.clearAllData()">
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
