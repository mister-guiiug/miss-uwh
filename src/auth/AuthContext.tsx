import {
  createContext,
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

interface AuthValue {
  session: Session | null;
  roles: Role[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(IS_SUPABASE);
  const logSecurity = useAppStore(s => s.logSecurity);

  useEffect(() => {
    if (!IS_SUPABASE) return;
    const sb = getSupabase();

    async function hydrate(s: Session | null) {
      setSession(s);
      if (s?.user?.email) setCurrentActor(s.user.email);
      if (s) {
        // Rôles applicatifs lus côté serveur (table protégée par RLS).
        const { data } = await sb
          .from('members')
          .select('roles')
          .eq('auth_id', s.user.id)
          .maybeSingle();
        setRoles((data?.roles as Role[]) ?? []);
      } else {
        setRoles([]);
        setCurrentActor('local');
      }
      setLoading(false);
    }

    sb.auth.getSession().then(({ data }) => hydrate(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((event, s) => {
      hydrate(s);
      if (event === 'SIGNED_IN' && s?.user?.email)
        logSecurity('auth.signin', `Connexion de ${s.user.email}.`);
      if (event === 'SIGNED_OUT') logSecurity('auth.signout', 'Déconnexion.');
    });
    return () => sub.subscription.unsubscribe();
  }, [logSecurity]);

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

  return (
    <AuthContext.Provider value={{ session, roles, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}
