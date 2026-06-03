import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Crée paresseusement le client Supabase à partir des variables publiques.
 * La clé anon est sûre dans le bundle (public) GitHub Pages : chaque table est
 * protégée par RLS côté serveur, jamais par le client. `flowType: 'pkce'` pour
 * un flux d'auth robuste, MFA (TOTP) gérée par Supabase Auth (cf. README).
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Supabase non configuré : définissez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.'
    );
  }
  client = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, flowType: 'pkce' },
  });
  return client;
}
