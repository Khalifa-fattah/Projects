/*
 * exit-guard.js — زر الرجوع (خصوصًا في تطبيق أندرويد المغلَّف WebView): لا يغلق التطبيق بالخطأ.
 *  1) رجوع أثناء فتح نافذة/قائمة/تفسير/شاشة مراجعة: يغلقها فقط (كضغط Esc).
 *  2) رجوع من تبويب غير «محفوظاتي»: يعود إلى «محفوظاتي».
 *  3) رجوع من «محفوظاتي»: رسالة تأكيد «البقاء / خروج».
 * الآلية: نضيف عنصرًا حارسًا في سجل المتصفح، فيُستهلك الرجوع بدل أن يغلق التطبيق، ثم نعيد إضافته.
 * ملاحظة: صفحة الويب لا تستطيع إغلاق تطبيق أندرويد بنفسها؛ عند «خروج» نزيل الحارس ونحاول window.close()،
 * وإن بقي التطبيق مفتوحًا فالضغطة التالية على رجوع تغلقه (لا حارس بعدها).
 */
(function (g) {
  'use strict';
  const NS = (g.Sahib = g.Sahib || {});
  const { UI, Review, TafsirUI, App } = NS;
  let allowExit = false;
  let asking = false;

  function pushGuard() {
    try { history.pushState({ sahibGuard: true }, ''); } catch (e) { /* بعض البيئات تمنع history */ }
  }

  function overlayOpen() {
    return UI.isModalOpen() || Review.isOpen() || TafsirUI.isVisible();
  }

  function activeTab() {
    const v = document.querySelector('section.view.active');
    return v ? v.id.replace('view-', '') : 'list';
  }

  async function askExit() {
    if (asking) return;
    asking = true;
    const pick = await UI.choice('هل تريد الخروج من التطبيق؟', [
      { label: 'البقاء', value: false, kind: 'ghost', focus: true },
      { label: 'خروج', value: true, kind: 'primary' }
    ], { icon: '﴾ ؟ ﴿' });
    asking = false;
    if (pick !== true) return;
    allowExit = true;                 // لا نعيد الحارس بعد الآن
    UI.toast('اضغط رجوع مرة أخرى للخروج');
    try { g.close(); } catch (e) { /* قد لا يسمح التطبيق المغلَّف */ }
    try { history.go(-1); } catch (e) { /* لا شيء */ }
  }

  function onPopState() {
    if (allowExit) return;
    pushGuard();                      // نستهلك الرجوع ونبقى في الصفحة
    if (asking) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return; }
    if (overlayOpen()) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return;
    }
    if (activeTab() !== 'list') { App.switchTab('list'); return; }
    askExit();
  }

  function init() {
    pushGuard();
    g.addEventListener('popstate', onPopState);
  }

  NS.ExitGuard = { init };
  init();
})(globalThis);
