/**
 * تطبيق وِرد | Wird
 * المكونات البصرية التفاعلية وإدارة النوافذ والتنبيهات
 */

import { renderIcon } from './icons.js';

export class UIComponents {
  /**
   * إظهار تنبيه عائم هادئ (Toast)
   */
  static showToast(message, type = 'info', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check';
    if (type === 'error') iconName = 'close';

    toast.innerHTML = `
      <span class="toast-icon">${renderIcon(iconName)}</span>
      <span class="toast-msg">${this.escapeHTML(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * إظهار نافذة تأكيد للمستخدم
   */
  static async showConfirm(title, message, confirmText = 'تأكيد', cancelText = 'إلغاء') {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h3>${this.escapeHTML(title)}</h3>
          </div>
          <div class="modal-body">
            <p>${this.escapeHTML(message)}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="confirm-cancel">${this.escapeHTML(cancelText)}</button>
            <button class="btn btn-primary" id="confirm-ok">${this.escapeHTML(confirmText)}</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const cleanup = (result) => {
        modal.classList.add('modal-closing');
        setTimeout(() => modal.remove(), 200);
        resolve(result);
      };

      modal.querySelector('#confirm-ok').addEventListener('click', () => cleanup(true));
      modal.querySelector('#confirm-cancel').addEventListener('click', () => cleanup(false));
      modal.addEventListener('click', (e) => {
        if (e.target === modal) cleanup(false);
      });
    });
  }

  /**
   * نافذة إضافة أو تعديل ذكر شخصي
   */
  static async showZikrModal(existingItem = null, collections = []) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal-backdrop';
      const isEdit = !!existingItem;

      const collectionOptions = collections.map(c => `
        <option value="${c.id}" ${existingItem && existingItem.collectionId === c.id ? 'selected' : ''}>
          ${this.escapeHTML(c.name)}
        </option>
      `).join('');

      modal.innerHTML = `
        <div class="modal-dialog modal-lg">
          <div class="modal-header">
            <h3>${isEdit ? 'تعديل الذكر' : 'إضافة ذكر أو دعاء جديد'}</h3>
            <button class="btn-icon" id="modal-close" title="إغلاق">${renderIcon('close')}</button>
          </div>
          <form id="zikr-form" class="modal-body form-grid">
            ${isEdit && !existingItem.isCustom ? `
              <div class="alert alert-warning">
                <strong>تنبيه:</strong> هذا ذكر افتراضي مأثور. سيتم الحفاظ على النص والمرجع الأصلي كنسخة تاريخية موثقة.
              </div>
            ` : ''}

            <div class="form-group">
              <label for="zikr-title">عنوان الذكر <span class="required">*</span></label>
              <input type="text" id="zikr-title" class="form-control" required 
                placeholder="مثال: دعاء التيسير، ذكر الصباح" 
                value="${existingItem ? this.escapeHTML(existingItem.title) : ''}">
            </div>

            <div class="form-group">
              <label for="zikr-collection">التصنيف <span class="required">*</span></label>
              <select id="zikr-collection" class="form-control" required>
                ${collectionOptions}
              </select>
            </div>

            <div class="form-group">
              <label for="zikr-text">نص الذكر أو الدعاء كاملاً بالتشكيل <span class="required">*</span></label>
              <textarea id="zikr-text" class="form-control font-arabic-large" rows="5" required 
                placeholder="اكتب أو الصق نص الذكر هنا...">${existingItem ? this.escapeHTML(existingItem.text) : ''}</textarea>
            </div>

            <div class="form-row">
              <div class="form-group col-half">
                <label for="zikr-source">المصدر أو المرجع (اختياري)</label>
                <input type="text" id="zikr-source" class="form-control" 
                  placeholder="مثال: صحيح البخاري، دعاء قرآني" 
                  value="${existingItem ? this.escapeHTML(existingItem.source || '') : ''}">
              </div>

              <div class="form-group col-half">
                <label for="zikr-reps">عدد مرات التكرار</label>
                <input type="number" id="zikr-reps" class="form-control" min="1" max="1000" 
                  value="${existingItem ? existingItem.repetitions : 1}">
              </div>
            </div>
          </form>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="modal-cancel">إلغاء</button>
            <button type="submit" form="zikr-form" class="btn btn-primary">${isEdit ? 'حفظ التعديلات' : 'إضافة الذكر'}</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const close = (data) => {
        modal.classList.add('modal-closing');
        setTimeout(() => modal.remove(), 200);
        resolve(data);
      };

      modal.querySelector('#modal-close').addEventListener('click', () => close(null));
      modal.querySelector('#modal-cancel').addEventListener('click', () => close(null));

      const form = modal.querySelector('#zikr-form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = modal.querySelector('#zikr-title').value.trim();
        const text = modal.querySelector('#zikr-text').value.trim();
        const collectionId = modal.querySelector('#zikr-collection').value;
        const source = modal.querySelector('#zikr-source').value.trim();
        const repetitions = parseInt(modal.querySelector('#zikr-reps').value, 10) || 1;

        if (!title || !text) {
          UIComponents.showToast('يرجى ملء جميع الحقول المطلوبة.', 'error');
          return;
        }

        close({
          title,
          text,
          collectionId,
          source: source || (existingItem?.isCustom ? 'محتوى شخصي أضافه المستخدم' : ''),
          repetitions
        });
      });
    });
  }

  /**
   * نافذة تعديل وتقسيم المقاطع يدوياً (للحفظ)
   */
  static async showSegmentEditor(segments, itemTitle) {
    return new Promise((resolve) => {
      let currentSegments = [...segments];

      const modal = document.createElement('div');
      modal.className = 'modal-backdrop';

      const renderSegmentList = () => {
        return currentSegments.map((seg, idx) => `
          <div class="segment-edit-item" data-index="${idx}">
            <div class="segment-edit-header">
              <span class="segment-num">المقطع ${idx + 1}</span>
              <div class="segment-actions">
                ${idx < currentSegments.length - 1 ? `
                  <button type="button" class="btn-sm btn-outline btn-merge" data-index="${idx}" title="دمج مع المقطع التالي">
                    دمج مع التالي
                  </button>
                ` : ''}
              </div>
            </div>
            <div class="segment-text-preview font-arabic">${this.escapeHTML(seg)}</div>
            <div class="segment-split-helper">
              <input type="text" class="form-control form-control-sm split-input" 
                placeholder="أو اكتب كلمة لبدء مقطع جديد عندها..." data-index="${idx}">
              <button type="button" class="btn-sm btn-secondary btn-split" data-index="${idx}">تقسيم</button>
            </div>
          </div>
        `).join('');
      };

      modal.innerHTML = `
        <div class="modal-dialog modal-lg">
          <div class="modal-header">
            <h3>تعديل حدود المقاطع: ${this.escapeHTML(itemTitle)}</h3>
            <button class="btn-icon" id="seg-close">${renderIcon('close')}</button>
          </div>
          <div class="modal-body">
            <p class="text-muted">يمكنك دمج المقاطع المتتالية أو تقسيم مقطع عند كلمة معينة لتسهيل الحفظ والاسترجاع وفق وتيرتك:</p>
            <div id="segment-editor-list" class="segment-editor-list">
              ${renderSegmentList()}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" id="seg-reset">إعادة التقسيم التلقائي</button>
            <button type="button" class="btn btn-secondary" id="seg-cancel">إلغاء</button>
            <button type="button" class="btn btn-primary" id="seg-save">حفظ المقاطع</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const attachEvents = () => {
        const container = modal.querySelector('#segment-editor-list');
        container.innerHTML = renderSegmentList();

        // أزرار الدمج
        container.querySelectorAll('.btn-merge').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            if (idx >= 0 && idx < currentSegments.length - 1) {
              const merged = currentSegments[idx] + ' ' + currentSegments[idx + 1];
              currentSegments.splice(idx, 2, merged);
              attachEvents();
            }
          });
        });

        // أزرار التقسيم
        container.querySelectorAll('.btn-split').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            const input = container.querySelector(`.split-input[data-index="${idx}"]`);
            const splitWord = input.value.trim();
            if (!splitWord) {
              UIComponents.showToast('يرجى إدخال الكلمة التي تريد التقسيم عندها.', 'error');
              return;
            }

            const seg = currentSegments[idx];
            const words = seg.split(/\s+/);
            const wordIdx = words.findIndex(w => w.includes(splitWord));

            if (wordIdx > 0 && wordIdx < words.length) {
              const part1 = words.slice(0, wordIdx).join(' ');
              const part2 = words.slice(wordIdx).join(' ');
              currentSegments.splice(idx, 1, part1, part2);
              attachEvents();
            } else {
              UIComponents.showToast('لم يتم العثور على الكلمة داخل المقطع أو أنها الكلمة الأولى.', 'error');
            }
          });
        });
      };

      attachEvents();

      const close = (data) => {
        modal.classList.add('modal-closing');
        setTimeout(() => modal.remove(), 200);
        resolve(data);
      };

      modal.querySelector('#seg-close').addEventListener('click', () => close(null));
      modal.querySelector('#seg-cancel').addEventListener('click', () => close(null));
      modal.querySelector('#seg-reset').addEventListener('click', () => close({ reset: true }));
      modal.querySelector('#seg-save').addEventListener('click', () => close({ segments: currentSegments }));
    });
  }

  /**
   * تعقيم النصوص لتفادي حقن XSS
   */
  static escapeHTML(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * تحويل الأرقام إلى أرقام عربية مشرقية (اختياري للواجهة)
   */
  static toArabicNumerals(num) {
    if (num === null || num === undefined) return '';
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return String(num).replace(/[0-9]/g, w => arabicDigits[+w]);
  }
}
