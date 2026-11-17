/**
 * تطبيق وِرد | Wird
 * عرض الأذكار المفضلة
 */

import { AzkarService } from '../../services/azkar-service.js';
import { renderIcon } from '../icons.js';
import { UIComponents } from '../components.js';

export class FavoritesView {
  static async render(container, navigateTo) {
    container.innerHTML = `
      <div class="view-loading">
        <div class="spinner"></div>
        <p>جاري تحميل المفضلة...</p>
      </div>
    `;

    const favorites = await AzkarService.getFavorites();

    const renderList = (items) => {
      if (items.length === 0) {
        return `
          <div class="empty-state">
            <span class="empty-icon">${renderIcon('favorite')}</span>
            <h3>قائمتك المفضلة فارغة حالياً</h3>
            <p>يمكنك تمييز أي ذكر أو دعاء بنجمة المفضلة في صفحات القراءة أو المكتبة للوصول السريع إليه هنا.</p>
            <button class="btn btn-primary" id="btn-browse-library">
              ${renderIcon('bookOpen')} تصفح المكتبة
            </button>
          </div>
        `;
      }

      return `
        <div class="favorites-grid">
          ${items.map((item, idx) => `
            <div class="zikr-card-item fav-card" data-id="${item.id}">
              <div class="zikr-card-content">
                <div class="zikr-header-row">
                  <h3 class="zikr-title">${UIComponents.escapeHTML(item.title)}</h3>
                  <div class="badges-row">
                    ${item.repetitions > 1 ? `<span class="badge badge-reps">${UIComponents.toArabicNumerals(item.repetitions)} مرات</span>` : ''}
                    ${item.isCustom ? '<span class="badge badge-custom">شخصي</span>' : '<span class="badge badge-authentic">موثق</span>'}
                  </div>
                </div>

                <div class="zikr-text-preview font-arabic">
                  ${UIComponents.escapeHTML(item.text.slice(0, 160))}${item.text.length > 160 ? '...' : ''}
                </div>

                <div class="zikr-actions-row">
                  <div class="primary-btns">
                    <button class="btn btn-primary btn-sm btn-fav-read" data-id="${item.id}" data-col="${item.collectionId}">
                      ${renderIcon('bookOpen')} قراءة
                    </button>
                    <button class="btn btn-outline btn-sm btn-fav-mem" data-id="${item.id}">
                      ${renderIcon('brain')} حفظ
                    </button>
                  </div>
                  <div class="secondary-btns">
                    <button class="btn-icon is-fav btn-fav-remove" data-id="${item.id}" title="إزالة من المفضلة">
                      ${renderIcon('favoriteFilled')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    };

    container.innerHTML = `
      <div class="favorites-view fade-in">
        <header class="view-header">
          <h1 class="view-title">الأذكار المفضلة</h1>
          <p class="view-subtitle">الأوراد والأدعية الأقرب إلى قلبك والتي قمت بتمييزها (${UIComponents.toArabicNumerals(favorites.length)})</p>
        </header>

        <div id="favorites-content-area">
          ${renderList(favorites)}
        </div>
      </div>
    `;

    const attachEvents = () => {
      const browseBtn = container.querySelector('#btn-browse-library');
      if (browseBtn) {
        browseBtn.addEventListener('click', () => navigateTo('library'));
      }

      container.querySelectorAll('.btn-fav-read').forEach(b => {
        b.addEventListener('click', () => {
          navigateTo('reader', { id: b.dataset.id, collectionId: b.dataset.col });
        });
      });

      container.querySelectorAll('.btn-fav-mem').forEach(b => {
        b.addEventListener('click', () => {
          navigateTo('memory', { id: b.dataset.id });
        });
      });

      container.querySelectorAll('.btn-fav-remove').forEach(b => {
        b.addEventListener('click', async () => {
          await AzkarService.toggleFavorite(b.dataset.id);
          UIComponents.showToast('تمت الإزالة من المفضلة.', 'info', 1500);
          FavoritesView.render(container, navigateTo);
        });
      });
    };

    attachEvents();
  }
}
