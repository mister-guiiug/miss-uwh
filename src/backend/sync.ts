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
import { useAppStore } from '../store/useAppStore.ts';
import { SCHEMA_VERSION, createEmptyData } from '../shared/lib/seed.ts';
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
    const [club, seasons, events, entries, audit, attachments] =
      await Promise.all([
        repo.fetchClub(),
        repo.fetchSeasons(),
        repo.fetchEvents(),
        repo.fetchEntries(),
        repo.fetchAudit(),
        repo.fetchAttachments(),
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
      audit,
      settings: prev.settings,
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
    case 'event.upsert':
      return repo.upsertEvent(op.event);
    case 'event.delete':
      return repo.deleteEvent(op.id);
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

/** Branche le push (enfilage + drain) et l'écoute des reconnexions. */
export function startSync(): void {
  setRemoteHandler(op => {
    q.enqueue(op);
    void drain();
  });
  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
  }
}

export function stopSync(): void {
  setRemoteHandler(null);
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', onOnline);
  }
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
