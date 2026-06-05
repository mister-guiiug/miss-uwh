/**
 * Couche de synchronisation (mode Supabase, offline-first) avec file d'attente
 * PERSISTANTE.
 *
 * Lecture : `pullAll()` hydrate le store depuis le serveur (le serveur fait foi).
 * Écriture : chaque mutation locale est ENFILÉE (persistée) puis drainée vers
 * Supabase. Hors ligne / panne réseau → l'opération reste en file et sera rejouée
 * à la reconnexion (`online`). Échec PERMANENT (rejet serveur, ex. RLS) → lettre
 * morte, sans bloquer la file.
 *
 * Conflits : upsert idempotent (UUID client) → dernier-écrivain-gagne ; après un
 * drain complet à la reconnexion, on re-`pullAll()` pour réconcilier les
 * changements d'autres utilisateurs. Le store local reste utilisable hors ligne.
 */
import type { AppData } from '../shared/types/domain.ts';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAppStore } from '../store/useAppStore.ts';
import { SCHEMA_VERSION, createEmptyData } from '../shared/lib/seed.ts';
import { getSupabase } from '../lib/supabase.ts';
import { setCurrentClubId } from './clubContext.ts';
import { setRemoteHandler, type RemoteOp } from './syncBus.ts';
import * as q from './syncQueue.ts';
import * as repo from './supabaseRepository.ts';

