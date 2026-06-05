/**
 * Récupère les événements d'un calendrier Google public via l'Edge Function
 * `gcal-import` (proxy serveur : l'URL iCal n'envoie pas d'en-têtes CORS, on ne
 * peut donc pas la lire directement depuis le navigateur). La fonction se
 * contente de télécharger et parser le `.ics` ; l'insertion dans l'agenda se
 * fait côté client (local-first). Cf. `supabase/functions/gcal-import/`.
 */
import { getSupabase } from '../lib/supabase.ts';

export interface GCalEvent {
  /** Identifiant iCal (UID) — sert au dédoublonnage si présent. */
  uid?: string;
  /** Date de début (ISO `yyyy-mm-dd`). */
  date: string;
  title: string;
  location?: string;
  description?: string;
}

export async function fetchGoogleCalendar(
  icsUrl: string
): Promise<GCalEvent[]> {
  const url = icsUrl.trim();
  if (!url) throw new Error('Aucune URL iCal renseignée (Réglages).');

  const { data, error } = await getSupabase().functions.invoke('gcal-import', {
    body: { icsUrl: url },
  });
  if (error) {
    // Statut non-2xx : supabase-js renvoie un message générique ; le vrai
    // message métier est dans le corps de la réponse (error.context).
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
  return ((data as { events?: GCalEvent[] })?.events ?? []).filter(
    e => e.date && e.title
  );
}
