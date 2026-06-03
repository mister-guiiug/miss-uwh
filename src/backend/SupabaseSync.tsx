import { useEffect } from 'react';
import { CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.ts';
import { useAuth } from '../auth/useAuth.ts';
import { IS_SUPABASE } from './config.ts';
import { initialSync, retrySync, startSync, stopSync } from './sync.ts';

/**
 * Pilote la synchronisation Supabase et affiche un bandeau de statut discret.
 * En mode local, ne rend rien et ne déclenche rien (IS_SUPABASE = false).
 */
export function SupabaseSync() {
  const session = useAuth().session;
  const sync = useAppStore(s => s.syncStatus);

  useEffect(() => {
    if (!IS_SUPABASE || !session) return;
    startSync();
    void initialSync();
    return () => stopSync();
  }, [session]);

  if (!IS_SUPABASE) return null;
  if (sync.state === 'idle' || sync.state === 'ready') return null;

  const isError = sync.state === 'error';
  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-white"
      style={{
        background: isError ? 'var(--uwh-debit)' : 'var(--color-primary)',
      }}
    >
      {isError ? (
        <>
          <TriangleAlert size={14} aria-hidden="true" />
          <span className="truncate">
            Synchronisation interrompue{sync.error ? ` : ${sync.error}` : ''}
          </span>
          <button
            onClick={() => void retrySync()}
            className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5"
          >
            <RefreshCw size={12} aria-hidden="true" /> Réessayer
          </button>
        </>
      ) : (
        <>
          <CloudOff size={14} aria-hidden="true" className="animate-pulse" />
          Synchronisation…
        </>
      )}
    </div>
  );
}
