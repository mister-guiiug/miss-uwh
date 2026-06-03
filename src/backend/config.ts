/**
 * Sélection du backend de données. `local` (défaut) fait tourner l'app 100% en
 * navigateur sur GitHub Pages ; `supabase` active l'authentification, le RBAC
 * côté serveur (RLS), l'audit serveur et le stockage chiffré des justificatifs.
 *
 * En `supabase`, on n'active réellement le mode que si l'URL et la clé anon sont
 * présentes — sinon on retombe proprement sur `local` (démo).
 */
const declared = (import.meta.env.VITE_BACKEND ?? 'local') as
  | 'local'
  | 'supabase';
const hasSupabaseEnv = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const BACKEND: 'local' | 'supabase' =
  declared === 'supabase' && hasSupabaseEnv ? 'supabase' : 'local';

export const IS_SUPABASE = BACKEND === 'supabase';
