import { Link } from 'react-router-dom';
import { CloudOff, Info, RefreshCw, TriangleAlert } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.ts';
import { IS_SUPABASE } from './config.ts';
import { retryDeadOps, retrySync } from './sync.ts';

const ACTION_CLASS =
  'inline-flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 font-semibold';

/**
 * Bandeau de statut de synchronisation, rendu DANS le flux sous l'en-tête
 * (jamais par-dessus). Trois situations :
 * - `syncing`  : information discrète, synchronisation en cours ;
 * - `offline`  : hors ligne / serveur injoignable — état normal, ambre,
 *                les modifications en attente repartiront seules ;
 * - `error`    : pull impossible ou opérations refusées par le serveur —
 *                rouge, avec « Réessayer » et le détail dans les Réglages.
 */
export function SyncBanner() {
  const sync = useAppStore(s => s.syncStatus);

  if (!IS_SUPABASE) return null;
  if (sync.state === 'idle' || sync.state === 'ready') return null;

  const dead = sync.dead ?? 0;
  const pending = sync.pending ?? 0;

  let background = 'var(--color-primary)';
  let icon = <Info size={14} aria-hidden="true" className="shrink-0" />;
  let message = 'Synchronisation…';
  let showRetry = false;

  if (sync.state === 'offline') {
    const offline =
      typeof navigator !== 'undefined' && navigator.onLine === false;
    const cause = offline ? 'Hors ligne' : 'Serveur injoignable';
    background = 'var(--uwh-warn)';
    icon = <CloudOff size={14} aria-hidden="true" className="shrink-0" />;
    message =
      pending > 0
        ? `${cause} — ${pending} modification(s) en attente d'envoi`
        : `${cause} — vos données restent disponibles`;
    showRetry = true;
  } else if (sync.state === 'error') {
    background = 'var(--uwh-debit)';
    icon = <TriangleAlert size={14} aria-hidden="true" className="shrink-0" />;
    message =
      dead > 0
        ? `Synchronisation incomplète : ${sync.error}`
        : `Synchronisation interrompue${sync.error ? ` : ${sync.error}` : ''}`;
    showRetry = true;
  } else {
    icon = (
      <CloudOff
        size={14}
        aria-hidden="true"
        className="animate-pulse shrink-0"
      />
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-3 py-1.5 text-xs font-semibold text-white"
      style={{ background }}
    >
      {icon}
      <span className="min-w-0 max-w-full">{message}</span>
      {showRetry && (
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void (dead > 0 ? retryDeadOps() : retrySync())}
            className={ACTION_CLASS}
          >
            <RefreshCw size={12} aria-hidden="true" /> Réessayer
          </button>
          {dead > 0 && (
            <Link to="/settings" className={ACTION_CLASS}>
              Détails
            </Link>
          )}
        </span>
      )}
    </div>
  );
}
