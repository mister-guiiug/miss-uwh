/**
 * Déclenche l'import HelloAsso (Edge Function `helloasso-sync`). Le secret
 * HelloAsso reste côté serveur ; la fonction écrit les adhérents via le JWT de
 * l'utilisateur (RLS). Cf. `supabase/functions/helloasso-sync/`.
 */
import { getSupabase } from '../lib/supabase.ts';
import type { HelloAssoConfig } from '../shared/types/domain.ts';

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
  const { data, error } = await getSupabase().functions.invoke(
    'helloasso-sync',
    {
      body: {
        seasonId,
        ...(orgSlug ? { orgSlug } : {}),
        ...(formSlug ? { formSlug } : {}),
        ...(formType ? { formType } : {}),
      },
    }
  );
  if (error) {
    // Pour un statut non-2xx, supabase-js renvoie un message générique ;
    // le vrai message métier est dans le corps de la réponse (error.context).
    let message = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = (await ctx.json()) as { error?: unknown };
        if (typeof body?.error === 'string') message = body.error;
      } catch {
        /* on garde le message générique */
      }
    }
    throw new Error(message);
  }
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as HelloAssoResult;
}
