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
  Adherent,
  Announcement,
  Attachment,
  AuditEvent,
  Category,
  Club,
  ClubEvent,
  EventLedger,
  Guardian,
  JournalEntry,
  RecurringTemplate,
  Season,
} from '../shared/types/domain.ts';
import { getSupabase } from '../lib/supabase.ts';
import { getCurrentClubId } from './clubContext.ts';
import {
  adherentToUpsertRow,
  announcementToUpsertRow,
  clubEventToUpsertRow,
  customCategoryToUpsertRow,
  entryToUpsertRow,
  eventToRow,
  guardianToUpsertRow,
  recurringToUpsertRow,
  rowToAdherent,
  rowToAnnouncement,
  rowToAttachment,
  rowToAudit,
  rowToCategory,
  rowToClub,
  rowToClubEvent,
  rowToEntry,
  rowToEvent,
  rowToGuardian,
  rowToRecurring,
  rowToSeason,
  seasonToUpsertRow,
  type AdherentRow,
  type AnnouncementRow,
  type AttachmentRow,
  type AuditRow,
  type CategoryRow,
  type ClubEventRow,
  type ClubRow,
  type EntryRow,
  type EventRow,
  type GuardianRow,
  type RecurringRow,
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

export async function fetchRecurrings(): Promise<RecurringTemplate[]> {
  const rows = unwrap(
    await getSupabase().from('recurrings').select('*').order('label')
  ) as RecurringRow[];
  return rows.map(rowToRecurring);
}

export async function fetchAdherents(): Promise<Adherent[]> {
  const rows = unwrap(
    await getSupabase().from('adherents').select('*')
  ) as AdherentRow[];
  return rows.map(rowToAdherent);
}

/** Catégories PERSONNALISÉES uniquement (la taxonomie fixe est dans le code). */
export async function fetchCustomCategories(): Promise<Category[]> {
  const rows = unwrap(
    await getSupabase().from('categories').select('*').eq('custom', true)
  ) as CategoryRow[];
  return rows.map(rowToCategory);
}

export async function fetchGuardians(): Promise<Guardian[]> {
  const rows = unwrap(
    await getSupabase().from('guardians').select('*')
  ) as GuardianRow[];
  return rows.map(rowToGuardian);
}

export async function fetchClubEvents(): Promise<ClubEvent[]> {
  const rows = unwrap(
    await getSupabase().from('club_events').select('*').order('date')
  ) as ClubEventRow[];
  return rows.map(rowToClubEvent);
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const rows = unwrap(
    await getSupabase().from('announcements').select('*').order('date')
  ) as AnnouncementRow[];
  return rows.map(rowToAnnouncement);
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

export async function upsertRecurring(t: RecurringTemplate): Promise<void> {
  const clubId = getCurrentClubId();
  if (!clubId) throw new Error('Club courant inconnu (récurrence en attente).');
  unwrap(
    await getSupabase()
      .from('recurrings')
      .upsert(recurringToUpsertRow(t, clubId), { onConflict: 'id' })
  );
}

export async function deleteRecurring(id: string): Promise<void> {
  unwrap(await getSupabase().from('recurrings').delete().eq('id', id));
}

export async function upsertAdherent(a: Adherent): Promise<void> {
  unwrap(
    await getSupabase()
      .from('adherents')
      .upsert(adherentToUpsertRow(a), { onConflict: 'id' })
  );
}

export async function deleteAdherent(id: string): Promise<void> {
  unwrap(await getSupabase().from('adherents').delete().eq('id', id));
}

export async function upsertGuardian(g: Guardian): Promise<void> {
  unwrap(
    await getSupabase()
      .from('guardians')
      .upsert(guardianToUpsertRow(g), { onConflict: 'id' })
  );
}

export async function deleteGuardian(id: string): Promise<void> {
  unwrap(await getSupabase().from('guardians').delete().eq('id', id));
}

export async function upsertClubEvent(e: ClubEvent): Promise<void> {
  unwrap(
    await getSupabase()
      .from('club_events')
      .upsert(clubEventToUpsertRow(e), { onConflict: 'id' })
  );
}

export async function deleteClubEvent(id: string): Promise<void> {
  unwrap(await getSupabase().from('club_events').delete().eq('id', id));
}

export async function upsertAnnouncement(a: Announcement): Promise<void> {
  unwrap(
    await getSupabase()
      .from('announcements')
      .upsert(announcementToUpsertRow(a), { onConflict: 'id' })
  );
}

export async function deleteAnnouncement(id: string): Promise<void> {
  unwrap(await getSupabase().from('announcements').delete().eq('id', id));
}

export async function upsertCustomCategory(c: Category): Promise<void> {
  unwrap(
    await getSupabase()
      .from('categories')
      .upsert(customCategoryToUpsertRow(c), { onConflict: 'code' })
  );
}

export async function deleteCustomCategory(code: string): Promise<void> {
  unwrap(
    await getSupabase()
      .from('categories')
      .delete()
      .eq('code', code)
      .eq('custom', true)
  );
}

/** Clôture via RPC : le serveur calcule le solde et vérifie le rôle (0005). */
export async function closeSeasonRpc(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('close_season', { p_season: id });
  if (error) throw new Error(error.message);
}

export async function reopenSeasonRpc(
  id: string,
  reason: string
): Promise<void> {
  const { error } = await getSupabase().rpc('reopen_season', {
    p_season: id,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
}
