import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth.ts';
import { canAccessLens, type Lens } from '../lib/lenses.ts';

/**
 * Garde d'accès à un lens. Posée sur la route PARENTE du lens (avant le chunk
 * lazy enfant) : si l'utilisateur n'a pas le droit, redirige vers le lanceur.
 * La sécurité réelle reste côté serveur (RLS) — ceci n'est que de l'ergonomie.
 */
export function LensGuard({
  lens,
  children,
}: {
  lens: Lens;
  children: ReactNode;
}) {
  const { roles } = useAuth();
  if (!canAccessLens(roles, lens)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
