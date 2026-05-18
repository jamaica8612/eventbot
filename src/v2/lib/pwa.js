/* v2 전용 서비스 워커 등록.
   v1의 pwa.js는 과거 킬스위치 목적으로 모든 SW를 unregister 한다.
   v2 페이지(v2-shell.html)에서는 이 모듈이 register 하여 오프라인 셸과
   설치 가능한(PWA) 경험을 제공한다. */
export function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (typeof window === 'undefined') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .catch((err) => console.warn('[v2] service worker registration failed', err));
  });
}
