import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppDemo from './AppDemo.jsx';
import { applyTheme, getStoredTheme } from './lib/theme.js';
import { registerServiceWorker } from './lib/pwa.js';

applyTheme(getStoredTheme());
registerServiceWorker();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppDemo />
  </StrictMode>,
);
