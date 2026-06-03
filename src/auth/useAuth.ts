/**
 * Contexte d'authentification + hook `useAuth`, séparés du composant
 * `AuthProvider` (règle react-refresh : un fichier de composant n'exporte que des
 * composants). Types de rôles et d'enrôlement MFA également ici.
 */
import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';

export type Role =
  | 'admin_technique'
  | 'tresorier'
  | 'tresorier_adjoint'
  | 'president'
  | 'resp_evenement'
  | 'resp_materiel'
  | 'controleur'
  | 'membre';

export interface TotpEnrollment {
  factorId: string;
  qrCode: string; // SVG data URL
  secret: string;
  uri: string;
}

export interface AuthValue {
  session: Session | null;
  roles: Role[];
  loading: boolean;
  /** Session ouverte mais MFA (AAL2) requise pour ce compte. */
  needsMfa: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  enrollTotp: () => Promise<TotpEnrollment | { error: string }>;
  verifyTotp: (factorId: string, code: string) => Promise<{ error?: string }>;
  challengeTotp: (code: string) => Promise<{ error?: string }>;
  hasTotp: boolean;
  unenrollTotp: (factorId?: string) => Promise<{ error?: string }>;
}

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}
