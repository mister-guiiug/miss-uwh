import { lazy, Suspense } from 'react';
import {
  HashRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { useAppStore } from './store/useAppStore.ts';
import { AuthProvider } from './auth/AuthContext.tsx';
import { AuthGate } from './auth/AuthGate.tsx';
import { SupabaseSync } from './backend/SupabaseSync.tsx';
import { AppHeader } from './shared/components/AppHeader.tsx';
import { LensNav } from './shared/components/LensNav.tsx';
import { LensGuard } from './shared/components/LensGuard.tsx';
import { UpdatePrompt } from './pwa/UpdatePrompt.tsx';
import { Onboarding } from './features/onboarding/Onboarding.tsx';
import { HomeLauncher } from './features/home/HomeLauncher.tsx';
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

const JournalScreen = lazy(() =>
  import('./features/journal/JournalScreen.tsx').then(m => ({
    default: m.JournalScreen,
  }))
);
const CategoriesScreen = lazy(() =>
  import('./features/categories/CategoriesScreen.tsx').then(m => ({
    default: m.CategoriesScreen,
  }))
);
const SeasonsScreen = lazy(() =>
  import('./features/seasons/SeasonsScreen.tsx').then(m => ({
    default: m.SeasonsScreen,
  }))
);
const SyntheseScreen = lazy(() =>
  import('./features/synthese/SyntheseScreen.tsx').then(m => ({
    default: m.SyntheseScreen,
  }))
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

/** Titres des routes GLOBALES (hors lens). Le titre d'un lens vient de sa config. */
const GLOBAL_TITLES: Record<string, string> = {
  '/settings': 'Réglages',
  '/audit': 'Journal d’audit',
};

function Shell() {
  const lens = useActiveLens();
  const { pathname } = useLocation();
  const title = lens?.label ?? GLOBAL_TITLES[pathname] ?? 'Miss UWH';

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <AppHeader title={title} lens={lens} />
      <main className="flex-1">
        <Suspense
          fallback={
            <p className="p-8 text-center text-[var(--uwh-text-soft)]">
              Chargement…
            </p>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      {lens && <LensNav lens={lens} />}
      <UpdatePrompt />
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
    <AuthProvider>
      <AuthGate>
        <SupabaseSync />
        <Inner />
      </AuthGate>
    </AuthProvider>
  );
}
