import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const root = createRoot(document.getElementById('root'));
const useV2 = new URLSearchParams(window.location.search).has('v2');

if (useV2) {
  // v2 디자인 미리보기 (?v2). 단계별로 갤러리 → AppV2로 교체된다.
  Promise.all([
    import('./v2/styles/tokens.css'),
    import('./v2/_Gallery.jsx'),
  ]).then(([, mod]) => {
    const V2 = mod.default;
    root.render(
      <StrictMode>
        <V2 />
      </StrictMode>,
    );
  });
} else {
  Promise.all([
    import('./App.jsx'),
    import('./styles.css'),
    import('./pwa.js'),
  ]).then(([appMod, , pwaMod]) => {
    const App = appMod.default;
    pwaMod.registerServiceWorker();
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
}
