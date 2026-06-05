/**
 * Déclenche l'import HelloAsso (Edge Function `helloasso-sync`). Le secret
 * HelloAsso reste côté serveur ; la fonction écrit les adhérents via le JWT de
 * l'utilisateur (RLS). Cf. `supabase/functions/helloasso-sync/`.
 */
import { getSupabase } from '../lib/supabase.ts';

export interface HelloAssoResult {
  imported: number;
  updated: number;
  skipped: number;
  total: number;
}

export async function importFromHelloAsso(
  seasonId: string
): Promise<HelloAssoResult> {
  const { data, error } = await getSupabase().functions.invoke(
    'helloasso-sync',
    {
      body: { seasonId },
    }
  );
  if (error) throw new Error(error.message);
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as HelloAssoResult;
}
