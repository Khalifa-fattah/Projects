/**
 * تطبيق وِرد | Wird
 * عرض صفحة قراءة الذكر والعداد التفاعلي والتنقل
 */

import { AzkarService } from '../../services/azkar-service.js';
import { renderIcon } from '../icons.js';
import { UIComponents } from '../components.js';

export class ReaderView {
  static async render(container, navigateTo, params = {}) {
    const { id, collectionId } = params;

    if (!id) {
      navigateTo('library');
      return;
    }

    container.innerHTML = `
      <div class="view-loading">
        <div class="spinner"></div>
        <p>جاري تحميل صفحة القراءة...</p>
      </div>
    `;

    const item = await AzkarService.getZikrById(id);
    if (!item) {
      UIComponents.showToast('لم يتم العثور على هذا الذكر.', 'error');
      navigateTo('library');
      return;
    }

    // جلب السابق واللاحق وفق الترتيب المعتمد
    const effectiveColId = collectionId || item.collectionId;
    const adjacent = await AzkarService.getAdjacentAzkar(effectiveColId, id);

    let currentCount = 0;
    const targetCount = item.repetitions || 1;

    container.innerHTML = `
      <div class="reader-view fade-in">
        <!-- شريط الرأس -->
        <header class="reader-header-bar">
          <button class="btn-icon" id="btn-reader-back" title="العودة للمجموعة">
            ${renderIcon('arrowRight')}
          </button>
          <div class="reader-progress-info">
            <span class="reader-step">الذكر ${UIComponents.toArabicNumerals(adjacent.currentIndex)} من ${UIComponents.toArabicNumerals(adjacent.total)}</span>
          </div>
          <div class="reader-header-actions">
            <button class="btn-icon btn-reader-fav ${item.isFavorite ? 'is-fav' : ''}" id="btn-reader-fav" title="المفضلة">
              ${renderIcon(item.isFavorite ? 'favoriteFilled' : 'favorite')}
            </button>
            <button class="btn btn-outline btn-sm" id="btn-reader-memorize">
              ${renderIcon('brain')} حفظ
            </button>
          </div>
        </header>

        <!-- المحتوى المركزي للقراءة - بارز وخالي من المشتتات -->
        <main class="reader-content-card">
          <div class="reader-title-area">
            <h1 class="reader-title">${UIComponents.escapeHTML(item.title)}</h1>
            <div class="reader-badges">
              ${item.isCustom ? '<span class="badge badge-custom">دعاء شخصي</span>' : (item.isModified ? '<span class="badge badge-modified">نص مُعدّل</span>' : '<span class="badge badge-authentic">مأثور موثق</span>')}
              ${targetCount > 1 ? `<span class="badge badge-reps">${UIComponents.toArabicNumerals(targetCount)} مرات</span>` : ''}
            </div>
          </div>

          <article class="reader-text-container font-arabic-large" id="reader-text-container">
            ${UIComponents.escapeHTML(item.text)}
          </article>

          <!-- بطاقة المرجع والتوثيق الشرعي -->
          <footer class="reader-meta-box">
            ${item.source ? `
              <div class="meta-row">
                <span class="meta-icon">${renderIcon('bookOpen')}</span>
                <span class="meta-text"><strong>المصدر:</strong> ${UIComponents.escapeHTML(item.source)}</span>
              </div>
            ` : ''}
            ${item.hadithGrade ? `
              <div class="meta-row">
                <span class="meta-icon">${renderIcon('sparkles')}</span>
                <span class="meta-text"><strong>الدرجة / الفضل:</strong> ${UIComponents.escapeHTML(item.hadithGrade)}</span>
              </div>
            ` : ''}
          </footer>
        </main>

        <!-- عداد التكرار التفاعلي -->
        <section class="reader-counter-section">
          <div class="counter-display">
            <button class="counter-tap-area" id="btn-counter-tap" aria-label="اضغط للتكرار">
              <span class="counter-curr" id="counter-current">${UIComponents.toArabicNumerals(currentCount)}</span>
              <span class="counter-sep">/</span>
              <span class="counter-target">${UIComponents.toArabicNumerals(targetCount)}</span>
              <span class="counter-tap-hint">اضغط للتسبيح</span>
            </button>
          </div>

          <div class="counter-tools">
            <button class="btn btn-secondary btn-sm" id="btn-counter-reset" title="إعادة العداد">
              ${renderIcon('refresh')} تصفير
            </button>
          </div>
        </section>

        <!-- أزرار التنقل: السابق والتالي -->
        <nav class="reader-navigation-bar">
          <button class="btn btn-outline nav-btn" id="btn-reader-prev" ${!adjacent.prev ? 'disabled' : ''}>
            ${renderIcon('arrowRight')} السابق
          </button>
          <button class="btn btn-primary nav-btn" id="btn-reader-next" ${!adjacent.next ? 'disabled' : ''}>
            التالي ${renderIcon('arrowLeft')}
          </button>
        </nav>
      </div>
    `;

    // عناصر التحكم
    const currentElem = container.querySelector('#counter-current');
    const tapBtn = container.querySelector('#btn-counter-tap');
    const resetBtn = container.querySelector('#btn-counter-reset');
    const favBtn = container.querySelector('#btn-reader-fav');

    const updateCounterUI = () => {
      currentElem.textContent = UIComponents.toArabicNumerals(currentCount);
      if (currentCount >= targetCount) {
        tapBtn.classList.add('counter-completed');
      } else {
        tapBtn.classList.remove('counter-completed');
      }
    };

    tapBtn.addEventListener('click', () => {
      if (currentCount < targetCount) {
        currentCount++;
        // اهتزاز لمسي لطيف إن وجد
        if (navigator.vibrate) {
          try { navigator.vibrate(25); } catch (e) {}
        }
        updateCounterUI();

        if (currentCount === targetCount) {
          UIComponents.showToast('تم إتمام تكرار الذكر، تقبل الله!', 'success', 2000);
          if (navigator.vibrate) {
            try { navigator.vibrate([40, 50, 40]); } catch (e) {}
          }
        }
      } else {
        // عند الضغط بعد الاكتمال
        UIComponents.showToast('أتممت العدد المطلوب بالفعل. اضغط تصفير للبدء من جديد.', 'info', 2000);
      }
    });

    resetBtn.addEventListener('click', () => {
      currentCount = 0;
      updateCounterUI();
      UIComponents.showToast('تمت إعادة ضبط العداد.', 'info', 1500);
    });

    favBtn.addEventListener('click', async () => {
      const isFav = await AzkarService.toggleFavorite(item.id);
      favBtn.classList.toggle('is-fav', isFav);
      favBtn.innerHTML = renderIcon(isFav ? 'favoriteFilled' : 'favorite');
      UIComponents.showToast(isFav ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة', 'info', 1500);
    });

    container.querySelector('#btn-reader-memorize').addEventListener('click', () => {
      navigateTo('memory', { id: item.id });
    });

    container.querySelector('#btn-reader-back').addEventListener('click', () => {
      navigateTo('library', { collectionId: effectiveColId });
    });

    const prevBtn = container.querySelector('#btn-reader-prev');
    if (prevBtn && adjacent.prev) {
      prevBtn.addEventListener('click', () => {
        navigateTo('reader', { id: adjacent.prev.id, collectionId: effectiveColId });
      });
    }

    const nextBtn = container.querySelector('#btn-reader-next');
    if (nextBtn && adjacent.next) {
      nextBtn.addEventListener('click', () => {
        navigateTo('reader', { id: adjacent.next.id, collectionId: effectiveColId });
      });
    }
  }
}
