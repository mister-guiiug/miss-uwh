/**
 * Repository Supabase — surface lecture/écriture de la comptabilité, arbitrée
 * par RLS côté serveur. Construit sur les mappers PURS (`supabaseMappers.ts`).
 *
 * Statut : prêt et typé, mais PAS encore branché dans le store (l'app reste
 * local-first par défaut). Le branchement (remplacer `storage.ts` par ce
 * repository en mode `supabase`, gestion async + offline cache) est l'étape V2.
 * Nécessite un projet Supabase configuré pour être exercé end-to-end.
 */
import type { EntryInput } from '../store/useAppStore.ts';
import type {
  EventLedger,
  JournalEntry,
  Season,
} from '../shared/types/domain.ts';
import { getSupabase } from '../lib/supabase.ts';
import {
  entryToRow,
  rowToEntry,
  rowToEvent,
  rowToSeason,
  type EntryRow,
  type EventRow,
  type SeasonRow,
} from './supabaseMappers.ts';

function unwrap<T>(res: {
  data: T | null;
  error: { message: string } | null;
}): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function listSeasons(): Promise<Season[]> {
  const rows = unwrap(
    await getSupabase().from('seasons').select('*').order('label')
  ) as SeasonRow[];
  return rows.map(rowToSeason);
}

export async function listEntries(seasonId: string): Promise<JournalEntry[]> {
  const rows = unwrap(
    await getSupabase()
      .from('entries')
      .select('*')
      .eq('season_id', seasonId)
      .order('date')
  ) as EntryRow[];
  return rows.map(rowToEntry);
}

export async function listEvents(seasonId: string): Promise<EventLedger[]> {
  const rows = unwrap(
    await getSupabase().from('events').select('*').eq('season_id', seasonId)
  ) as EventRow[];
  return rows.map(rowToEvent);
}

export async function createEntry(input: EntryInput): Promise<JournalEntry> {
  const payload = entryToRow({
    ...input,
    id: '',
    createdAt: 0,
    updatedAt: 0,
    version: 1,
  });
  const row = unwrap(
    await getSupabase().from('entries').insert(payload).select().single()
  ) as EntryRow;
  return rowToEntry(row);
}

export async function patchEntry(
  id: string,
  patch: Partial<EntryInput>
): Promise<void> {
  const payload = entryToRow({
    ...(patch as EntryInput),
    id,
    createdAt: 0,
    updatedAt: 0,
    version: 1,
  });
  unwrap(await getSupabase().from('entries').update(payload).eq('id', id));
}

/** Suppression LOGIQUE (le DELETE physique est refusé par la RLS). */
export async function softDeleteEntry(id: string): Promise<void> {
  unwrap(
    await getSupabase()
      .from('entries')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
  );
}
