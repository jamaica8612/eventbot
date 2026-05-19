import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './v2/tokens.css';   /* v2 디자인 토큰 — .v2 래퍼 안에서만 적용 */
import './styles.css';      /* v1 글로벌 스타일 (토큰만 v2 톤으로 매핑됨) */
import { registerServiceWorker } from './pwa.js';

registerServiceWorker();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
