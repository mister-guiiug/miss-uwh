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
  AiClubConfig,
  Announcement,
  Attachment,
  AuditEvent,
  Category,
  Club,
  ClubEvent,
  EventLedger,
  Exercise,
  Guardian,
  JournalEntry,
  PhotoAlbum,
  RecurringTemplate,
  Referee,
  Season,
  Strategy,
  TrainingSession,
  Tournament,
} from '../shared/types/domain.ts';
import { getSupabase } from '../lib/supabase.ts';
import { getCurrentClubId } from './clubContext.ts';
import {
  adherentToUpsertRow,
  aiConfigToUpsertRow,
  announcementToUpsertRow,
  clubEventToUpsertRow,
  customCategoryToUpsertRow,
  entryToUpsertRow,
  eventToRow,
  exerciseToUpsertRow,
  guardianToUpsertRow,
  photoAlbumToUpsertRow,
  recurringToUpsertRow,
  refereeToUpsertRow,
  rowToAdherent,
  rowToAiClubConfig,
  rowToAnnouncement,
  rowToAttachment,
  rowToAudit,
  rowToCategory,
  rowToClub,
  rowToClubEvent,
  rowToEntry,
  rowToEvent,
  rowToExercise,
  rowToGuardian,
  rowToPhotoAlbum,
  rowToRecurring,
  rowToReferee,
  rowToSeason,
  rowToStrategy,
  rowToTournament,
  rowToTrainingSession,
  seasonToUpsertRow,
  strategyToUpsertRow,
  tournamentToUpsertRow,
  trainingSessionToUpsertRow,
  type AdherentRow,
  type AiConfigRow,
  type AnnouncementRow,
  type AttachmentRow,
  type AuditRow,
  type CategoryRow,
  type ClubEventRow,
  type ClubRow,
  type EntryRow,
  type EventRow,
  type ExerciseRow,
  type GuardianRow,
  type PhotoAlbumRow,
  type RecurringRow,
  type RefereeRow,
  type SeasonRow,
  type StrategyRow,
  type TournamentRow,
  type TrainingSessionRow,
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

export async function fetchAiConfig(): Promise<AiClubConfig | null> {
  const rows = unwrap(
    await getSupabase().from('ai_config').select('*').limit(1)
  ) as AiConfigRow[];
  return rows[0] ? rowToAiClubConfig(rows[0]) : null;
}

export async function upsertAiConfig(config: AiClubConfig): Promise<void> {
  const clubId = getCurrentClubId();
  if (!clubId) throw new Error('Club courant inconnu (config IA en attente).');
  unwrap(
    await getSupabase()
      .from('ai_config')
      .upsert(aiConfigToUpsertRow(config, clubId), { onConflict: 'club_id' })
  );
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

export async function fetchTournaments(): Promise<Tournament[]> {
  const rows = unwrap(
    await getSupabase().from('tournaments').select('*').order('date')
  ) as TournamentRow[];
  return rows.map(rowToTournament);
}

export async function fetchTrainingSessions(): Promise<TrainingSession[]> {
  const rows = unwrap(
    await getSupabase().from('training_sessions').select('*').order('date')
  ) as TrainingSessionRow[];
  return rows.map(rowToTrainingSession);
}

export async function fetchExercises(): Promise<Exercise[]> {
  const rows = unwrap(
    await getSupabase().from('exercises').select('*').order('name')
  ) as ExerciseRow[];
  return rows.map(rowToExercise);
}

export async function fetchStrategies(): Promise<Strategy[]> {
  const rows = unwrap(
    await getSupabase().from('strategies').select('*').order('name')
  ) as StrategyRow[];
  return rows.map(rowToStrategy);
}

export async function fetchReferees(): Promise<Referee[]> {
  const rows = unwrap(
    await getSupabase().from('referees').select('*').order('name')
  ) as RefereeRow[];
  return rows.map(rowToReferee);
}

export async function fetchPhotoAlbums(): Promise<PhotoAlbum[]> {
  const rows = unwrap(
    await getSupabase().from('photo_albums').select('*').order('date')
  ) as PhotoAlbumRow[];
  return rows.map(rowToPhotoAlbum);
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

export async function upsertTournament(t: Tournament): Promise<void> {
  unwrap(
    await getSupabase()
      .from('tournaments')
      .upsert(tournamentToUpsertRow(t), { onConflict: 'id' })
  );
}

export async function deleteTournament(id: string): Promise<void> {
  unwrap(await getSupabase().from('tournaments').delete().eq('id', id));
}

export async function upsertTrainingSession(s: TrainingSession): Promise<void> {
  unwrap(
    await getSupabase()
      .from('training_sessions')
      .upsert(trainingSessionToUpsertRow(s), { onConflict: 'id' })
  );
}

export async function deleteTrainingSession(id: string): Promise<void> {
  unwrap(await getSupabase().from('training_sessions').delete().eq('id', id));
}

export async function upsertExercise(e: Exercise): Promise<void> {
  unwrap(
    await getSupabase()
      .from('exercises')
      .upsert(exerciseToUpsertRow(e), { onConflict: 'id' })
  );
}

export async function deleteExercise(id: string): Promise<void> {
  unwrap(await getSupabase().from('exercises').delete().eq('id', id));
}

export async function upsertStrategy(s: Strategy): Promise<void> {
  unwrap(
    await getSupabase()
      .from('strategies')
      .upsert(strategyToUpsertRow(s), { onConflict: 'id' })
  );
}

export async function deleteStrategy(id: string): Promise<void> {
  unwrap(await getSupabase().from('strategies').delete().eq('id', id));
}

export async function upsertReferee(r: Referee): Promise<void> {
  unwrap(
    await getSupabase()
      .from('referees')
      .upsert(refereeToUpsertRow(r), { onConflict: 'id' })
  );
}

export async function deleteReferee(id: string): Promise<void> {
  unwrap(await getSupabase().from('referees').delete().eq('id', id));
}

export async function upsertPhotoAlbum(a: PhotoAlbum): Promise<void> {
  unwrap(
    await getSupabase()
      .from('photo_albums')
      .upsert(photoAlbumToUpsertRow(a), { onConflict: 'id' })
  );
}

export async function deletePhotoAlbum(id: string): Promise<void> {
  unwrap(await getSupabase().from('photo_albums').delete().eq('id', id));
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
