import type { ReactNode } from 'react';
import { IS_SUPABASE } from '../backend/config.ts';
import { useAuth } from './useAuth.ts';
import { LoginPage } from './LoginPage.tsx';
import { MfaChallenge } from './MfaChallenge.tsx';

/**
 * Garde d'accès. En mode `local`, laisse passer (mono-poste). En mode
 * `supabase`, exige une session authentifiée avant d'afficher l'application —
 * la sécurité réelle restant appliquée côté serveur par les politiques RLS.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading, needsMfa } = useAuth();

  if (!IS_SUPABASE) return <>{children}</>;
  if (loading)
    return (
      <p className="p-10 text-center text-[var(--uwh-text-soft)]">
        Chargement…
      </p>
    );
  if (!session) return <LoginPage />;
  if (needsMfa) return <MfaChallenge />;
  return <>{children}</>;
}
