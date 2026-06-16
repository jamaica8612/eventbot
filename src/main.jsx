import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './v2/styles/tokens.css';
import AppV2 from './v2/AppV2.jsx';
import { registerServiceWorker } from './pwa.js';

registerServiceWorker();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppV2 />
  </StrictMode>,
);
