/**
 * Déballage d'un résultat `supabase.functions.invoke`.
 *
 * Pour un statut non-2xx, supabase-js renvoie un message GÉNÉRIQUE
 * (« Edge Function returned a non-2xx status code ») ; le vrai message métier
 * est dans le corps de la réponse, accessible via `error.context` (un `Response`).
 * Logique partagée par les clients edge (`helloasso.ts`, `gcal.ts`) et testée
 * isolément.
 */
export interface InvokeError {
  message: string;
  /** `Response` brut de l'appel (présent sur erreur HTTP). */
  context?: unknown;
}

export interface InvokeResult {
  data: unknown;
  error: InvokeError | null;
}

/** Extrait le message métier du corps de la réponse, sinon le message générique. */
export async function functionErrorMessage(
  error: InvokeError
): Promise<string> {
  const ctx = error.context as { json?: () => Promise<unknown> } | undefined;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = (await ctx.json()) as { error?: unknown };
      if (typeof body?.error === 'string') return body.error;
    } catch {
      /* corps illisible → on garde le message générique */
    }
  }
  return error.message;
}

/**
 * Renvoie `data` ou lève une `Error` au message lisible. Couvre les deux formes
 * d'échec : statut HTTP non-2xx (`error`) et erreur applicative renvoyée en 200
 * dans `data.error` (la fonction a répondu mais signale un problème).
 */
export async function unwrapInvoke(result: InvokeResult): Promise<unknown> {
  const { data, error } = result;
  if (error) {
    throw new Error(await functionErrorMessage(error));
  }
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data;
}
