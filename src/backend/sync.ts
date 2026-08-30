/**
 * Couche de synchronisation (mode Supabase, offline-first), adossée à la file
 * d'attente PERSISTANTE du SOCLE (`syncQueue.ts`, instance de
 * `@mister-guiiug/dev-wpa-config/sync-queue` — promue depuis ce dépôt).
 *
 * Lecture : `pullAll()` hydrate le store depuis le serveur (le serveur fait foi).
 * Écriture : chaque mutation locale est ENFILÉE (persistée) puis drainée vers
 * Supabase. Hors ligne / panne réseau → l'opération reste en file et sera
 * rejouée à la reconnexion (`online`) ou par le rejeu automatique en backoff du
 * socle. Échec PERMANENT (rejet serveur, ex. RLS) → lettre morte, sans bloquer
 * la file.
 *
 * Conflits : upsert idempotent (UUID client) → dernier-écrivain-gagne ; après un
 * drain complet à la reconnexion, on re-`pullAll()` pour réconcilier les
 * changements d'autres utilisateurs. Le store local reste utilisable hors ligne.
 */
import type { AppData } from '../shared/types/domain.ts';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAppStore } from '../store/useAppStore.ts';
import type { SyncStatus } from '../store/types.ts';
import { SCHEMA_VERSION, createEmptyData } from '../shared/lib/seed.ts';
import { notifyError } from '../shared/lib/toasts.ts';
import { getSupabase } from '../lib/supabase.ts';
import { setCurrentClubId } from './clubContext.ts';
import {
  describeRemoteOp,
  setRemoteHandler,
  type RemoteOp,
} from './syncBus.ts';
import {
  getSyncQueue,
  isTransient,
  setQueueObserver,
  setQueueTransport,
} from './syncQueue.ts';
import * as repo from './supabaseRepository.ts';

/** Conservé entre deux mises à jour de statut (succès du dernier pull). */
let lastSyncAt: number | undefined;

function setStatus(state: SyncStatus['state'], error?: string) {
  const q = getSyncQueue();
  useAppStore.getState().setSyncStatus({
    state,
    error,
    pending: q.pending(),
    dead: q.deadLetters().length,
    lastSyncAt,
  });
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
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
      aiConfig,
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
      repo.fetchAiConfig(),
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
      // Config IA commune (« partie fixe pour tous ») : le serveur fait foi ;
      // à défaut, on conserve la valeur locale (mode hors-ligne / 1re synchro).
      aiConfig: aiConfig ?? prev.aiConfig,
      audit,
      settings: prev.settings, // préférence d'appareil : reste locale
      onboarded: true,
    };

    useAppStore.getState().hydrate(data);
    lastSyncAt = Date.now();
    // Ne pas forcer « ready » : des lettres mortes éventuelles doivent rester
    // visibles (le statut est recalculé depuis l'état réel de la file).
    reportQueueStatus();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Synchronisation impossible';
    // Réseau coupé ou serveur injoignable : pas une « erreur » — les données
    // locales restent utilisables et le pull repartira à la reconnexion.
    if (isOffline() || isTransient(msg)) setStatus('offline');
    else setStatus('error', msg);
  }
}

/** Transport de la file : pousse une opération vers le repository Supabase. */
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
    case 'aiconfig.upsert':
      return repo.upsertAiConfig(op.config);
  }
}

function reportQueueStatus(): void {
  const q = getSyncQueue();
  const dead = q.deadLetters().length;
  const pending = q.pending();
  if (dead > 0)
    setStatus('error', `${dead} opération(s) refusée(s) par le serveur`);
  else if (pending > 0)
    // Des modifications attendent le réseau : état normal du hors ligne,
    // PAS une erreur (elles repartiront seules à la reconnexion).
    setStatus('offline');
  else setStatus('ready');
}

/** Signale qu'une opération vient de partir en lettre morte (toast persistant). */
function notifyDeadLetter(op: RemoteOp): void {
  notifyError(
    `Synchronisation refusée par le serveur : ${describeRemoteOp(op)}. ` +
      'Détails et nouvel essai dans Réglages → État de la base de données.'
  );
}

// Transport et observateur branchés à l'évaluation du module : de purs
// enregistrements de rappels (aucune E/S — la doctrine anti-écran-blanc est
// respectée), et un `drain()` déclenché depuis les Réglages trouve toujours
// son transport, même sans `startSync()` préalable.
setQueueTransport(applyOp);
setQueueObserver({
  // Le socle notifie après chaque évolution de la file (fin de drain comprise) :
  // c'est lui qui rapporte l'état final ready / offline / error.
  onChange: () => reportQueueStatus(),
  onDead: op => notifyDeadLetter(op),
});

