import { lazy, Suspense, useState } from 'react';
import {
  HashRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { AppFooter } from '@mister-guiiug/dev-pwa-config/react/app-footer';
import { ConsentBanner } from '@mister-guiiug/dev-pwa-config/react/consent-banner';
import { usePageViews } from '@mister-guiiug/dev-pwa-config/react/use-page-views';
import { useIdlePrefetch } from '@mister-guiiug/dev-pwa-config/react/use-prefetch';
import { repoUrl } from '@mister-guiiug/dev-pwa-config/apps-catalog';
import { useAppStore } from './store/useAppStore.ts';
import { AuthProvider } from './auth/AuthContext.tsx';
import { AuthGate } from './auth/AuthGate.tsx';
import { SupabaseSync } from './backend/SupabaseSync.tsx';
import { SyncBanner } from './backend/SyncBanner.tsx';
import { AppHeader } from './shared/components/AppHeader.tsx';
import { LensNav } from './shared/components/LensNav.tsx';
import { LensGuard } from './shared/components/LensGuard.tsx';
import { ErrorBoundary } from './shared/components/ErrorBoundary.tsx';
import { ToastViewport } from './shared/components/ToastViewport.tsx';
import { UpdatePrompt } from './pwa/UpdatePrompt.tsx';
import { Onboarding } from './features/onboarding/Onboarding.tsx';
import { HomeLauncher } from './features/home/HomeLauncher.tsx';
import { GlobalSearch } from './features/search/GlobalSearch.tsx';
import { NotificationCenter } from './features/alerts/NotificationCenter.tsx';
import { useAlerts } from './features/alerts/useAlerts.ts';
import { MembersScreen } from './features/adherents/MembersScreen.tsx';
import { FamillesScreen } from './features/adherents/FamillesScreen.tsx';
import { CotisationsScreen } from './features/adherents/CotisationsScreen.tsx';
import { EvenementsScreen } from './features/vieclub/EvenementsScreen.tsx';
import { AnnoncesScreen } from './features/vieclub/AnnoncesScreen.tsx';
import { TournamentsScreen } from './features/tournois/TournamentsScreen.tsx';
import { SeancesScreen } from './features/entrainements/SeancesScreen.tsx';
import { ExercicesScreen } from './features/entrainements/ExercicesScreen.tsx';
import { StrategiesScreen } from './features/entrainements/StrategiesScreen.tsx';
import { ArbitrageScreen } from './features/entrainements/ArbitrageScreen.tsx';
import { GalerieScreen } from './features/vieclub/GalerieScreen.tsx';
import { useActiveLens } from './shared/hooks/useActiveLens.ts';
import { lensById } from './shared/lib/lenses.ts';
import { BilanScreen } from './features/bilan/BilanScreen.tsx';
import { useI18n, type TKey } from './i18n/index.ts';

// CHAQUE IMPORT D'UN ÉCRAN DE LA BARRE EST NOMMÉ, parce qu'il sert DEUX FOIS :
// à `lazy` ci-dessous, et au chargeur composé (`chargeLesOngletsDuLens`) que
// `Shell` confie au socle pour l'inactivité. Deux `import()` du même
// spécificateur ne téléchargent qu'une fois — le registre de modules
// dédoublonne — mais encore faut-il que ce soit LITTÉRALEMENT le même
// spécificateur, sinon le bundler émet deux morceaux et le préchargement ne
// sert plus à rien.
const chargeJournal = () => import('./features/journal/JournalScreen.tsx');
const chargeCategories = () =>
  import('./features/categories/CategoriesScreen.tsx');
const chargeSeasons = () => import('./features/seasons/SeasonsScreen.tsx');
const chargeSynthese = () => import('./features/synthese/SyntheseScreen.tsx');

/**
 * Les quatre écrans PARESSEUX qu'un onglet de `LensNav` peut atteindre — et eux
 * seuls. Ce sont les onglets du lens Finances ; les autres lens rendent des
 * écrans déjà présents dans le bundle d'entrée. `AuditScreen`, `SettingsScreen`
 * et `MembersRolesScreen` restent dehors : on y arrive depuis l'en-tête ou
 * depuis les Réglages, pas d'un onglet de la barre.
 */
const CHARGEURS_DES_ONGLETS = [
  chargeJournal,
  chargeCategories,
  chargeSynthese,
  chargeSeasons,
];

/**
 * UN SEUL chargeur pour les quatre, CONSTANTE DE MODULE : le socle ne lance un
 * chargeur qu'une fois et le reconnaît à son IDENTITÉ — écrit en ligne dans
 * `Shell`, il serait neuf à chaque montage, et rien ne dédoublonnerait plus.
 * `allSettled`, pas `all` : un morceau qui manque n'empêche pas les autres.
 */
const chargeLesOngletsDuLens = () =>
  Promise.allSettled(CHARGEURS_DES_ONGLETS.map(charge => charge()));

const JournalScreen = lazy(() =>
  chargeJournal().then(m => ({ default: m.JournalScreen }))
);
const CategoriesScreen = lazy(() =>
  chargeCategories().then(m => ({ default: m.CategoriesScreen }))
);
const SeasonsScreen = lazy(() =>
  chargeSeasons().then(m => ({ default: m.SeasonsScreen }))
);
const SyntheseScreen = lazy(() =>
  chargeSynthese().then(m => ({ default: m.SyntheseScreen }))
);
const AuditScreen = lazy(() =>
  import('./features/audit/AuditScreen.tsx').then(m => ({
    default: m.AuditScreen,
  }))
);
const SettingsScreen = lazy(() =>
  import('./features/settings/SettingsScreen.tsx').then(m => ({
    default: m.SettingsScreen,
  }))
);
const MembersRolesScreen = lazy(() =>
  import('./features/admin/MembersRolesScreen.tsx').then(m => ({
    default: m.MembersRolesScreen,
  }))
);

/** Clés i18n des titres de routes GLOBALES (hors lens). Le titre d'un lens vient de sa config. */
const GLOBAL_TITLE_KEYS: Record<string, TKey> = {
  '/settings': 'app.titles.settings',
  '/audit': 'app.titles.audit',
  '/members': 'app.titles.members',
};

/**
 * Exportée POUR ÊTRE ÉPROUVÉE : `App.nav.test.tsx` la monte face à un écran
 * dont il décide lui-même de l'arrivée, ce qu'on ne peut pas faire à travers
 * `App` sans mettre la main dans le registre de modules.
 */
export function Shell() {
  /*
   * PRÉCHARGE LES ONGLETS DU LENS DÈS QUE LE FIL PRINCIPAL SOUFFLE — par le
   * socle. Sans préchargement, le morceau d'un écran n'est demandé qu'AU CLIC :
   * un aller-retour réseau complet, payé au pire moment. Mesuré à froid le
   * 20/09/2026 sur deux sites publiés du parc, première visite, service worker
   * pas encore installé : 133 ms sur mister-settle, 161 ms sur mister-molkky.
   *
   * Toute la décision vit dans `prefetch.js` du socle : une exécution par
   * chargeur, rejets avalés — au clic, `lazy` redemandera le morceau et c'est
   * LUI qui portera l'erreur, dans son propre `Suspense` —, rien chez qui a
   * posé `saveData` ni sur une connexion 2g, et un délai minuté là où
   * `requestIdleCallback` manque (Safari), plutôt qu'un appel immédiat qui
   * chargerait tout au démarrage.
   *
   * Que le clic RÉPONDE pendant ce temps est une autre affaire, réglée plus
   * bas : le `key={pathname}` de `ErrorBoundary` re-monte la frontière
   * `Suspense` à chaque navigation, donc le « Chargement… » paraît même au
   * sein de la transition de react-router (`App.nav.test.tsx` le verrouille).
   * Et ce préchargement n'entre PAS dans `bundleBudget.preloadGzipKb` : ce
   * budget ne compte que ce qui est `modulepreload` dans le document, et un
   * `import()` tardif n'y entre pas.
   */
  useIdlePrefetch(chargeLesOngletsDuLens);
  const lens = useActiveLens();
  const { t } = useI18n();
  const { pathname } = useLocation();
  const globalKey = GLOBAL_TITLE_KEYS[pathname];
  const title = lens
    ? t(lens.label as TKey)
    : globalKey
      ? t(globalKey)
      : 'Miss UWH';
  const [searchOpen, setSearchOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const alerts = useAlerts();

  /*
   * UNE VUE DE PAGE PAR NAVIGATION — ni zéro, ni deux. Sans ce hook, sous
   * `HashRouter`, toute la navigation de l'app serait invisible et la durée de
   * session fausse. Et si on laissait PostHog compter lui-même, chaque
   * navigation serait comptée DEUX fois : il envoie une vue au chargement ET à
   * chaque changement d'historique. Le socle pose donc
   * `capture_pageview: false` et laisse ce hook faire seul. Il ne fait rien
   * tant que le consentement n'est pas accordé — il se monte sans condition.
   *
   * `pathname` est le chemin DANS le hash (`/journal`, pas `#/journal`) : c'est
   * lui qui part en `$pathname`.
   */
  usePageViews(pathname);

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      {/* En-tête + bandeau de synchro dans un même bloc collant : le bandeau
          apparaît SOUS l'en-tête (dans le flux) et ne recouvre jamais rien —
          essentiel sur mobile. */}
      <div className="sticky top-0 z-30">
        <AppHeader
          title={title}
          lens={lens}
          onSearch={() => setSearchOpen(true)}
          onAlerts={() => setAlertsOpen(true)}
          alertCount={alerts.length}
        />
        <SyncBanner />
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationCenter
        open={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        alerts={alerts}
      />
      <main className="flex-1">
        {/* Boundary par route, re-montée à chaque navigation (key=pathname) :
            un crash d'écran n'emporte ni l'en-tête ni la navigation. */}
        <ErrorBoundary level="route" key={pathname}>
          <Suspense
            fallback={
              <p className="p-8 text-center text-[var(--uwh-text-soft)]">
                {t('common.loading')}
              </p>
            }
          >
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      {/* HORS des routes : le code source et le soutien sont ainsi sur le
          premier écran comme sur les Réglages — la règle famille. Rendus
          depuis un écran, ils ne valaient que pour lui. L'URL du dépôt vient
          du catalogue, plus d'une constante recopiée. */}
      <AppFooter
        version
        issues
        className="no-print px-4 pb-4"
        repoUrl={repoUrl('miss-uwh')}
        sourceLabel={t('app.footer.source')}
        sponsorLabel={t('app.footer.sponsor')}
      />
      {lens && <LensNav lens={lens} />}
    </div>
  );
}

function Inner() {
  const onboarded = useAppStore(s => s.data.onboarded);
  if (!onboarded) return <Onboarding />;

  return (
    <HashRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<HomeLauncher />} />

          {/* 💶 Finances */}
          <Route
            path="finances"
            element={
              <LensGuard lens={lensById('finances')!}>
                <Outlet />
              </LensGuard>
            }
          >
            <Route index element={<BilanScreen />} />
            <Route path="journal" element={<JournalScreen />} />
            <Route path="categories" element={<CategoriesScreen />} />
            <Route path="synthese" element={<SyntheseScreen />} />
            <Route path="seasons" element={<SeasonsScreen />} />
          </Route>

          {/* 👥 Adhérents (scaffold) */}
          <Route
            path="adherents"
            element={
              <LensGuard lens={lensById('adherents')!}>
                <Outlet />
              </LensGuard>
            }
          >
            <Route index element={<MembersScreen />} />
            <Route path="familles" element={<FamillesScreen />} />
            <Route
              path="encadrement"
              element={<MembersScreen roleFilter="encadrant" />}
            />
            <Route path="cotisations" element={<CotisationsScreen />} />
          </Route>

          {/* 🏑 Entraînements / Stratégie (scaffold) */}
          <Route
            path="entrainements"
            element={
              <LensGuard lens={lensById('entrainements')!}>
                <Outlet />
              </LensGuard>
            }
          >
            <Route index element={<SeancesScreen />} />
            <Route path="exercices" element={<ExercicesScreen />} />
            <Route path="strategie" element={<StrategiesScreen />} />
            <Route path="arbitrage" element={<ArbitrageScreen />} />
          </Route>

          {/* 🎉 Vie du club (scaffold) */}
          <Route
            path="vie-club"
            element={
              <LensGuard lens={lensById('vie-club')!}>
                <Outlet />
              </LensGuard>
            }
          >
            <Route index element={<EvenementsScreen />} />
            <Route path="tournois" element={<TournamentsScreen />} />
            <Route path="annonces" element={<AnnoncesScreen />} />
            <Route path="galerie" element={<GalerieScreen />} />
          </Route>

          {/* Routes globales (hors lens) */}
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="members" element={<MembersRolesScreen />} />
          <Route path="audit" element={<AuditScreen />} />

          {/* Redirections des anciens chemins (bookmarks / raccourcis PWA) */}
          <Route
            path="journal"
            element={<Navigate to="/finances/journal" replace />}
          />
          <Route
            path="categories"
            element={<Navigate to="/finances/categories" replace />}
          />
          <Route
            path="synthese"
            element={<Navigate to="/finances/synthese" replace />}
          />
          <Route
            path="seasons"
            element={<Navigate to="/finances/seasons" replace />}
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export function App() {
  return (
    <ErrorBoundary level="app">
      <AuthProvider>
        <AuthGate>
          <SupabaseSync />
          <Inner />
        </AuthGate>
      </AuthProvider>
      {/* Hors AuthGate : les toasts s'affichent aussi au login / à l'amorçage. */}
      <ToastViewport />
      {/*
        HORS DE LA PORTE, ET C'EST TOUT L'INTÉRÊT. Ce composant n'affiche pas
        seulement le bandeau « nouvelle version » : c'est LUI qui appelle
        `registerSW`. Rendu dans le gabarit d'écran, il vivait derrière
        `AuthGate` ET derrière l'onboarding — donc AUCUN service worker n'était
        enregistré tant qu'on ne s'était pas connecté, et rien n'était mis en
        cache. Vérifié le 2026-09-10 sur la production : sur une visite sans
        session, `navigator.serviceWorker.ready` n'aboutit jamais et un
        rechargement hors ligne ne sert rien du tout.

        À la racine, la mise en cache commence dès la première visite — y
        compris pour qui hésite encore devant l'écran de connexion.
      */}
      <UpdatePrompt />
      {/*
        HORS DE LA PORTE, POUR LA MÊME RAISON QUE `UpdatePrompt` JUSTE AU-DESSUS.
        Monté dans `Shell`, le bandeau vivait derrière `AuthGate` ET derrière
        l'onboarding : un visiteur non connecté n'a JAMAIS vu la question.
        Vérifié le 16/09/2026 sur la production — `[data-dwc="consent-banner"]`
        absent du document sur l'écran de connexion. Cette app n'aurait donc
        rien mesuré, sa variable posée ou non.

        `sticky bottom-0` et non `fixed` : le bandeau reste DANS le flux, il ne
        se superpose qu'à ce qui défile sous lui, et il ne piège pas le focus.
        Une boîte modale pour obtenir un consentement est précisément la figure
        que le RGPD nomme « dark pattern ». Sans ce calage il atterrirait en
        bas du document, sous la ligne de flottaison de l'écran de connexion —
        aussi invisible qu'avant, mais pour une autre raison.

        Pas de `policyHref` : cette app n'a pas de page de confidentialité. Le
        jour où elle en aura une, c'est ici que le lien se branche.
      */}
      <div className="no-print sticky bottom-0 mx-auto w-full max-w-2xl px-4 pb-3">
        <ConsentBanner
          posthogKey={import.meta.env.VITE_POSTHOG_KEY}
          loader={() => import('posthog-js/dist/module.slim.js')}
        />
      </div>
    </ErrorBoundary>
  );
}
