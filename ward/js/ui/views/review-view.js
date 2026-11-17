/**
 * تطبيق وِرد | Wird
 * واجهة المراجعة المتباعدة المنظمة وجدولة الأذكار المستحقة
 */

import { ReviewService } from '../../services/review-service.js';
import { AzkarService } from '../../services/azkar-service.js';
import { renderIcon } from '../icons.js';
import { UIComponents } from '../components.js';

export class ReviewView {
  static async render(container, navigateTo, params = {}) {
    let isSessionActive = false;
    let sessionQueue = [];
    let sessionCurrentIndex = 0;
    let inSessionRetryQueue = []; // طابور إعادة المراجعة بعد 10 دقائق (لم أتذكر)
    let isAnswerVisibleInSession = false;

    const renderMain = async () => {
      container.innerHTML = `
        <div class="view-loading">
          <div class="spinner"></div>
          <p>جاري تحميل المراجعات المستحقة...</p>
        </div>
      `;

      const stats = await ReviewService.getReviewStats();
      const dueSchedules = await ReviewService.getDueReviews();

      // جلب بيانات الأذكار المستحقة
      const dueItemsWithData = [];
      for (const sch of dueSchedules) {
        const item = await AzkarService.getZikrById(sch.itemId);
        if (item) {
          dueItemsWithData.push({ ...item, schedule: sch });
        }
      }

      container.innerHTML = `
        <div class="review-view fade-in">
          <header class="view-header">
            <h1 class="view-title">المراجعة المتباعدة</h1>
            <p class="view-subtitle">تثبيت الأذكار في الذاكرة عبر فترات متباعدة تتسع مع إتقان الحفظ</p>
          </header>

          <!-- بطاقة بدء الجلسة المنظمة -->
          <div class="review-hero-card ${dueItemsWithData.length > 0 ? 'has-due' : 'no-due'}">
            <div class="hero-content">
              <span class="hero-chip">جلسة اليوم</span>
              <h2>${dueItemsWithData.length > 0 ? `لديك ${UIComponents.toArabicNumerals(dueItemsWithData.length)} أذكار مستحقة للمراجعة الآن` : 'جميع أذكارك مراجعة ومحدثة اليوم!'}</h2>
              <p>${dueItemsWithData.length > 0 ? 'المراجعة المنتظمة تثبّت الأوراد في الصدر وتمنع نسيانها.' : 'تقبل الله طاعتك. يمكنك تصفح المكتبة أو إضافة أذكار جديدة لحفظها.'}</p>
            </div>
            ${dueItemsWithData.length > 0 ? `
              <button class="btn btn-primary btn-lg" id="btn-start-session">
                ${renderIcon('play')} بدء جلسة المراجعة المنظمة
              </button>
            ` : `
              <button class="btn btn-outline" id="btn-explore-library">
                ${renderIcon('bookOpen')} تصفح المكتبة
              </button>
            `}
          </div>

          <!-- ملخص الإحصائيات -->
          <div class="review-stats-bar">
            <div class="r-stat">
              <span class="r-stat-val">${UIComponents.toArabicNumerals(stats.dueCount)}</span>
              <span class="r-stat-lbl">مستحقة اليوم</span>
            </div>
            <div class="r-stat">
              <span class="r-stat-val text-success">${UIComponents.toArabicNumerals(stats.masteredCount)}</span>
              <span class="r-stat-lbl">أذكار أتقنتها</span>
            </div>
            <div class="r-stat">
              <span class="r-stat-val">${UIComponents.toArabicNumerals(stats.totalReviewsCompleted)}</span>
              <span class="r-stat-lbl">مراجعات مكتملة</span>
            </div>
          </div>

          <!-- قائمة الأذكار المستحقة للمراجعة -->
          <section class="due-list-section">
            <h3 class="section-heading">قائمة الأذكار المستحقة</h3>

            ${dueItemsWithData.length === 0 ? `
              <div class="empty-state">
                <span class="empty-icon">${renderIcon('check')}</span>
                <p>لا توجد أذكار متأخرة أو مستحقة اليوم. أحسنت!</p>
              </div>
            ` : `
              <div class="due-items-grid">
                ${dueItemsWithData.map(item => `
                  <div class="due-card" data-id="${item.id}">
                    <div class="due-card-head">
                      <h4>${UIComponents.escapeHTML(item.title)}</h4>
                      <span class="due-interval-badge">فاصل: ${UIComponents.toArabicNumerals(item.schedule.intervalDays)} يوم</span>
                    </div>

                    <div class="due-card-text font-arabic">
                      ${UIComponents.escapeHTML(item.text.slice(0, 100))}${item.text.length > 100 ? '...' : ''}
                    </div>

                    <div class="due-card-actions">
                      <button class="btn btn-primary btn-sm btn-quick-rev" data-id="${item.id}">
                        مراجعة الآن
                      </button>
                      <button class="btn btn-outline btn-sm btn-postpone" data-id="${item.id}" title="تأجيل يوم واحد">
                        تأجيل +1 يوم
                      </button>
                      <button class="btn btn-secondary btn-sm btn-edit-date" data-id="${item.id}" title="تحديد موعد">
                        ${renderIcon('calendar')}
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </section>

          <!-- شرح شفاف ومفصل لخوارزمية المراجعة المتباعدة -->
          <section class="algorithm-info-card">
            <h3 class="info-title">
              <span>${renderIcon('info')}</span>
              <span>قواعد خوارزمية التكرار المتباعد في تطبيق «وِرد»</span>
            </h3>
            <ul class="algo-rules-list">
              <li><strong>لم أتذكر:</strong> يُعاد الذكر بعد 10 دقائق في الجلسة أو يُدرج للمراجعة في الغد ويعود لمرحلة التعلم.</li>
              <li><strong>تذكرت بصعوبة:</strong> أول مراجعة بعد يوم، ثم يتضاعف الفاصل بمقدار 1.5× مع التقريب لأيام كاملة.</li>
              <li><strong>أتقنت الحفظ:</strong> أول مراجعة بعد يومين، ثم يتضاعف الفاصل بمقدار 2.0×.</li>
              <li><strong>الحد الأقصى للفاصل:</strong> 90 يوماً لضمان دوام العهد بالذكر وثباته.</li>
            </ul>
            <div class="algo-footer-note">
              * التقييم ذاتي محض، والنظام أداة برمجية مساعدة وليس ضماناً مستقلاً لإتقان الحفظ.
            </div>
          </section>
        </div>
      `;

      // ربط الأحداث
      const startBtn = container.querySelector('#btn-start-session');
      if (startBtn) {
        startBtn.addEventListener('click', () => {
          sessionQueue = [...dueItemsWithData];
          sessionCurrentIndex = 0;
          inSessionRetryQueue = [];
          isSessionActive = true;
          isAnswerVisibleInSession = false;
          renderSessionMode();
        });
      }

      const exploreBtn = container.querySelector('#btn-explore-library');
      if (exploreBtn) {
        exploreBtn.addEventListener('click', () => navigateTo('library'));
      }

      container.querySelectorAll('.btn-quick-rev').forEach(btn => {
        btn.addEventListener('click', () => {
          const item = dueItemsWithData.find(i => i.id === btn.dataset.id);
          if (item) {
            sessionQueue = [item];
            sessionCurrentIndex = 0;
            inSessionRetryQueue = [];
            isSessionActive = true;
            isAnswerVisibleInSession = false;
            renderSessionMode();
          }
        });
      });

      container.querySelectorAll('.btn-postpone').forEach(btn => {
        btn.addEventListener('click', async () => {
          await ReviewService.postponeReview(btn.dataset.id, 1);
          UIComponents.showToast('تم تأجيل المراجعة يوماً واحداً.', 'info');
          renderMain();
        });
      });

      container.querySelectorAll('.btn-edit-date').forEach(btn => {
        btn.addEventListener('click', async () => {
          const daysStr = prompt('حدد عدد الأيام حتى الموعد القادم للمراجعة (مثال: 3):', '1');
          if (daysStr) {
            const days = parseInt(daysStr, 10);
            if (!isNaN(days) && days > 0) {
              const targetTimestamp = Date.now() + (days * 24 * 60 * 60 * 1000);
              await ReviewService.setManualReviewDate(btn.dataset.id, targetTimestamp);
              UIComponents.showToast(`تم تعيين موعد المراجعة بعد ${days} أيام.`, 'success');
              renderMain();
            }
          }
        });
      });
    };

    /**
     * واجهة جلسة المراجعة المنظمة خطوة بخطوة
     */
    const renderSessionMode = () => {
      // إذا فرغ الطابور الأساسي ولكن هناك عناصر في طابور الإعادة بعد 10 دقائق
      if (sessionCurrentIndex >= sessionQueue.length) {
        if (inSessionRetryQueue.length > 0) {
          sessionQueue = [...inSessionRetryQueue];
          inSessionRetryQueue = [];
          sessionCurrentIndex = 0;
          UIComponents.showToast('بدء جولة الأذكار المستحقة للإعادة لتثبيتها!', 'info', 2500);
        } else {
          // اكتمال الجلسة تماماً
          return renderSessionComplete();
        }
      }

      const currentItem = sessionQueue[sessionCurrentIndex];

      container.innerHTML = `
        <div class="review-session-view fade-in">
          <header class="session-header">
            <button class="btn-icon" id="btn-session-exit" title="إنهاء الجلسة">
              ${renderIcon('close')}
            </button>
            <div class="session-progress">
              <span>الذكر ${UIComponents.toArabicNumerals(sessionCurrentIndex + 1)} من ${UIComponents.toArabicNumerals(sessionQueue.length)}</span>
              <div class="session-track">
                <div class="session-fill" style="width: ${((sessionCurrentIndex + 1) / sessionQueue.length) * 100}%"></div>
              </div>
            </div>
            <button class="btn-sm btn-outline" id="btn-session-memorize" title="فتح شاشة الحفظ المقسم">
              ${renderIcon('brain')}
            </button>
          </header>

          <main class="session-card">
            <h2 class="session-item-title">${UIComponents.escapeHTML(currentItem.title)}</h2>

            <div class="session-text-container font-arabic-large">
              ${isAnswerVisibleInSession ? `
                <div class="session-full-text">${UIComponents.escapeHTML(currentItem.text)}</div>
              ` : `
                <div class="session-hidden-prompt">
                  <p>استحضر نص الذكر كاملاً في ذهنك، ثم اضغط للتحقق من حفظك:</p>
                  <button class="btn btn-outline" id="btn-session-reveal">
                    ${renderIcon('eye')} إظهار النص للتحقق
                  </button>
                </div>
              `}
            </div>

            ${isAnswerVisibleInSession ? `
              <div class="session-rating-area fade-in">
                <p class="rating-prompt">كيف كان تذكرك لهذا الذكر؟</p>
                <div class="session-rating-buttons">
                  <button class="session-rate-btn rate-forgot" data-rating="forgot">
                    <span class="rate-label">لم أتذكر</span>
                    <span class="rate-desc">إعادة في الجلسة بعد 10 دقائق</span>
                  </button>

                  <button class="session-rate-btn rate-hard" data-rating="hard">
                    <span class="rate-label">تذكرت بصعوبة</span>
                    <span class="rate-desc">مراجعة غداً</span>
                  </button>

                  <button class="session-rate-btn rate-mastered" data-rating="mastered">
                    <span class="rate-label">أتقنت الحفظ</span>
                    <span class="rate-desc">مراجعة بعد يومين فأكثر</span>
                  </button>
                </div>
              </div>
            ` : ''}
          </main>
        </div>
      `;

      // ربط أحداث الجلسة
      container.querySelector('#btn-session-exit').addEventListener('click', async () => {
        const confirmed = await UIComponents.showConfirm('إنهاء الجلسة', 'هل تريد إيقاف جلسة المراجعة الحالية والعودة؟');
        if (confirmed) {
          isSessionActive = false;
          renderMain();
        }
      });

      container.querySelector('#btn-session-memorize').addEventListener('click', () => {
        navigateTo('memory', { id: currentItem.id });
      });

      const revealBtn = container.querySelector('#btn-session-reveal');
      if (revealBtn) {
        revealBtn.addEventListener('click', () => {
          isAnswerVisibleInSession = true;
          renderSessionMode();
        });
      }

      container.querySelectorAll('.session-rate-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const rating = btn.dataset.rating;
          await ReviewService.recordReview(currentItem.id, rating, true);

          if (rating === 'forgot') {
            // إدراج في طابور الإعادة بعد 10 دقائق
            inSessionRetryQueue.push(currentItem);
            UIComponents.showToast('أُدرج الذكر في جولة الإعادة في نهاية الجلسة.', 'info', 2000);
          } else {
            UIComponents.showToast('تم تسجيل التقييم وجدولة الذكر.', 'success', 1500);
          }

          sessionCurrentIndex++;
          isAnswerVisibleInSession = false;
          renderSessionMode();
        });
      });
    };

    /**
     * شاشة اكتمال جلسة المراجعة
     */
    const renderSessionComplete = () => {
      container.innerHTML = `
        <div class="session-complete-view fade-in">
          <div class="complete-card">
            <span class="complete-icon">${renderIcon('check')}</span>
            <h2>هنيئاً لك! أتممت جلسة المراجعة بنجاح</h2>
            <p>تم تحديث جداول المراجعات المتباعدة وحفظ جميع تقييماتك محلياً.</p>
            <div class="complete-actions">
              <button class="btn btn-primary btn-block" id="btn-complete-done">
                العودة للرئيسية
              </button>
            </div>
          </div>
        </div>
      `;

      container.querySelector('#btn-complete-done').addEventListener('click', () => {
        navigateTo('home');
      });
    };

    await renderMain();
  }
}
