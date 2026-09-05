/**
 * Client Supabase : fabrique du SOCLE — création PARESSEUSE. Rien ne s'exécute
 * à l'import (doctrine anti-écran-blanc) : la configuration est lue sans lever,
 * et le SDK `@supabase/supabase-js` (~120 Ko) est importé dynamiquement au
 * premier `getClient()`, puis la promesse est partagée (un seul client, une
 * seule connexion realtime).
 *
 * La clé anon est sûre dans le bundle (public) GitHub Pages : chaque table est
 * protégée par RLS côté serveur, jamais par le client. `flowType: 'pkce'` pour
 * un flux d'auth robuste, MFA (TOTP) gérée par Supabase Auth (cf. README).
 */
import { createSupabaseClientFactory } from '@mister-guiiug/dev-pwa-config/supabase-client';
import type { SupabaseClient } from '@supabase/supabase-js';

export const supabase = createSupabaseClientFactory<SupabaseClient>({
  env: import.meta.env,
  auth: { flowType: 'pkce' },
});

/**
 * Le client partagé (créé au premier appel). REJETTE si `VITE_SUPABASE_URL` /
 * `VITE_SUPABASE_ANON_KEY` manquent — jamais le cas en pratique : `IS_SUPABASE`
 * (backend/config.ts, assis sur `supabase.isConfigured()`) garde tous les
 * appels.
 */
export function getSupabase(): Promise<SupabaseClient> {
  return supabase.getClient();
}
