/**
 * Sélection du backend de données. `local` (défaut) fait tourner l'app 100% en
 * navigateur sur GitHub Pages ; `supabase` active l'authentification, le RBAC
 * côté serveur (RLS), l'audit serveur et le stockage chiffré des justificatifs.
 *
 * En `supabase`, on n'active réellement le mode que si la fabrique du socle est
 * configurée (`VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` présentes et non
 * blanches — le juge est `missingConfig` du socle) ; sinon on retombe
 * proprement sur `local` (démo).
 */
import { supabase } from '../lib/supabase.ts';

const declared = (import.meta.env.VITE_BACKEND ?? 'local') as
  | 'local'
  | 'supabase';

export const BACKEND: 'local' | 'supabase' =
  declared === 'supabase' && supabase.isConfigured() ? 'supabase' : 'local';

export const IS_SUPABASE = BACKEND === 'supabase';
