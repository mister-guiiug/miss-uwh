import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { useAppStore } from './store/useAppStore.ts';
import './index.css';

// Applique le thème persisté au plus tôt (complète le script anti-FOUC).
document.documentElement.dataset.theme =
  useAppStore.getState().data.settings.theme;

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Élément racine #root introuvable.');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
