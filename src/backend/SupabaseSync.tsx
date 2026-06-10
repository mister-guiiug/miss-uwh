import { useEffect } from 'react';
import { useAuth } from '../auth/useAuth.ts';
import { IS_SUPABASE } from './config.ts';
import { initialSync, startSync, stopSync } from './sync.ts';

/**
 * Pilote la synchronisation Supabase (démarrage/arrêt + sync initiale).
 * Composant sans rendu : l'affichage du statut est assuré par `SyncBanner`,
 * placé DANS la mise en page (sous l'en-tête) pour ne jamais la recouvrir.
 * En mode local, ne déclenche rien (IS_SUPABASE = false).
 */
export function SupabaseSync() {
  const session = useAuth().session;

  useEffect(() => {
    if (!IS_SUPABASE || !session) return;
    startSync();
    void initialSync();
    return () => stopSync();
  }, [session]);

  return null;
}
