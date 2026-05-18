/* ============================================================
   v2 Theme — light / dark 토글
   - localStorage 'eventbot.v2.theme' 에 저장
   - 적용은 html 요소의 data-theme 속성으로
   ============================================================ */
const STORAGE_KEY = 'eventbot.v2.theme';

export function getStoredTheme() {
  try { return localStorage.getItem(STORAGE_KEY) || 'dark'; }
  catch { return 'dark'; }
}

export function setStoredTheme(theme) {
  try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
}
