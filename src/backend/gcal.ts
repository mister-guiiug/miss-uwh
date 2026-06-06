/**
 * Récupère les événements d'un calendrier Google public via l'Edge Function
 * `gcal-import` (proxy serveur : l'URL iCal n'envoie pas d'en-têtes CORS, on ne
 * peut donc pas la lire directement depuis le navigateur). La fonction se
 * contente de télécharger et parser le `.ics` ; l'insertion dans l'agenda se
 * fait côté client (local-first). Cf. `supabase/functions/gcal-import/`.
 */
import { getSupabase } from '../lib/supabase.ts';
import { unwrapInvoke } from './functionError.ts';

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

  const result = await getSupabase().functions.invoke('gcal-import', {
    body: { icsUrl: url },
  });
  const data = await unwrapInvoke(result);
  return ((data as { events?: GCalEvent[] })?.events ?? []).filter(
    e => e.date && e.title
  );
}
