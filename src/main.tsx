import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  installErrorReporter,
  initSentry,
} from '@mister-guiiug/dev-pwa-config/react/observability';
import { App } from './App.tsx';
import { I18nProvider } from './i18n/index.ts';
import { SocleLabels } from './i18n/SocleLabels.tsx';
import { useAppStore } from './store/useAppStore.ts';
import './index.css';

// Observabilité partagée : ring-buffer localStorage + listeners globaux.
// L'ErrorBoundary maison (avec sauvegarde locale) reste en place dans App.
installErrorReporter();
void initSentry({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  // La version applicative, pour qu'une erreur soit rattachée à un build
  // précis : sans elle, toutes les traces se mélangent dans un seul tas.
  release: __APP_VERSION__,
  // `loader` REND L'IMPORT ANALYSABLE PAR VITE, et c'est ce qui permet au
  // `manualChunks` de le ranger dans son propre morceau. Sans lui, le socle
  // utilise un spécificateur volontairement non analysable — nécessaire tant
  // que la peer n'est pas installée, inutile maintenant qu'elle l'est.
  //
  // Rien ne part tant qu'aucun DSN n'est posé : `initSentry` rend `null` AVANT
  // l'import. Et le morceau est hors du précache du service worker, sans quoi
  // il serait téléchargé quand même (cf. `globIgnores` dans vite.config.ts).
  loader: () => import('@sentry/react'),
});

// Applique le thème persisté au plus tôt (complète le script anti-FOUC).
document.documentElement.dataset.theme =
  useAppStore.getState().data.settings.theme;

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Élément racine #root introuvable.');

createRoot(rootEl).render(
  <StrictMode>
    <I18nProvider>
      <SocleLabels>
        <App />
      </SocleLabels>
    </I18nProvider>
  </StrictMode>
);
