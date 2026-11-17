/**
 * تطبيق وِرد | Wird
 * عرض مكتبة الأذكار والتصنيفات والترتيب وإضافة الأذكار الشخصية
 */

import { AzkarService } from '../../services/azkar-service.js';
import { MemoryService } from '../../services/memory-service.js';
import { renderIcon } from '../icons.js';
import { UIComponents } from '../components.js';

export class LibraryView {
  static async render(container, navigateTo, params = {}) {
    let currentCollectionId = params.collectionId || null;
    let searchQuery = '';

    const renderMain = async () => {
      container.innerHTML = `
        <div class="view-loading">
          <div class="spinner"></div>
          <p>جاري تحميل المكتبة...</p>
        </div>
      `;

      const collections = await AzkarService.getCollections();

      if (!currentCollectionId) {
        // عرض جميع التصنيفات مع إمكانية البحث العام
        await renderCollectionsOverview(collections);
      } else {
        // عرض أذكار تصنيف محدد
        await renderCollectionDetails(collections, currentCollectionId);
      }
    };

    /**
     * عرض نظرة عامة على المجموعات
     */
    const renderCollectionsOverview = async (collections) => {
      container.innerHTML = `
        <div class="library-view fade-in">
          <header class="view-header">
            <h1 class="view-title">مكتبة الأذكار والأدعية</h1>
            <p class="view-subtitle">تصفح الأوراد المأثورة الموثقة والأدعية بحسب المناسبة والوقت</p>
          </header>

          <!-- شريط البحث الشامل -->
          <div class="search-box-wrapper">
            <div class="search-box">
              <span class="search-icon">${renderIcon('search')}</span>
              <input type="search" id="global-search-input" class="search-input" 
                placeholder="ابحث في جميع الأذكار بالعنوان أو النص..." value="${UIComponents.escapeHTML(searchQuery)}">
              ${searchQuery ? `<button class="btn-clear-search" id="btn-clear-search">${renderIcon('close')}</button>` : ''}
            </div>
          </div>

          <div id="search-results-area"></div>

          <div id="collections-grid-area">
            <div class="collections-grid">
              ${collections.map(col => `
                <div class="collection-card" data-id="${col.id}">
                  <div class="collection-header">
                    <span class="collection-icon">${renderIcon(col.icon)}</span>
                    <span class="collection-badge">${UIComponents.toArabicNumerals(col.count)} أذكار</span>
                  </div>
                  <h3 class="collection-name">${UIComponents.escapeHTML(col.name)}</h3>
                  <p class="collection-desc">${UIComponents.escapeHTML(col.description)}</p>
                  <div class="collection-footer">
                    <span>فتح الأوراد</span>
                    <span class="arrow">${renderIcon('arrowLeft')}</span>
                  </div>
                </div>
              `).join('')}
            </div>

            <!-- زر إضافة ذكر مخصص جديد -->
            <div class="floating-add-container">
              <button class="btn btn-primary btn-block btn-lg" id="btn-add-global-zikr">
                ${renderIcon('plus')} إضافة ذكر أو دعاء شخصي
              </button>
            </div>
          </div>
        </div>
      `;

      // ربط أحداث النقر على بطاقات المجموعات
      container.querySelectorAll('.collection-card').forEach(card => {
        card.addEventListener('click', () => {
          currentCollectionId = card.dataset.id;
          renderMain();
        });
      });

      // زر إضافة ذكر عام
      container.querySelector('#btn-add-global-zikr').addEventListener('click', async () => {
        const result = await UIComponents.showZikrModal(null, collections);
        if (result) {
          await AzkarService.addCustomZikr(result);
          UIComponents.showToast('تمت إضافة الذكر بنجاح.', 'success');
          renderMain();
        }
      });

      // البحث الشامل
      const searchInput = container.querySelector('#global-search-input');
      const resultsArea = container.querySelector('#search-results-area');
      const gridArea = container.querySelector('#collections-grid-area');

      const doSearch = async (q) => {
        searchQuery = q.trim();
        if (!searchQuery) {
          resultsArea.innerHTML = '';
          gridArea.style.display = 'block';
          return;
        }

        gridArea.style.display = 'none';
        resultsArea.innerHTML = `<div class="spinner-sm"></div> جاري البحث...`;

        const matches = await AzkarService.searchAzkar(searchQuery);
        if (matches.length === 0) {
          resultsArea.innerHTML = `
            <div class="empty-state">
              <p>لم يتم العثور على أذكار تطابق: <strong>«${UIComponents.escapeHTML(searchQuery)}»</strong></p>
              <button class="btn btn-secondary btn-sm" id="btn-cancel-search">عرض جميع التصنيفات</button>
            </div>
          `;
          resultsArea.querySelector('#btn-cancel-search').addEventListener('click', () => {
            searchInput.value = '';
            doSearch('');
          });
          return;
        }

        resultsArea.innerHTML = `
          <div class="search-results-list">
            <h3 class="search-results-title">نتائج البحث (${UIComponents.toArabicNumerals(matches.length)}):</h3>
            ${matches.map((item, idx) => `
              <div class="zikr-card" data-id="${item.id}" data-col="${item.collectionId}">
                <div class="zikr-card-header">
                  <div class="zikr-meta">
                    <span class="zikr-serial">${UIComponents.toArabicNumerals(idx + 1)}</span>
                    <h4 class="zikr-title">${UIComponents.escapeHTML(item.title)}</h4>
                  </div>
                  <div class="zikr-badges">
                    ${item.isCustom ? '<span class="badge badge-custom">شخصي</span>' : '<span class="badge badge-authentic">مأثور موثق</span>'}
                  </div>
                </div>
                <div class="zikr-text-preview font-arabic">${UIComponents.escapeHTML(item.text.slice(0, 140))}${item.text.length > 140 ? '...' : ''}</div>
                <div class="zikr-card-actions">
                  <button class="btn btn-primary btn-sm btn-read" data-id="${item.id}" data-col="${item.collectionId}">قراءة</button>
                  <button class="btn btn-outline btn-sm btn-memorize" data-id="${item.id}">حفظ ومراجعة</button>
                </div>
              </div>
            `).join('')}
          </div>
        `;

        resultsArea.querySelectorAll('.btn-read').forEach(b => {
          b.addEventListener('click', (e) => {
            e.stopPropagation();
            navigateTo('reader', { id: b.dataset.id, collectionId: b.dataset.col });
          });
        });

        resultsArea.querySelectorAll('.btn-memorize').forEach(b => {
          b.addEventListener('click', (e) => {
            e.stopPropagation();
            navigateTo('memory', { id: b.dataset.id });
          });
        });
      };

      searchInput.addEventListener('input', (e) => doSearch(e.target.value));
      const clearBtn = container.querySelector('#btn-clear-search');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          searchInput.value = '';
          doSearch('');
        });
      }
    };

    /**
     * عرض تفاصيل مجموعة وأذكارها وفق الترتيب المحفوظ
     */
    const renderCollectionDetails = async (collections, colId) => {
      const collection = collections.find(c => c.id === colId);
      if (!collection) {
        currentCollectionId = null;
        return renderMain();
      }

      let items = await AzkarService.getAzkarByCollection(colId);

      container.innerHTML = `
        <div class="collection-detail-view fade-in">
          <!-- شريط الرأس والرجوع -->
          <div class="detail-header-bar">
            <button class="btn-icon" id="btn-back-to-cols" title="الرجوع للتصنيفات">
              ${renderIcon('arrowRight')}
            </button>
            <div class="detail-header-title">
              <h2>${UIComponents.escapeHTML(collection.name)}</h2>
              <span class="detail-count">${UIComponents.toArabicNumerals(items.length)} أذكار</span>
            </div>
            <button class="btn-icon btn-primary-icon" id="btn-add-zikr" title="إضافة ذكر لهذه المجموعة">
              ${renderIcon('plus')}
            </button>
          </div>

          <!-- شريط أدوات المجموعة (استعادة الترتيب وبحث) -->
          <div class="collection-toolbar">
            <div class="search-box-inline">
              <span class="search-icon">${renderIcon('search')}</span>
              <input type="text" id="collection-search-input" class="form-control form-control-sm" 
                placeholder="تصفية في هذا الورد...">
            </div>
            <button class="btn btn-outline btn-sm" id="btn-reset-order" title="استعادة الترتيب الافتراضي">
              ${renderIcon('refresh')} الترتيب الافتراضي
            </button>
          </div>

          <!-- قائمة الأذكار المرتبة -->
          <div class="ordered-zikr-list" id="ordered-zikr-list">
            ${renderItemsList(items)}
          </div>
        </div>
      `;

      // ربط أزرار التحكم
      container.querySelector('#btn-back-to-cols').addEventListener('click', () => {
        currentCollectionId = null;
        renderMain();
      });

      container.querySelector('#btn-add-zikr').addEventListener('click', async () => {
        const result = await UIComponents.showZikrModal(null, collections);
        if (result) {
          await AzkarService.addCustomZikr({
            ...result,
            collectionId: colId
          });
          UIComponents.showToast('تمت إضافة الذكر إلى المجموعة بنجاح.', 'success');
          renderMain();
        }
      });

      container.querySelector('#btn-reset-order').addEventListener('click', async () => {
        const confirmed = await UIComponents.showConfirm(
          'استعادة الترتيب الافتراضي',
          'هل تريد إعادة ترتيب أذكار هذه المجموعة إلى الترتيب الافتراضي المعتمد؟'
        );
        if (confirmed) {
          await AzkarService.resetCollectionOrder(colId);
          UIComponents.showToast('تمت استعادة الترتيب الافتراضي بنجاح.', 'success');
          renderMain();
        }
      });

      // تصفية الأذكار داخل المجموعة
      const filterInput = container.querySelector('#collection-search-input');
      filterInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const cards = container.querySelectorAll('.zikr-card-item');
        cards.forEach(card => {
          const text = card.textContent.toLowerCase();
          card.style.display = text.includes(term) ? 'block' : 'none';
        });
      });

      attachItemActions(items, colId);
    };

    /**
     * بناء بطاقات الأذكار
     */
    function renderItemsList(items) {
      if (items.length === 0) {
        return `
          <div class="empty-state">
            <p>لا توجد أذكار في هذه المجموعة بعد.</p>
          </div>
        `;
      }

      return items.map((item, index) => `
        <div class="zikr-card-item" data-id="${item.id}" data-index="${index}" draggable="true">
          <!-- شريط التحكم بالترتيب: السحب وأزرار لأعلى ولأسفل -->
          <div class="reorder-controls">
            <button class="btn-reorder btn-move-up" data-index="${index}" ${index === 0 ? 'disabled' : ''} title="تحريك للأعلى">
              ${renderIcon('chevronUp')}
            </button>
            <span class="zikr-serial-badge">${UIComponents.toArabicNumerals(index + 1)}</span>
            <button class="btn-reorder btn-move-down" data-index="${index}" ${index === items.length - 1 ? 'disabled' : ''} title="تحريك للأسفل">
              ${renderIcon('chevronDown')}
            </button>
          </div>

          <div class="zikr-card-content">
            <div class="zikr-header-row">
              <h3 class="zikr-title">${UIComponents.escapeHTML(item.title)}</h3>
              <div class="badges-row">
                ${item.repetitions > 1 ? `<span class="badge badge-reps">${UIComponents.toArabicNumerals(item.repetitions)} مرات</span>` : ''}
                ${item.isCustom ? '<span class="badge badge-custom">شخصي</span>' : (item.isModified ? '<span class="badge badge-modified">مُعدل</span>' : '<span class="badge badge-authentic">موثق</span>')}
              </div>
            </div>

            <div class="zikr-text-preview font-arabic">
              ${UIComponents.escapeHTML(item.text.slice(0, 180))}${item.text.length > 180 ? '...' : ''}
            </div>

            ${item.source ? `
              <div class="zikr-source-meta">
                <span class="meta-label">المصدر:</span> ${UIComponents.escapeHTML(item.source)}
              </div>
            ` : ''}

            <div class="zikr-actions-row">
              <div class="primary-btns">
                <button class="btn btn-primary btn-sm btn-item-read" data-id="${item.id}">
                  ${renderIcon('bookOpen')} قراءة
                </button>
                <button class="btn btn-outline btn-sm btn-item-memory" data-id="${item.id}">
                  ${renderIcon('brain')} حفظ ومراجعة
                </button>
              </div>

              <div class="secondary-btns">
                <button class="btn-icon btn-fav ${item.isFavorite ? 'is-fav' : ''}" data-id="${item.id}" title="المفضلة">
                  ${renderIcon(item.isFavorite ? 'favoriteFilled' : 'favorite')}
                </button>
                <button class="btn-icon btn-edit" data-id="${item.id}" title="تعديل">
                  ${renderIcon('edit')}
                </button>
                ${item.isCustom ? `
                  <button class="btn-icon btn-delete" data-id="${item.id}" title="حذف">
                    ${renderIcon('trash')}
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      `).join('');
    }

    /**
     * ربط أحداث الأذكار (الترتيب، القراءة، التعديل، المفضلة، الحذف)
     */
    function attachItemActions(items, colId) {
      const listContainer = container.querySelector('#ordered-zikr-list');
      if (!listContainer) return;

      // أزرار التحريك لأعلى ولأسفل
      listContainer.querySelectorAll('.btn-move-up').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.index, 10);
          if (idx > 0) {
            const currentIds = items.map(i => i.id);
            const temp = currentIds[idx];
            currentIds[idx] = currentIds[idx - 1];
            currentIds[idx - 1] = temp;
            await AzkarService.saveCollectionOrder(colId, currentIds);
            UIComponents.showToast('تم تحديث ترتيب الأذكار.', 'info', 1500);
            renderMain();
          }
        });
      });

      listContainer.querySelectorAll('.btn-move-down').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.index, 10);
          if (idx < items.length - 1) {
            const currentIds = items.map(i => i.id);
            const temp = currentIds[idx];
            currentIds[idx] = currentIds[idx + 1];
            currentIds[idx + 1] = temp;
            await AzkarService.saveCollectionOrder(colId, currentIds);
            UIComponents.showToast('تم تحديث ترتيب الأذكار.', 'info', 1500);
            renderMain();
          }
        });
      });

      // دعم السحب والإفلات المكتبي واللمسي
      let draggedItemIndex = null;
      listContainer.querySelectorAll('.zikr-card-item').forEach(card => {
        card.addEventListener('dragstart', (e) => {
          draggedItemIndex = parseInt(card.dataset.index, 10);
          card.classList.add('is-dragging');
        });

        card.addEventListener('dragend', () => {
          card.classList.remove('is-dragging');
          listContainer.querySelectorAll('.zikr-card-item').forEach(c => c.classList.remove('drag-over'));
        });

        card.addEventListener('dragover', (e) => {
          e.preventDefault();
          card.classList.add('drag-over');
        });

        card.addEventListener('dragleave', () => {
          card.classList.remove('drag-over');
        });

        card.addEventListener('drop', async (e) => {
          e.preventDefault();
          card.classList.remove('drag-over');
          const targetIndex = parseInt(card.dataset.index, 10);
          if (draggedItemIndex !== null && draggedItemIndex !== targetIndex) {
            const currentIds = items.map(i => i.id);
            const movedId = currentIds.splice(draggedItemIndex, 1)[0];
            currentIds.splice(targetIndex, 0, movedId);
            await AzkarService.saveCollectionOrder(colId, currentIds);
            UIComponents.showToast('تم حفظ الترتيب الجديد بنجاح.', 'success', 2000);
            renderMain();
          }
        });
      });

      // قراءة
      listContainer.querySelectorAll('.btn-item-read').forEach(b => {
        b.addEventListener('click', () => {
          navigateTo('reader', { id: b.dataset.id, collectionId: colId });
        });
      });

      // حفظ
      listContainer.querySelectorAll('.btn-item-memory').forEach(b => {
        b.addEventListener('click', () => {
          navigateTo('memory', { id: b.dataset.id });
        });
      });

      // مفضلة
      listContainer.querySelectorAll('.btn-fav').forEach(b => {
        b.addEventListener('click', async () => {
          const isFav = await AzkarService.toggleFavorite(b.dataset.id);
          b.classList.toggle('is-fav', isFav);
          b.innerHTML = renderIcon(isFav ? 'favoriteFilled' : 'favorite');
          UIComponents.showToast(isFav ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة', 'info', 1500);
        });
      });

      // تعديل
      listContainer.querySelectorAll('.btn-edit').forEach(b => {
        b.addEventListener('click', async () => {
          const item = items.find(i => i.id === b.dataset.id);
          if (!item) return;

          const collections = await AzkarService.getCollections();
          const updatedData = await UIComponents.showZikrModal(item, collections);
          if (updatedData) {
            await AzkarService.updateZikr(item.id, updatedData);
            UIComponents.showToast('تم حفظ التعديل بنجاح.', 'success');
            renderMain();
          }
        });
      });

      // حذف
      listContainer.querySelectorAll('.btn-delete').forEach(b => {
        b.addEventListener('click', async () => {
          const item = items.find(i => i.id === b.dataset.id);
          if (!item) return;

          const confirmed = await UIComponents.showConfirm(
            'حذف الذكر الشخصي',
            `هل أنت متأكد من حذف «${item.title}» نهائياً؟`,
            'حذف',
            'إلغاء'
          );

          if (confirmed) {
            await AzkarService.deleteCustomZikr(item.id);
            UIComponents.showToast('تم حذف الذكر بنجاح.', 'info');
            renderMain();
          }
        });
      });
    }

    await renderMain();
  }
}
