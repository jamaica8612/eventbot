export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 설치 가능성만 보강하는 기능이라 등록 실패는 앱 사용을 막지 않는다.
    });
  });
}
