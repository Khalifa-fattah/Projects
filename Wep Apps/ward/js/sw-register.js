/**
 * تطبيق وِرد | Wird
 * تسجيل Service Worker مع مراعاة بيئات WebView والمتصفحات المقيدة
 */

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // التحقق من البروتوكول لضمان دعم Service Worker
      const isSecure = window.location.protocol === 'https:' || 
                       window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';

      if (isSecure) {
        navigator.serviceWorker.register('./sw.js')
          .then((registration) => {
            console.log('تم تسجيل Service Worker بنجاح بنطاق:', registration.scope);
          })
          .catch((error) => {
            console.warn('تعذر تسجيل Service Worker (قد تكون البيئة WebView أو مقيدة):', error);
          });
      } else {
        console.info('Service Worker يتطلب بروتوكول HTTPS أو بيئة محلية آمنة.');
      }
    });
  } else {
    console.info('Service Worker غير مدعوم في هذا المتصفح أو بيئة WebView.');
  }
}

registerServiceWorker();
