import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { IS_SUPABASE } from '../backend/config.ts';
import { getSupabase } from '../lib/supabase.ts';
import { setCurrentActor, useAppStore } from '../store/useAppStore.ts';

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

interface AuthValue {
  session: Session | null;
  roles: Role[];
  loading: boolean;
  /** Session ouverte mais MFA (AAL2) requise pour ce compte. */
  needsMfa: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  /** Démarre l'enrôlement TOTP (renvoie le QR à scanner). */
  enrollTotp: () => Promise<TotpEnrollment | { error: string }>;
  /** Vérifie un code TOTP (finalise l'enrôlement OU élève la session en AAL2). */
  verifyTotp: (factorId: string, code: string) => Promise<{ error?: string }>;
  /** Élévation à la connexion : trouve le facteur vérifié et valide le code. */
  challengeTotp: (code: string) => Promise<{ error?: string }>;
  hasTotp: boolean;
  unenrollTotp: (factorId?: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(IS_SUPABASE);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [hasTotp, setHasTotp] = useState(false);
  const logSecurity = useAppStore(s => s.logSecurity);

  const refreshMfa = useCallback(async () => {
    if (!IS_SUPABASE) return;
    const sb = getSupabase();
    const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    const { data: factors } = await sb.auth.mfa.listFactors();
    const verified = (factors?.totp ?? []).some(f => f.status === 'verified');
    setHasTotp(verified);
    setNeedsMfa(
      verified && aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2'
    );
  }, []);

  useEffect(() => {
    if (!IS_SUPABASE) return;
    const sb = getSupabase();

    async function hydrate(s: Session | null) {
      setSession(s);
      if (s?.user?.email) setCurrentActor(s.user.email);
      if (s) {
        const { data } = await sb
          .from('members')
          .select('roles')
          .eq('auth_id', s.user.id)
          .maybeSingle();
        setRoles((data?.roles as Role[]) ?? []);
        await refreshMfa();
      } else {
        setRoles([]);
        setNeedsMfa(false);
        setHasTotp(false);
        setCurrentActor('local');
      }
      setLoading(false);
    }

    sb.auth.getSession().then(({ data }) => hydrate(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((event, s) => {
      void hydrate(s);
      if (event === 'SIGNED_IN' && s?.user?.email)
        logSecurity('auth.signin', `Connexion de ${s.user.email}.`);
      if (event === 'SIGNED_OUT') logSecurity('auth.signout', 'Déconnexion.');
    });
    return () => sub.subscription.unsubscribe();
  }, [logSecurity, refreshMfa]);

  async function signIn(email: string, password: string) {
    const { error } = await getSupabase().auth.signInWithPassword({
      email,
      password,
    });
    return { error: error?.message };
  }

  async function signOut() {
    await getSupabase().auth.signOut();
  }

  async function enrollTotp(): Promise<TotpEnrollment | { error: string }> {
    const { data, error } = await getSupabase().auth.mfa.enroll({
      factorType: 'totp',
    });
    if (error || !data)
      return { error: error?.message ?? 'Enrôlement impossible' };
    return {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    };
  }

  async function verifyTotp(factorId: string, code: string) {
    const { error } = await getSupabase().auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    if (!error) {
      await refreshMfa();
      logSecurity('auth.mfa.verify', 'Vérification MFA (TOTP) réussie.');
    }
    return { error: error?.message };
  }

  async function challengeTotp(code: string) {
    const sb = getSupabase();
    const { data: factors } = await sb.auth.mfa.listFactors();
    const totp = (factors?.totp ?? []).find(f => f.status === 'verified');
    if (!totp) return { error: 'Aucun facteur TOTP vérifié.' };
    return verifyTotp(totp.id, code);
  }

  async function unenrollTotp(factorId?: string) {
    const sb = getSupabase();
    let id = factorId;
    if (!id) {
      const { data: factors } = await sb.auth.mfa.listFactors();
      id = (factors?.totp ?? [])[0]?.id;
    }
    if (!id) return { error: 'Aucun facteur à retirer.' };
    const { error } = await sb.auth.mfa.unenroll({ factorId: id });
    if (!error) await refreshMfa();
    return { error: error?.message };
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        roles,
        loading,
        needsMfa,
        hasTotp,
        signIn,
        signOut,
        enrollTotp,
        verifyTotp,
        challengeTotp,
        unenrollTotp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}