function setStatus(
  state: 'idle' | 'syncing' | 'ready' | 'error',
  error?: string
) {
  useAppStore.getState().setSyncStatus({ state, error });
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** Une erreur transitoire (réseau) est réessayable ; sinon c'est un rejet serveur. */
function isTransient(message: string): boolean {
  return /fetch|network|timeout|offline|connexion|connection|econn|enotfound/i.test(
    message
  );
}

/** Pull complet → hydrate le store. Le serveur est la source de vérité. */
export async function pullAll(): Promise<void> {
  setStatus('syncing');
  try {
    const [
      club,
      seasons,
      events,
      entries,
      audit,
      attachments,
      recurrings,
      adherents,
      customCategories,
      guardians,
      clubEvents,
      announcements,
      tournaments,
      trainingSessions,
      exercises,
      strategies,
      referees,
      photoAlbums,
    ] = await Promise.all([
      repo.fetchClub(),
      repo.fetchSeasons(),
      repo.fetchEvents(),
      repo.fetchEntries(),
      repo.fetchAudit(),
      repo.fetchAttachments(),
      repo.fetchRecurrings(),
      repo.fetchAdherents(),
      repo.fetchCustomCategories(),
      repo.fetchGuardians(),
      repo.fetchClubEvents(),
      repo.fetchAnnouncements(),
      repo.fetchTournaments(),
      repo.fetchTrainingSessions(),
      repo.fetchExercises(),
      repo.fetchStrategies(),
      repo.fetchReferees(),
      repo.fetchPhotoAlbums(),
    ]);

    if (club) setCurrentClubId(club.id);

    // Rattache les justificatifs (table séparée) à leurs écritures.
    const byEntry = new Map<string, typeof attachments>();
    for (const a of attachments) {
      const list = byEntry.get(a.entryId) ?? [];
      list.push(a);
      byEntry.set(a.entryId, list);
    }
    for (const e of entries) {
      e.attachments = (byEntry.get(e.id) ?? []).map(a => a.att);
    }

    const prev = useAppStore.getState().data;
    const fallback = createEmptyData(club?.name ?? 'Mon club');
    const seasonList = seasons.length > 0 ? seasons : fallback.seasons;
    const activeSeasonId = seasonList.some(s => s.id === prev.activeSeasonId)
      ? prev.activeSeasonId
      : seasonList[0]!.id;

    const data: AppData = {
      version: SCHEMA_VERSION,
      club: club
        ? { name: club.name, ffessmAffiliation: club.ffessmAffiliation }
        : prev.club,
      seasons: seasonList,
      activeSeasonId,
      entries,
      events,
      recurrings,
      customCategories,
      adherents,
      guardians,
      clubEvents,
      announcements,
      tournaments,
      trainingSessions,
      exercises,
      strategies,
      referees,
      photoAlbums,
      audit,
      settings: prev.settings, // préférence d'appareil : reste locale
      onboarded: true,
    };

    useAppStore.getState().hydrate(data);
    setStatus('ready');
  } catch (e) {
    setStatus(
      'error',
      e instanceof Error ? e.message : 'Synchronisation impossible'
    );
  }
}

async function applyOp(op: RemoteOp): Promise<void> {
  switch (op.kind) {
    case 'entry.upsert':
      return repo.upsertEntry(op.entry);
    case 'entry.bulkUpsert':
      return repo.upsertEntries(op.entries);
    case 'season.upsert':
      return repo.upsertSeason(op.season);
    case 'season.close':
      return repo.closeSeasonRpc(op.id);
    case 'season.reopen':
      return repo.reopenSeasonRpc(op.id, op.reason);
    case 'event.upsert':
      return repo.upsertEvent(op.event);
    case 'event.delete':
      return repo.deleteEvent(op.id);
    case 'recurring.upsert':
      return repo.upsertRecurring(op.recurring);
    case 'recurring.delete':
      return repo.deleteRecurring(op.id);
    case 'adherent.upsert':
      return repo.upsertAdherent(op.adherent);
    case 'adherent.delete':
      return repo.deleteAdherent(op.id);
    case 'guardian.upsert':
      return repo.upsertGuardian(op.guardian);
    case 'guardian.delete':
      return repo.deleteGuardian(op.id);
    case 'clubevent.upsert':
      return repo.upsertClubEvent(op.clubEvent);
    case 'clubevent.delete':
      return repo.deleteClubEvent(op.id);
    case 'announcement.upsert':
      return repo.upsertAnnouncement(op.announcement);
    case 'announcement.delete':
      return repo.deleteAnnouncement(op.id);
    case 'tournament.upsert':
      return repo.upsertTournament(op.tournament);
    case 'tournament.delete':
      return repo.deleteTournament(op.id);
    case 'session.upsert':
      return repo.upsertTrainingSession(op.session);
    case 'session.delete':
      return repo.deleteTrainingSession(op.id);
    case 'exercise.upsert':
      return repo.upsertExercise(op.exercise);
    case 'exercise.delete':
      return repo.deleteExercise(op.id);
    case 'strategy.upsert':
      return repo.upsertStrategy(op.strategy);
    case 'strategy.delete':
      return repo.deleteStrategy(op.id);
    case 'referee.upsert':
      return repo.upsertReferee(op.referee);
    case 'referee.delete':
      return repo.deleteReferee(op.id);
    case 'album.upsert':
      return repo.upsertPhotoAlbum(op.album);
    case 'album.delete':
      return repo.deletePhotoAlbum(op.id);
    case 'category.upsert':
      return repo.upsertCustomCategory(op.category);
    case 'category.delete':
      return repo.deleteCustomCategory(op.code);
  }
}

function reportQueueStatus(): void {
  const dead = q.deadCount();
  const pending = q.pendingCount();
  if (dead > 0) setStatus('error', `${dead} opération(s) en échec`);
  else if (pending > 0)
    setStatus('error', `Hors ligne — ${pending} en attente`);
  else setStatus('ready');
}

let draining = false;

/** Vide la file vers Supabase (en série, ordre préservé). */
export async function drain(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    if (q.pendingCount() > 0) setStatus('syncing');
    let item = q.peek();
    while (item) {
      if (isOffline()) break;
      try {
        await applyOp(item.op);
        q.ack(item.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'erreur';
        if (isTransient(msg)) {
          q.bumpAttempt(item.id, msg); // réseau : on garde, on réessaiera
          break;
        }
        q.deadLetter(item.id, msg); // rejet serveur : lettre morte, on continue
      }
      item = q.peek();
    }
    reportQueueStatus();
  } finally {
    draining = false;
  }
}

async function onOnline(): Promise<void> {
  await drain();
  if (q.pendingCount() === 0 && q.deadCount() === 0) await pullAll();
}

// ── Realtime : réconciliation en direct (plusieurs trésoriers) ────────
let channel: RealtimeChannel | null = null;
let pullTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleReconcilePull(): void {
  if (pullTimer) clearTimeout(pullTimer);
  pullTimer = setTimeout(() => {
    // On ne re-pull que si rien n'est en attente : éviter d'écraser des
    // écritures locales non encore poussées.
    if (q.pendingCount() === 0 && !draining) void pullAll();
  }, 1200);
}

function subscribeRealtime(): void {
  const sb = getSupabase();
  channel = sb
    .channel('miss-uwh-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'entries' },
      scheduleReconcilePull
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'seasons' },
      scheduleReconcilePull
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'events' },
      scheduleReconcilePull
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'recurrings' },
      scheduleReconcilePull
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'adherents' },
      scheduleReconcilePull
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'guardians' },
      scheduleReconcilePull
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'club_events' },
      scheduleReconcilePull
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'announcements' },
      scheduleReconcilePull
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tournaments' },
      scheduleReconcilePull
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'training_sessions' },
      scheduleReconcilePull
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'exercises' },
      scheduleReconcilePull
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'strategies' },
      scheduleReconcilePull
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'referees' },
      scheduleReconcilePull
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'photo_albums' },
      scheduleReconcilePull
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'categories' },
      scheduleReconcilePull
    )
    .subscribe();
}

function unsubscribeRealtime(): void {
  if (channel) {
    void getSupabase().removeChannel(channel);
    channel = null;
  }
  if (pullTimer) {
    clearTimeout(pullTimer);
    pullTimer = null;
  }
}

/** Branche le push (enfilage + drain), l'écoute des reconnexions et le Realtime. */
export function startSync(): void {
  setRemoteHandler(op => {
    q.enqueue(op);
    void drain();
  });
  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
  }
  subscribeRealtime();
}

export function stopSync(): void {
  setRemoteHandler(null);
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', onOnline);
  }
  unsubscribeRealtime();
}

/** Démarrage : on pousse d'abord les écritures en attente, puis on réconcilie. */
export async function initialSync(): Promise<void> {
  await drain();
  await pullAll();
}

/** Bouton « Réessayer » : rejoue la file puis réconcilie si vide. */
export async function retrySync(): Promise<void> {
  await drain();
  if (q.pendingCount() === 0) await pullAll();
}
