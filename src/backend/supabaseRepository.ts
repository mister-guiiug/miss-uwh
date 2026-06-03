/**
 * Repository Supabase — accès données de la comptabilité, arbitré par RLS côté
 * serveur. Construit sur les mappers PURS (`supabaseMappers.ts`).
 *
 * Deux familles :
 *  - `fetch*` : pull complet (hydratation du store local à la connexion) ;
 *  - `upsert*` / `deleteEvent` : push idempotent (les ids sont des UUID générés
 *    côté client, donc `on conflict (id)` fait insert OU update).
 *
 * NB : exercé end-to-end uniquement avec un projet Supabase configuré
 * (`VITE_BACKEND=supabase`). Le mode local n'appelle jamais ce module.
 */
import type {
  Attachment,
  AuditEvent,
  Club,
  EventLedger,
  JournalEntry,
  Season,
} from '../shared/types/domain.ts';
import { getSupabase } from '../lib/supabase.ts';
import {
  entryToUpsertRow,
  eventToRow,
  rowToAttachment,
  rowToAudit,
  rowToClub,
  rowToEntry,
  rowToEvent,
  rowToSeason,
  seasonToUpsertRow,
  type AttachmentRow,
  type AuditRow,
  type ClubRow,
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

// ── Pull (hydratation) ───────────────────────────────────────────────
export async function fetchClub(): Promise<(Club & { id: string }) | null> {
  const rows = unwrap(
    await getSupabase().from('clubs').select('*').limit(1)
  ) as ClubRow[];
  return rows[0] ? rowToClub(rows[0]) : null;
}

export async function fetchSeasons(): Promise<Season[]> {
  const rows = unwrap(
    await getSupabase().from('seasons').select('*').order('label')
  ) as SeasonRow[];
  return rows.map(rowToSeason);
}

export async function fetchEvents(): Promise<EventLedger[]> {
  const rows = unwrap(
    await getSupabase().from('events').select('*')
  ) as EventRow[];
  return rows.map(rowToEvent);
}

export async function fetchEntries(): Promise<JournalEntry[]> {
  const rows = unwrap(
    await getSupabase().from('entries').select('*').order('date')
  ) as EntryRow[];
  return rows.map(rowToEntry);
}

export async function fetchAudit(): Promise<AuditEvent[]> {
  const sb = getSupabase();
  const [metier, securite] = await Promise.all([
    sb
      .from('audit_metier')
      .select('*')
      .order('ts', { ascending: false })
      .limit(500),
    sb
      .from('audit_securite')
      .select('*')
      .order('ts', { ascending: false })
      .limit(500),
  ]);
  const m = (unwrap(metier) as AuditRow[]).map(r => rowToAudit(r, 'metier'));
  const s = (unwrap(securite) as AuditRow[]).map(r =>
    rowToAudit(r, 'securite')
  );
  return [...m, ...s].sort((a, b) => b.ts - a.ts);
}

export async function fetchAttachments(): Promise<
  Array<{ entryId: string; att: Attachment }>
> {
  const rows = unwrap(
    await getSupabase().from('attachments').select('*')
  ) as AttachmentRow[];
  return rows.map(r => ({ entryId: r.entry_id, att: rowToAttachment(r) }));
}

// ── Push (idempotent) ────────────────────────────────────────────────
export async function upsertEntry(entry: JournalEntry): Promise<void> {
  unwrap(
    await getSupabase()
      .from('entries')
      .upsert(entryToUpsertRow(entry), { onConflict: 'id' })
  );
}

export async function upsertEntries(entries: JournalEntry[]): Promise<void> {
  if (entries.length === 0) return;
  unwrap(
    await getSupabase()
      .from('entries')
      .upsert(entries.map(entryToUpsertRow), { onConflict: 'id' })
  );
}

export async function upsertSeason(season: Season): Promise<void> {
  unwrap(
    await getSupabase()
      .from('seasons')
      .upsert(seasonToUpsertRow(season), { onConflict: 'id' })
  );
}

export async function upsertEvent(event: EventLedger): Promise<void> {
  unwrap(
    await getSupabase()
      .from('events')
      .upsert(eventToRow(event), { onConflict: 'id' })
  );
}

export async function deleteEvent(id: string): Promise<void> {
  unwrap(await getSupabase().from('events').delete().eq('id', id));
}
