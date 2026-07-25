import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  installErrorReporter,
  initSentry,
} from '@mister-guiiug/dev-wpa-config/react/observability';
import { App } from './App.tsx';
import { I18nProvider } from './i18n/index.ts';
import { useAppStore } from './store/useAppStore.ts';
import './index.css';

// Observabilité partagée : ring-buffer localStorage + listeners globaux.
// L'ErrorBoundary maison (avec sauvegarde locale) reste en place dans App.
installErrorReporter();
void initSentry({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
});

// Applique le thème persisté au plus tôt (complète le script anti-FOUC).
document.documentElement.dataset.theme =
  useAppStore.getState().data.settings.theme;

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Élément racine #root introuvable.');

createRoot(rootEl).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>
);
