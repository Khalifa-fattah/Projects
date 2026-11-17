/**
 * تطبيق وِرد | Wird
 * عرض الصفحة الرئيسية (لوحة التحكم والإحصائيات والوصول السريع)
 */

import { AzkarService } from '../../services/azkar-service.js';
import { ReviewService } from '../../services/review-service.js';
import { renderIcon } from '../icons.js';
import { UIComponents } from '../components.js';

export class HomeView {
  static async render(container, navigateTo) {
    container.innerHTML = `
      <div class="view-loading">
        <div class="spinner"></div>
        <p>جاري تحميل لوحة التحكم...</p>
      </div>
    `;

    const stats = await ReviewService.getReviewStats();
    const collections = await AzkarService.getCollections();

    // العثور على المجموعات الأكثر استخداماً
    const morningCol = collections.find(c => c.id === 'morning') || { count: 0 };
    const eveningCol = collections.find(c => c.id === 'evening') || { count: 0 };
    const sleepCol = collections.find(c => c.id === 'sleep') || { count: 0 };
    const wakeCol = collections.find(c => c.id === 'wake') || { count: 0 };

    // تنسيق آخر نشاط
    let lastActivityText = 'لا يوجد نشاط مسجل بعد. ابدأ اليوم بحفظ أو قراءة وردك!';
    if (stats.lastActivity) {
      const date = new Date(stats.lastActivity.evaluatedAt);
      const timeStr = date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
      const dateStr = date.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
      
      let ratingLabel = 'مراجعة مكتملة';
      if (stats.lastActivity.rating === 'mastered') ratingLabel = 'أتقنت الحفظ';
      if (stats.lastActivity.rating === 'hard') ratingLabel = 'تذكرت بصعوبة';
      if (stats.lastActivity.rating === 'forgot') ratingLabel = 'إعادة مراجعة';

      lastActivityText = `آخر مراجعة: ${ratingLabel} (${dateStr}، ${timeStr})`;
    }

    container.innerHTML = `
      <div class="home-view fade-in">
        <!-- الترحيب ورأس الصفحة -->
        <header class="home-header">
          <div class="welcome-badge">
            <span class="app-chip">وِردك اليومي</span>
          </div>
          <h1 class="home-greeting">مرحباً بك في «وِرد»</h1>
          <p class="home-subtext">ألا بذكر الله تطمئن القلوب. رتّب أورادك، احفظها بهدوء، وثبّتها بالمراجعة المنظمة.</p>
        </header>

        <!-- بطاقات الوصول السريع للأوراد اليومية -->
        <section class="quick-access-section">
          <h2 class="section-title">
            <span>الوصول السريع للأوراد</span>
          </h2>
          <div class="quick-grid">
            <div class="quick-card morning-card" id="btn-quick-morning">
              <div class="quick-card-icon">${renderIcon('sun')}</div>
              <div class="quick-card-info">
                <h3>أذكار الصباح</h3>
                <span class="card-count">${morningCol.count} ذكراً موثقاً</span>
              </div>
              <div class="card-arrow">${renderIcon('arrowLeft')}</div>
            </div>

            <div class="quick-card evening-card" id="btn-quick-evening">
              <div class="quick-card-icon">${renderIcon('moon')}</div>
              <div class="quick-card-info">
                <h3>أذكار المساء</h3>
                <span class="card-count">${eveningCol.count} ذكراً موثقاً</span>
              </div>
              <div class="card-arrow">${renderIcon('arrowLeft')}</div>
            </div>

            <div class="quick-card sleep-card" id="btn-quick-sleep">
              <div class="quick-card-icon">${renderIcon('bed')}</div>
              <div class="quick-card-info">
                <h3>أذكار النوم</h3>
                <span class="card-count">${sleepCol.count} أذكار</span>
              </div>
              <div class="card-arrow">${renderIcon('arrowLeft')}</div>
            </div>

            <div class="quick-card wake-card" id="btn-quick-wake">
              <div class="quick-card-icon">${renderIcon('sunrise')}</div>
              <div class="quick-card-info">
                <h3>أذكار الاستيقاظ</h3>
                <span class="card-count">${wakeCol.count} أذكار</span>
              </div>
              <div class="card-arrow">${renderIcon('arrowLeft')}</div>
            </div>
          </div>
        </section>

        <!-- إحصائيات الحفظ والتقدم الحقيقية المحسوبة -->
        <section class="stats-section">
          <div class="section-header-row">
            <h2 class="section-title">إحصائيات تقدمك</h2>
            <button class="btn-text" id="btn-goto-review">جلسة المراجعة ${renderIcon('arrowLeft')}</button>
          </div>

          <div class="stats-grid">
            <div class="stat-card ${stats.dueCount > 0 ? 'stat-alert' : ''}" id="stat-due-card">
              <div class="stat-number">${UIComponents.toArabicNumerals(stats.dueCount)}</div>
              <div class="stat-label">مستحقة للمراجعة اليوم</div>
              <div class="stat-sub">${stats.dueCount > 0 ? 'لديك أذكار تحتاج تثبيتاً' : 'أتممت مراجعات اليوم!'}</div>
            </div>

            <div class="stat-card" id="stat-started-card">
              <div class="stat-number">${UIComponents.toArabicNumerals(stats.startedCount)}</div>
              <div class="stat-label">أذكار بدأت حفظها</div>
              <div class="stat-sub">في مراحل الحفظ والتعلم</div>
            </div>

            <div class="stat-card" id="stat-mastered-card">
              <div class="stat-number text-success">${UIComponents.toArabicNumerals(stats.masteredCount)}</div>
              <div class="stat-label">أذكار أتقنت حفظها</div>
              <div class="stat-sub">تقييم ذاتي متقن</div>
            </div>

            <div class="stat-card">
              <div class="stat-number">${UIComponents.toArabicNumerals(stats.totalReviewsCompleted)}</div>
              <div class="stat-label">إجمالي جلسات المراجعة</div>
              <div class="stat-sub">مراجعة مكتملة ومسجلة</div>
            </div>
          </div>
        </section>

        <!-- آخر نشاط وتوجيه -->
        <section class="activity-section">
          <div class="activity-card">
            <div class="activity-icon">${renderIcon('sparkles')}</div>
            <div class="activity-content">
              <h4>سجل النشاط والتقدم</h4>
              <p>${UIComponents.escapeHTML(lastActivityText)}</p>
            </div>
          </div>
        </section>

        <!-- تذكير بطبيعة التقييم -->
        <div class="guidance-box">
          <span class="guidance-icon">${renderIcon('info')}</span>
          <p>تطبيق «وِرد» يعمل محلياً بالكامل دون اتصال بالإنترنت، ونظام المراجعة المتباعدة هو أداة عون ذاتية لتنظيم أوقات تكرارك.</p>
        </div>
      </div>
    `;

    // ربط الأحداث
    container.querySelector('#btn-quick-morning').addEventListener('click', () => {
      navigateTo('library', { collectionId: 'morning' });
    });
    container.querySelector('#btn-quick-evening').addEventListener('click', () => {
      navigateTo('library', { collectionId: 'evening' });
    });
    container.querySelector('#btn-quick-sleep').addEventListener('click', () => {
      navigateTo('library', { collectionId: 'sleep' });
    });
    container.querySelector('#btn-quick-wake').addEventListener('click', () => {
      navigateTo('library', { collectionId: 'wake' });
    });

    container.querySelector('#btn-goto-review').addEventListener('click', () => {
      navigateTo('review');
    });

    if (container.querySelector('#stat-due-card')) {
      container.querySelector('#stat-due-card').addEventListener('click', () => {
        navigateTo('review');
      });
    }
  }
}
