import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { TouchHardeningProvider } from './providers/TouchHardeningProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TouchHardeningProvider>
      <App />
    </TouchHardeningProvider>
  </StrictMode>,
);
