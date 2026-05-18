import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppDemo from './AppDemo.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppDemo />
  </StrictMode>,
);
