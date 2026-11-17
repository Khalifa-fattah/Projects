/**
 * تطبيق وِرد | Wird
 * واجهة نظام حفظ الأذكار بالأوضاع الثلاثة: التعلم، الاسترجاع، الربط
 */

import { AzkarService } from '../../services/azkar-service.js';
import { MemoryService } from '../../services/memory-service.js';
import { ReviewService } from '../../services/review-service.js';
import { renderIcon } from '../icons.js';
import { UIComponents } from '../components.js';

export class MemoryView {
  static async render(container, navigateTo, params = {}) {
    const { id } = params;

    if (!id) {
      navigateTo('library');
      return;
    }

    container.innerHTML = `
      <div class="view-loading">
        <div class="spinner"></div>
        <p>جاري تحميل وضع الحفظ...</p>
      </div>
    `;

    const item = await AzkarService.getZikrById(id);
    if (!item) {
      UIComponents.showToast('لم يتم العثور على هذا الذكر.', 'error');
      navigateTo('library');
      return;
    }

    let learningState = await MemoryService.getOrCreateLearningState(id);
    let { segments, needsReview } = await MemoryService.getSegmentsForZikr(item);

    if (segments.length === 0) {
      segments = [item.text];
    }

    let currentMode = learningState.currentMode || 'learn'; // 'learn', 'recall', 'connect'
    let currentSegmentIndex = 0;
    let showPreviousSegments = true;
    let recallLevel = learningState.recallLevel || 1;
    let isRecallAnswerRevealed = false;
    let connectRevealedCount = 1; // كم مقطع تم كشفه في وضع الربط

    const renderView = () => {
      container.innerHTML = `
        <div class="memory-view fade-in">
          <!-- شريط رأس الحفظ -->
          <header class="memory-header-bar">
            <button class="btn-icon" id="btn-mem-back" title="الرجوع">
              ${renderIcon('arrowRight')}
            </button>
            <div class="memory-title-box">
              <h2 class="mem-title">${UIComponents.escapeHTML(item.title)}</h2>
              <span class="mem-status-badge">
                ${learningState.status === 'mastered' ? 'متقن' : (learningState.status === 'reviewing' ? 'قيد المراجعة' : 'قيد التعلم')}
              </span>
            </div>
            <button class="btn-icon" id="btn-edit-segments" title="تعديل وتقسيم المقاطع">
              ${renderIcon('edit')}
            </button>
          </header>

          <!-- تنبيه مراجعة المقاطع إذا تغير النص -->
          ${needsReview ? `
            <div class="alert alert-warning alert-dismissible" id="alert-needs-review">
              <div class="alert-content">
                <strong>تنبيه:</strong> تم تعديل نص الذكر سابقاً، يُرجى مراجعة المقاطع أو إعادة التقسيم.
              </div>
              <button class="btn-sm btn-secondary" id="btn-resegment-auto">إعادة التقسيم</button>
            </div>
          ` : ''}

          <!-- محدد أوضاع الحفظ الثلاثة -->
          <nav class="mode-tabs">
            <button class="mode-tab ${currentMode === 'learn' ? 'active' : ''}" data-mode="learn">
              ١. التعلم (Learn)
            </button>
            <button class="mode-tab ${currentMode === 'recall' ? 'active' : ''}" data-mode="recall">
              ٢. الاسترجاع (Recall)
            </button>
            <button class="mode-tab ${currentMode === 'connect' ? 'active' : ''}" data-mode="connect">
              ٣. الربط (Connect)
            </button>
          </nav>

          <!-- منطقة المحتوى التفاعلي للوضع النشط -->
          <main class="memory-main-area" id="memory-main-area">
            ${currentMode === 'learn' ? renderLearnMode() : (currentMode === 'recall' ? renderRecallMode() : renderConnectMode())}
          </main>
        </div>
      `;

      attachViewEvents();
    };

    /**
     * الوضع الأول: التعلم (Learn)
     */
    const renderLearnMode = () => {
      const currentSegment = segments[currentSegmentIndex] || '';

      return `
        <div class="mode-container learn-mode fade-in">
          <div class="segment-indicator">
            <span>المقطع ${UIComponents.toArabicNumerals(currentSegmentIndex + 1)} من ${UIComponents.toArabicNumerals(segments.length)}</span>
            <div class="segment-progress-track">
              <div class="segment-progress-fill" style="width: ${((currentSegmentIndex + 1) / segments.length) * 100}%"></div>
            </div>
          </div>

          <!-- بطاقة التركيز على المقطع الحالي -->
          <div class="focus-segment-card">
            <span class="focus-label">المقطع الحالي للتركيز:</span>
            <div class="segment-focus-text font-arabic-large">
              ${UIComponents.escapeHTML(currentSegment)}
            </div>
          </div>

          <!-- خيار إظهار أو إخفاء المقاطع السابقة للمراجعة التراكمية -->
          <div class="cumulative-toggle-row">
            <label class="toggle-control">
              <input type="checkbox" id="chk-show-previous" ${showPreviousSegments ? 'checked' : ''}>
              <span class="toggle-label">عرض المقاطع السابقة بالتسلسل</span>
            </label>
          </div>

          ${showPreviousSegments && currentSegmentIndex > 0 ? `
            <div class="previous-segments-box font-arabic">
              <div class="prev-title">المقاطع السابقة:</div>
              ${segments.slice(0, currentSegmentIndex).map((seg, i) => `
                <div class="prev-seg-item"><span class="prev-seg-num">${UIComponents.toArabicNumerals(i + 1)}.</span> ${UIComponents.escapeHTML(seg)}</div>
              `).join('')}
            </div>
          ` : ''}

          <!-- أزرار التنقل بين المقاطع (لا انتقال تلقائي) -->
          <div class="learn-nav-buttons">
            <button class="btn btn-outline" id="btn-seg-prev" ${currentSegmentIndex === 0 ? 'disabled' : ''}>
              ${renderIcon('arrowRight')} المقطع السابق
            </button>

            ${currentSegmentIndex < segments.length - 1 ? `
              <button class="btn btn-primary" id="btn-seg-next">
                المقطع التالي ${renderIcon('arrowLeft')}
              </button>
            ` : `
              <button class="btn btn-success" id="btn-goto-recall">
                الانتقال للاسترجاع ${renderIcon('arrowLeft')}
              </button>
            `}
          </div>
        </div>
      `;
    };

    /**
     * الوضع الثاني: الاسترجاع (Recall)
     */
    const renderRecallMode = () => {
      const currentSegment = segments[currentSegmentIndex] || '';
      const { maskedWords } = MemoryService.prepareRecallSegment(currentSegment, recallLevel);

      return `
        <div class="mode-container recall-mode fade-in">
          <div class="recall-header-controls">
            <div class="difficulty-selector">
              <span class="diff-label">مستوى الإخفاء:</span>
              <button class="diff-btn ${recallLevel === 1 ? 'active' : ''}" data-level="1">سهل</button>
              <button class="diff-btn ${recallLevel === 2 ? 'active' : ''}" data-level="2">متوسط</button>
              <button class="diff-btn ${recallLevel === 3 ? 'active' : ''}" data-level="3">متقدم</button>
            </div>
          </div>

          <div class="segment-indicator">
            <span>استرجاع المقطع ${UIComponents.toArabicNumerals(currentSegmentIndex + 1)} من ${UIComponents.toArabicNumerals(segments.length)}</span>
          </div>

          <!-- بطاقة الاسترجاع الذهني -->
          <div class="recall-card">
            <p class="recall-instruction">حاول استرجاع الكلمات المخفية ذهنياً، ثم اضغط لإظهار الإجابة والتحقق:</p>
            
            <div class="recall-text-box font-arabic-large">
              ${isRecallAnswerRevealed ? 
                `<span class="revealed-answer">${UIComponents.escapeHTML(currentSegment)}</span>` :
                maskedWords.map(item => item.isHidden ? 
                  `<span class="masked-word" title="اضغط لكشف الكلمة">......</span>` : 
                  `<span>${UIComponents.escapeHTML(item.word)} </span>`
                ).join(' ')
              }
            </div>

            <div class="recall-reveal-actions">
              <button class="btn btn-outline btn-block" id="btn-toggle-answer">
                ${renderIcon(isRecallAnswerRevealed ? 'eyeOff' : 'eye')} ${isRecallAnswerRevealed ? 'إخفاء الإجابة' : 'إظهار الإجابة للتحقق'}
              </button>
            </div>
          </div>

          <!-- أدوات التنقل والرجوع لوضع التعلم -->
          <div class="recall-footer-nav">
            <button class="btn btn-secondary btn-sm" id="btn-back-to-learn">
              ${renderIcon('arrowRight')} الرجوع لوضع التعلم
            </button>

            <div class="recall-step-btns">
              <button class="btn btn-outline btn-sm" id="btn-recall-prev" ${currentSegmentIndex === 0 ? 'disabled' : ''}>
                السابق
              </button>
              ${currentSegmentIndex < segments.length - 1 ? `
                <button class="btn btn-primary btn-sm" id="btn-recall-next">
                  التالي
                </button>
              ` : `
                <button class="btn btn-success btn-sm" id="btn-goto-connect">
                  الانتقال للربط الكامل
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    };

    /**
     * الوضع الثالث: الربط (Connect)
     */
    const renderConnectMode = () => {
      const isAllRevealed = connectRevealedCount >= segments.length;

      return `
        <div class="mode-container connect-mode fade-in">
          <div class="connect-header-info">
            <h3>وضع الربط والتسلسل الكامل</h3>
            <p class="connect-desc">استرجع الذكر كاملاً بالترتيب الصحيح، واكشف المقاطع بالتتابع لتثبيت الرابط بين الجمل:</p>
          </div>

          <!-- تسلسل المقاطع المكشوفة والمتبقية -->
          <div class="connect-flow-card font-arabic">
            ${segments.map((seg, idx) => {
              const isRevealed = idx < connectRevealedCount;
              return `
                <div class="connect-segment-row ${isRevealed ? 'is-revealed' : 'is-hidden'}">
                  <span class="connect-num">${UIComponents.toArabicNumerals(idx + 1)}.</span>
                  <span class="connect-text">
                    ${isRevealed ? UIComponents.escapeHTML(seg) : '• • • • • • • • • • • • • • • •'}
                  </span>
                </div>
              `;
            }).join('')}
          </div>

          <div class="connect-actions">
            ${!isAllRevealed ? `
              <button class="btn btn-primary btn-block" id="btn-reveal-next-segment">
                كشف المقطع التالي للتحقق (${UIComponents.toArabicNumerals(connectRevealedCount + 1)}/${UIComponents.toArabicNumerals(segments.length)})
              </button>
              <button class="btn btn-outline btn-block mt-2" id="btn-reveal-all">
                ${renderIcon('eye')} إظهار النص كاملاً
              </button>
            ` : `
              <div class="completion-banner">
                <span class="comp-icon">${renderIcon('check')}</span>
                <h4>أتممت استرجاع وربط الذكر كاملاً!</h4>
                <p>قيّم حفظك الآن لجدولة موعد مراجعتك القادمة وفق نظام التكرار المتباعد:</p>
              </div>

              <!-- خيارات التقييم الذاتي المحددة -->
              <div class="self-evaluation-grid">
                <button class="eval-btn eval-forgot" data-rating="forgot">
                  <span class="eval-title">لم أتذكر</span>
                  <span class="eval-sub">إعادة بعد 10 دقائق</span>
                </button>
                <button class="eval-btn eval-hard" data-rating="hard">
                  <span class="eval-title">تذكرت بصعوبة</span>
                  <span class="eval-sub">مراجعة غداً</span>
                </button>
                <button class="eval-btn eval-mastered" data-rating="mastered">
                  <span class="eval-title">أتقنت الحفظ</span>
                  <span class="eval-sub">مراجعة بعد يومين</span>
                </button>
              </div>
            `}
          </div>

          <div class="eval-note">
            <span>${renderIcon('info')}</span>
            <span>التقييم ذاتي لمساعدتك، وخوارزمية التكرار تنظم فترات المراجعة بناءً على اختيارك.</span>
          </div>
        </div>
      `;
    };

    /**
     * ربط الأحداث
     */
    const attachViewEvents = () => {
      // الرجوع
      container.querySelector('#btn-mem-back').addEventListener('click', () => {
        navigateTo('reader', { id: item.id });
      });

      // تعديل المقاطع
      container.querySelector('#btn-edit-segments').addEventListener('click', async () => {
        const result = await UIComponents.showSegmentEditor(segments, item.title);
        if (result) {
          if (result.reset) {
            segments = await MemoryService.resetSegments(item.id, item.text);
            UIComponents.showToast('تمت إعادة التقسيم التلقائي.', 'info');
          } else if (result.segments) {
            segments = result.segments;
            await MemoryService.saveCustomSegments(item.id, segments, item.text);
            UIComponents.showToast('تم حفظ المقاطع المخصصة.', 'success');
          }
          currentSegmentIndex = 0;
          renderView();
        }
      });

      // زر إعادة التقسيم في التنبيه
      const resegBtn = container.querySelector('#btn-resegment-auto');
      if (resegBtn) {
        resegBtn.addEventListener('click', async () => {
          segments = await MemoryService.resetSegments(item.id, item.text);
          needsReview = false;
          UIComponents.showToast('تم تحديث التقسيم ليتوافق مع النص الجديد.', 'success');
          renderView();
        });
      }

      // تبديل الأوضاع الثلاثة
      container.querySelectorAll('.mode-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
          currentMode = tab.dataset.mode;
          learningState.currentMode = currentMode;
          await MemoryService.updateLearningState(learningState);
          isRecallAnswerRevealed = false;
          connectRevealedCount = 1;
          renderView();
        });
      });

      // أحداث وضع التعلم
      if (currentMode === 'learn') {
        const chkPrev = container.querySelector('#chk-show-previous');
        if (chkPrev) {
          chkPrev.addEventListener('change', (e) => {
            showPreviousSegments = e.target.checked;
            renderView();
          });
        }

        const btnPrev = container.querySelector('#btn-seg-prev');
        if (btnPrev && currentSegmentIndex > 0) {
          btnPrev.addEventListener('click', () => {
            currentSegmentIndex--;
            renderView();
          });
        }

        const btnNext = container.querySelector('#btn-seg-next');
        if (btnNext) {
          btnNext.addEventListener('click', () => {
            if (currentSegmentIndex < segments.length - 1) {
              currentSegmentIndex++;
              renderView();
            }
          });
        }

        const btnGotoRecall = container.querySelector('#btn-goto-recall');
        if (btnGotoRecall) {
          btnGotoRecall.addEventListener('click', () => {
            currentMode = 'recall';
            currentSegmentIndex = 0;
            renderView();
          });
        }
      }

      // أحداث وضع الاسترجاع
      if (currentMode === 'recall') {
        container.querySelectorAll('.diff-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            recallLevel = parseInt(btn.dataset.level, 10);
            learningState.recallLevel = recallLevel;
            await MemoryService.updateLearningState(learningState);
            isRecallAnswerRevealed = false;
            renderView();
          });
        });

        const toggleBtn = container.querySelector('#btn-toggle-answer');
        if (toggleBtn) {
          toggleBtn.addEventListener('click', () => {
            isRecallAnswerRevealed = !isRecallAnswerRevealed;
            renderView();
          });
        }

        const backToLearn = container.querySelector('#btn-back-to-learn');
        if (backToLearn) {
          backToLearn.addEventListener('click', () => {
            currentMode = 'learn';
            renderView();
          });
        }

        const btnRecPrev = container.querySelector('#btn-recall-prev');
        if (btnRecPrev && currentSegmentIndex > 0) {
          btnRecPrev.addEventListener('click', () => {
            currentSegmentIndex--;
            isRecallAnswerRevealed = false;
            renderView();
          });
        }

        const btnRecNext = container.querySelector('#btn-recall-next');
        if (btnRecNext) {
          btnRecNext.addEventListener('click', () => {
            if (currentSegmentIndex < segments.length - 1) {
              currentSegmentIndex++;
              isRecallAnswerRevealed = false;
              renderView();
            }
          });
        }

        const btnGotoConnect = container.querySelector('#btn-goto-connect');
        if (btnGotoConnect) {
          btnGotoConnect.addEventListener('click', () => {
            currentMode = 'connect';
            connectRevealedCount = 1;
            renderView();
          });
        }
      }

      // أحداث وضع الربط
      if (currentMode === 'connect') {
        const btnNextSeg = container.querySelector('#btn-reveal-next-segment');
        if (btnNextSeg) {
          btnNextSeg.addEventListener('click', () => {
            if (connectRevealedCount < segments.length) {
              connectRevealedCount++;
              renderView();
            }
          });
        }

        const btnRevealAll = container.querySelector('#btn-reveal-all');
        if (btnRevealAll) {
          btnRevealAll.addEventListener('click', () => {
            connectRevealedCount = segments.length;
            renderView();
          });
        }

        // أزرار التقييم الذاتي
        container.querySelectorAll('.eval-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const rating = btn.dataset.rating;
            await ReviewService.recordReview(item.id, rating, true);

            let msg = 'تم تسجيل التقييم وجدولة موعد المراجعة القادمة.';
            if (rating === 'forgot') msg = 'سيُعاد الذكر بعد 10 دقائق لتثبيته.';
            if (rating === 'hard') msg = 'سجلت المراجعة القادمة غداً.';
            if (rating === 'mastered') msg = 'ما شاء الله! سُجلت المراجعة بعد يومين.';

            UIComponents.showToast(msg, 'success', 3000);
            navigateTo('review');
          });
        });
      }
    };

    renderView();
  }
}
