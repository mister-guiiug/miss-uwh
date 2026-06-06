/**
 * Déclenche l'import HelloAsso (Edge Function `helloasso-sync`). Le secret
 * HelloAsso reste côté serveur ; la fonction écrit les adhérents via le JWT de
 * l'utilisateur (RLS). Cf. `supabase/functions/helloasso-sync/`.
 */
import { getSupabase } from '../lib/supabase.ts';
import type { HelloAssoConfig } from '../shared/types/domain.ts';
import { unwrapInvoke } from './functionError.ts';

export interface HelloAssoResult {
  imported: number;
  updated: number;
  skipped: number;
  total: number;
}

/**
 * Déclenche l'import. Les slugs (organisation, formulaire) viennent du
 * paramétrage de l'app et sont transmis à la fonction ; vides, la fonction
 * retombe sur ses secrets serveur. Les identifiants OAuth restent serveur.
 */
export async function importFromHelloAsso(
  seasonId: string,
  config?: HelloAssoConfig
): Promise<HelloAssoResult> {
  const orgSlug = config?.orgSlug?.trim();
  const formSlug = config?.formSlug?.trim();
  const formType = config?.formType?.trim();
  const result = await getSupabase().functions.invoke('helloasso-sync', {
    body: {
      seasonId,
      ...(orgSlug ? { orgSlug } : {}),
      ...(formSlug ? { formSlug } : {}),
      ...(formType ? { formType } : {}),
    },
  });
  const data = await unwrapInvoke(result);
  return data as HelloAssoResult;
}
