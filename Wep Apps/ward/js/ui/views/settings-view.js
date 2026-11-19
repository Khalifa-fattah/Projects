/**
 * تطبيق وِرد | Wird
 * واجهة الإعدادات والنسخ الاحتياطي والاستعادة والسمات والمظهر
 */

import { db } from '../../db.js';
import { BackupService } from '../../services/backup-service.js';
import { AzkarService } from '../../services/azkar-service.js';
import { renderIcon } from '../icons.js';
import { UIComponents } from '../components.js';

export class SettingsView {
  static async render(container, navigateTo) {
    const currentTheme = localStorage.getItem('wird_theme') || 'system';
    const currentFontSize = localStorage.getItem('wird_font_size') || 'normal';

    container.innerHTML = `
      <div class="settings-view fade-in">
        <header class="view-header">
          <h1 class="view-title">الإعدادات</h1>
          <p class="view-subtitle">تخصيص مظهر التطبيق وإدارة بياناتك المحلية ونسخك الاحتياطية</p>
        </header>

        <!-- قسم المظهر والسمات -->
        <section class="settings-group">
          <h2 class="settings-group-title">
            <span>${renderIcon('sun')}</span> المظهر والعرض
          </h2>
          <div class="settings-card">
            <div class="settings-row">
              <div class="setting-info">
                <span class="setting-name">سمة الألوان</span>
                <span class="setting-desc">اختر السمة الفاتحة أو الداكنة أو تتبع سمة الجهاز</span>
              </div>
              <div class="theme-selector-btns">
                <button class="btn-theme-choice ${currentTheme === 'light' ? 'active' : ''}" data-theme="light">
                  ${renderIcon('sun')} فاتح
                </button>
                <button class="btn-theme-choice ${currentTheme === 'dark' ? 'active' : ''}" data-theme="dark">
                  ${renderIcon('moon')} داكن
                </button>
                <button class="btn-theme-choice ${currentTheme === 'system' ? 'active' : ''}" data-theme="system">
                  ${renderIcon('settings')} تلقائي
                </button>
              </div>
            </div>

            <div class="settings-row">
              <div class="setting-info">
                <span class="setting-name">حجم الخط العربي</span>
                <span class="setting-desc">حجم خط نصوص الأذكار في القراءة والحفظ</span>
              </div>
              <div class="theme-selector-btns">
                <button class="btn-font-choice ${currentFontSize === 'normal' ? 'active' : ''}" data-size="normal">
                  عادي
                </button>
                <button class="btn-font-choice ${currentFontSize === 'large' ? 'active' : ''}" data-size="large">
                  كبير
                </button>
                <button class="btn-font-choice ${currentFontSize === 'huge' ? 'active' : ''}" data-size="huge">
                  كبير جداً
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- قسم النسخ الاحتياطي والاستعادة -->
        <section class="settings-group">
          <h2 class="settings-group-title">
            <span>${renderIcon('download')}</span> النسخ الاحتياطي والاستعادة
          </h2>
          <div class="settings-card">
            <div class="settings-row">
              <div class="setting-info">
                <span class="setting-name">تصدير نسخة احتياطية</span>
                <span class="setting-desc">تنزيل ملف JSON آمن يحتوي على أذكارك الشخصية والمفضلة وسجل المراجعات وترتيبك</span>
              </div>
              <button class="btn btn-outline btn-sm" id="btn-export-backup">
                ${renderIcon('download')} تصدير ملف JSON
              </button>
            </div>

            <div class="settings-row">
              <div class="setting-info">
                <span class="setting-name">استعادة من نسخة احتياطية</span>
                <span class="setting-desc">استعادة بياناتك من ملف سابق بعد التحقق التام من سلامته وبصمته</span>
              </div>
              <div>
                <input type="file" id="file-import-input" accept=".json,application/json" style="display:none">
                <button class="btn btn-outline btn-sm" id="btn-trigger-import">
                  ${renderIcon('upload')} استيراد ملف
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- قسم تنظيم المجموعات وإعادة الضبط -->
        <section class="settings-group">
          <h2 class="settings-group-title">
            <span>${renderIcon('refresh')}</span> الترتيب وإعادة الضبط
          </h2>
          <div class="settings-card">
            <div class="settings-row">
              <div class="setting-info">
                <span class="setting-name">استعادة الترتيب الافتراضي لجميع المجموعات</span>
                <span class="setting-desc">إعادة ترتيب أذكار جميع الأوراد إلى ترتيبها الافتراضي المعتمد</span>
              </div>
              <button class="btn btn-secondary btn-sm" id="btn-reset-all-orders">
                استعادة الترتيب الافتراضي
              </button>
            </div>

            <div class="settings-row">
              <div class="setting-info text-danger">
                <span class="setting-name text-danger">مسح جميع البيانات المحلية</span>
                <span class="setting-desc">حذف الأذكار الشخصية وسجل المراجعات والبدء من جديد</span>
              </div>
              <button class="btn btn-danger btn-sm" id="btn-clear-all-data">
                ${renderIcon('trash')} مسح البيانات
              </button>
            </div>
          </div>
        </section>

        <!-- قسم معلومات التطبيق والخصوصية -->
        <section class="settings-group">
          <h2 class="settings-group-title">
            <span>${renderIcon('info')}</span> عن تطبيق «وِرد»
          </h2>
          <div class="settings-card about-card">
            <div class="about-header">
              <div class="about-logo">وِرد</div>
              <div>
                <h3 class="about-app-title">وِرد | Wird</h3>
                <span class="about-version">الإصدار 1.0.0 • تطبيق ويب عربي مستقل</span>
              </div>
            </div>
            <div class="about-text">
              <p>«وِرد» تطبيق ويب خفيف ومستقل صُمم ليعمل محلياً بالكامل دون الحاجة لأي خوادم سحابية أو تسجيل دخول أو اتصال بالإنترنت.</p>
              <div class="about-privacy-badge">
                <strong>الخصوصية ومكان التخزين:</strong> جميع بياناتك وأذكارك وسجلات مراجعتك مخزنة محلياً في قاعدة بيانات المتصفح (IndexedDB) على جهازك فقط، ولا تُرسل لأي جهة خارجية.
              </div>
              <p class="about-webview-note">
                التطبيق متوافق تماماً مع متصفحات الهواتف الحديثة وبيئات WebView (مثل حزم WebIntoApp).
              </p>
            </div>
          </div>
        </section>
      </div>
    `;

    // تبديل السمة
    container.querySelectorAll('.btn-theme-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        const selected = btn.dataset.theme;
        container.querySelectorAll('.btn-theme-choice').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        localStorage.setItem('wird_theme', selected);
        window.applyTheme?.(selected);
        UIComponents.showToast('تم حفظ سمة المظهر بنجاح.', 'info', 1500);
      });
    });

    // تبديل حجم الخط
    container.querySelectorAll('.btn-font-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        const size = btn.dataset.size;
        container.querySelectorAll('.btn-font-choice').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        localStorage.setItem('wird_font_size', size);
        window.applyFontSize?.(size);
        UIComponents.showToast('تم تعديل حجم الخط.', 'info', 1500);
      });
    });

    // تصدير النسخة الاحتياطية
    container.querySelector('#btn-export-backup').addEventListener('click', async () => {
      try {
        await BackupService.downloadBackupFile();
        UIComponents.showToast('تم تنزيل النسخة الاحتياطية بنجاح.', 'success');
      } catch (err) {
        UIComponents.showToast('حدث خطأ أثناء تصدير النسخة الاحتياطية.', 'error');
      }
    });

    // استيراد النسخة الاحتياطية
    const fileInput = container.querySelector('#file-import-input');
    const triggerBtn = container.querySelector('#btn-trigger-import');

    triggerBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        let json = null;
        try {
          json = JSON.parse(text);
        } catch (jsonErr) {
          UIComponents.showToast('الملف المختار ليس بصيغة JSON صحيحة.', 'error');
          return;
        }

        const validation = BackupService.validateBackup(json);
        if (!validation.isValid) {
          UIComponents.showToast(validation.error, 'error', 4000);
          return;
        }

        const { summary, validatedData } = validation;
        const msg = `
ملخص النسخة الاحتياطية:
• أذكار شخصية: ${UIComponents.toArabicNumerals(summary.personalCount)}
• أذكار معدلة: ${UIComponents.toArabicNumerals(summary.modifiedCount)}
• مفضلة: ${UIComponents.toArabicNumerals(summary.favoritesCount)}
• سجلات مراجعة: ${UIComponents.toArabicNumerals(summary.reviewsCount)}
تاريخ التصدير: ${new Date(summary.exportedAt).toLocaleDateString('ar-SA')}

هل أنت متأكد من استعادة هذه البيانات إلى جهازك؟
        `.trim();

        const confirmed = await UIComponents.showConfirm('تأكيد استعادة النسخة الاحتياطية', msg, 'استعادة البيانات', 'إلغاء');

        if (confirmed) {
          const restoreResult = await BackupService.restoreBackup(validatedData);
          if (restoreResult.success) {
            UIComponents.showToast('تمت استعادة البيانات بنجاح تام!', 'success');
            setTimeout(() => {
              window.location.reload();
            }, 1200);
          } else {
            UIComponents.showToast(`فشلت الاستعادة: ${restoreResult.error}`, 'error');
          }
        }
      } catch (err) {
        UIComponents.showToast('تعذر قراءة ملف النسخة الاحتياطية.', 'error');
      } finally {
        fileInput.value = '';
      }
    });

    // استعادة ترتيب جميع المجموعات
    container.querySelector('#btn-reset-all-orders').addEventListener('click', async () => {
      const confirmed = await UIComponents.showConfirm(
        'استعادة ترتيب المجموعات',
        'هل تريد استعادة الترتيب الافتراضي لجميع مجموعات الأذكار؟'
      );
      if (confirmed) {
        const collections = await db.getAll('collections');
        for (const col of collections) {
          col.customOrder = [...col.defaultOrder];
          await db.put('collections', col);
        }
        UIComponents.showToast('تمت استعادة الترتيب الافتراضي لجميع المجموعات.', 'success');
      }
    });

    // مسح جميع البيانات
    container.querySelector('#btn-clear-all-data').addEventListener('click', async () => {
      const confirmed = await UIComponents.showConfirm(
        'تحذير أخير: مسح جميع البيانات',
        'سيتم مسح الأذكار الشخصية وجميع سجلات المراجعات والتقدم والبدء من جديد. هل أنت متأكد؟',
        'مسح كل شيء',
        'إلغاء'
      );

      if (confirmed) {
        await db.clear('items');
        await db.clear('collections');
        await db.clear('learning_states');
        await db.clear('review_schedules');
        await db.clear('review_logs');
        await db.clear('custom_segments');
        await db.clear('settings');
        localStorage.clear();

        UIComponents.showToast('تم مسح البيانات بنجاح. جاري إعادة تشغيل التطبيق...', 'info');
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    });
  }
}