/**
 * Vide la file vers Supabase — drain SÉRIALISÉ du socle (ordre préservé, rejeu
 * automatique en backoff sur échec transitoire, lettre morte sur rejet).
 */
export async function drain(): Promise<void> {
  const q = getSyncQueue();
  if (q.pending() > 0) setStatus('syncing');
  await q.flush();
}

async function onOnline(): Promise<void> {
  await drain();
  // Réconcilie dès que la file est vide — même si des lettres mortes
  // subsistent : elles restent signalées (reportQueueStatus) mais ne doivent
  // pas priver l'appareil des changements des autres utilisateurs.
  if (getSyncQueue().pending() === 0) await pullAll();
}

/** Coupure réseau : reflète immédiatement l'état (modifications en attente). */
function onOffline(): void {
  reportQueueStatus();
}

// ── Realtime : réconciliation en direct (plusieurs trésoriers) ────────
let channel: RealtimeChannel | null = null;
let pullTimer: ReturnType<typeof setTimeout> | null = null;
/** Invalide un abonnement encore en cours de création (client asynchrone). */
let realtimeGen = 0;

function scheduleReconcilePull(): void {
  if (pullTimer) clearTimeout(pullTimer);
  pullTimer = setTimeout(() => {
    // On ne re-pull que si rien n'est en attente : éviter d'écraser des
    // écritures locales non encore poussées (un drain en cours garde
    // l'opération en file jusqu'à l'acquittement, donc `pending() > 0`).
    if (getSyncQueue().pending() === 0) void pullAll();
  }, 1200);
}

const REALTIME_TABLES = [
  'entries',
  'seasons',
  'events',
  'recurrings',
  'adherents',
  'guardians',
  'club_events',
  'announcements',
  'tournaments',
  'training_sessions',
  'exercises',
  'strategies',
  'referees',
  'photo_albums',
  'categories',
  'ai_config',
] as const;

async function subscribeRealtime(): Promise<void> {
  const gen = ++realtimeGen;
  // SDK injoignable : la synchro pull/push reste fonctionnelle sans Realtime.
  const sb = await getSupabase().catch(() => null);
  if (!sb) return;
  if (gen !== realtimeGen) return; // stopSync() est passé entre-temps
  let ch = sb.channel('miss-uwh-sync');
  for (const table of REALTIME_TABLES) {
    ch = ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      scheduleReconcilePull
    );
  }
  channel = ch.subscribe();
}

function unsubscribeRealtime(): void {
  realtimeGen += 1;
  if (channel) {
    const ch = channel;
    channel = null;
    void getSupabase()
      .then(sb => sb.removeChannel(ch))
      .catch(() => {
        /* client indisponible : le canal meurt avec la page */
      });
  }
  if (pullTimer) {
    clearTimeout(pullTimer);
    pullTimer = null;
  }
}

/** Branche le push (enfilage + drain), l'écoute des reconnexions et le Realtime. */
export function startSync(): void {
  setRemoteHandler(op => {
    if (getSyncQueue().enqueue(op) === null)
      // Plafond du socle atteint : refuser VISIBLEMENT plutôt que perdre en
      // silence — l'utilisateur peut réessayer une fois la file drainée.
      notifyError(
        `File de synchronisation saturée : ${describeRemoteOp(op)} n'a pas pu être mis en attente. Réessayez une fois la connexion rétablie.`
      );
    void drain();
  });
  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
  }
  void subscribeRealtime();
}

export function stopSync(): void {
  setRemoteHandler(null);
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  }
  getSyncQueue().stop(); // annule le rejeu programmé ; la file, elle, persiste
  lastSyncAt = undefined; // appareil partagé : pas d'horodatage inter-comptes
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
  if (getSyncQueue().pending() === 0) await pullAll();
}

/**
 * Réglages : redonne leur chance aux opérations refusées (lettres mortes) —
 * utile après correction côté serveur (droits, données) — puis réconcilie.
 */
export async function retryDeadOps(): Promise<void> {
  getSyncQueue().requeueDead();
  await retrySync();
}

/** Réglages : abandonne définitivement les opérations refusées. */
export function discardDeadOps(): void {
  // L'observateur (`onChange`) recalcule le statut après la purge.
  getSyncQueue().clearDead();
}
