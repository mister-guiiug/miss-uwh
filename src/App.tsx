import { lazy, Suspense } from 'react';
import {
  HashRouter,
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
import { BottomNav } from './shared/components/BottomNav.tsx';
import { UpdatePrompt } from './pwa/UpdatePrompt.tsx';
import { Onboarding } from './features/onboarding/Onboarding.tsx';
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

const TITLES: Record<string, string> = {
  '/': 'Bilan',
  '/journal': 'Journal comptable',
  '/categories': 'Catégories',
  '/synthese': 'Synthèse',
  '/seasons': 'Saisons',
  '/audit': 'Journal d’audit',
  '/settings': 'Réglages',
};

function Shell() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? 'Miss UWH';

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <AppHeader title={title} />
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
      <BottomNav />
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
          <Route index element={<BilanScreen />} />
          <Route path="journal" element={<JournalScreen />} />
          <Route path="categories" element={<CategoriesScreen />} />
          <Route path="synthese" element={<SyntheseScreen />} />
          <Route path="seasons" element={<SeasonsScreen />} />
          <Route path="audit" element={<AuditScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
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
