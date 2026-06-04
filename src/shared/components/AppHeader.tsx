import { Link } from 'react-router-dom';
import { Home, Lock, Moon, Settings, Sun, Waves } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import type { Lens } from '../lib/lenses.ts';
import { Button } from './Button.tsx';

/**
 * En-tête : retour à l'accueil (dans un lens) ou logo (sur le lanceur), titre,
 * chip saison + roue Réglages (toujours accessibles) + bascule de thème.
 */
export function AppHeader({
  title,
  lens,
}: {
  title: string;
  lens?: Lens | null;
}) {
  const theme = useAppStore(s => s.data.settings.theme);
  const setTheme = useAppStore(s => s.setTheme);
  const season = useAppStore(selectActiveSeason);
  const isDark = theme === 'dark';

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-[var(--uwh-border)] bg-[var(--uwh-surface)]/95 px-4 py-3 backdrop-blur pt-[max(0.75rem,env(safe-area-inset-top))] no-print">
      <div className="flex min-w-0 items-center gap-2">
        {lens ? (
          <Link
            to="/"
            aria-label="Retour à l'accueil"
            className="-ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--uwh-text-soft)]"
            style={{ color: lens.accent }}
          >
            <Home size={20} aria-hidden="true" />
          </Link>
        ) : (
          <Waves
            size={22}
            className="shrink-0 text-primary"
            aria-hidden="true"
          />
        )}
        <h1 className="truncate font-display text-lg font-bold leading-none">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-1.5">
        <Link
          to="/finances/seasons"
          className="inline-flex items-center gap-1 rounded-full bg-[var(--uwh-surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--uwh-text-soft)]"
          aria-label={`Saison active ${season.label}`}
        >
          {season.status === 'cloturee' && (
            <Lock
              size={12}
              aria-hidden="true"
              className="text-[var(--uwh-warn)]"
            />
          )}
          {season.label}
        </Link>
        <Link
          to="/settings"
          aria-label="Réglages"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--uwh-text-soft)]"
        >
          <Settings size={20} aria-hidden="true" />
        </Link>
        <Button
          variant="ghost"
          aria-label={isDark ? 'Passer en clair' : 'Passer en sombre'}
          aria-pressed={isDark}
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
        >
          {isDark ? (
            <Sun size={20} aria-hidden="true" />
          ) : (
            <Moon size={20} aria-hidden="true" />
          )}
        </Button>
      </div>
    </header>
  );
}
