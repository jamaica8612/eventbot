import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './v2/styles/tokens.css';
import AppV2 from './v2/AppV2.jsx';
import { unregisterEventbotServiceWorkers } from './pwa.js';

unregisterEventbotServiceWorkers();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppV2 />
  </StrictMode>,
);
