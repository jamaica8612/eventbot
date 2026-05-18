import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Showcase from './Showcase.jsx';
import { applyTheme, getStoredTheme } from './lib/theme.js';

applyTheme(getStoredTheme());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Showcase />
  </StrictMode>,
);
