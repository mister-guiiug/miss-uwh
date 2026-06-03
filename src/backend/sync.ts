/**
 * Couche de synchronisation (mode Supabase, offline-first).
 *
 * Lecture : `pullAll()` hydrate le store local depuis le serveur à la connexion
 * (le serveur fait foi). Écriture : `startSync()` branche un handler qui pousse
 * chaque mutation locale vers Supabase, EN SÉRIE (ordre préservé) ; les triggers
 * serveur gèrent version/audit/verrou. Toute erreur est remontée dans le statut
 * de synchronisation (jamais propagée dans l'UI) — l'app reste utilisable hors
 * ligne sur le cache local.
 *
 * Limites assumées (V2) : dernier-écrivain-gagne, pas encore de file d'attente
 * persistante hors ligne ni d'upload des justificatifs. À éprouver sur un projet
 * Supabase réel.
 */
import type { AppData } from '../shared/types/domain.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { SCHEMA_VERSION, createEmptyData } from '../shared/lib/seed.ts';
import { setCurrentClubId } from './clubContext.ts';
import { setRemoteHandler, type RemoteOp } from './syncBus.ts';
import * as repo from './supabaseRepository.ts';

function setStatus(
  state: 'idle' | 'syncing' | 'ready' | 'error',
  error?: string
) {
  useAppStore.getState().setSyncStatus({ state, error });
}

/** Pull complet → hydrate le store. Le serveur est la source de vérité. */
export async function pullAll(): Promise<void> {
  setStatus('syncing');
  try {
    const [club, seasons, events, entries, audit] = await Promise.all([
      repo.fetchClub(),
      repo.fetchSeasons(),
      repo.fetchEvents(),
      repo.fetchEntries(),
      repo.fetchAudit(),
    ]);

    if (club) setCurrentClubId(club.id);

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
      settings: prev.settings, // réglages d'affichage restent locaux
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

// File d'écriture sérielle : préserve l'ordre des mutations.
let chain: Promise<void> = Promise.resolve();

async function apply(op: RemoteOp): Promise<void> {
  setStatus('syncing');
  try {
    switch (op.kind) {
      case 'entry.upsert':
        await repo.upsertEntry(op.entry);
        break;
      case 'entry.bulkUpsert':
        await repo.upsertEntries(op.entries);
        break;
      case 'season.upsert':
        await repo.upsertSeason(op.season);
        break;
      case 'event.upsert':
        await repo.upsertEvent(op.event);
        break;
      case 'event.delete':
        await repo.deleteEvent(op.id);
        break;
    }
    setStatus('ready');
  } catch (e) {
    setStatus(
      'error',
      e instanceof Error ? e.message : 'Échec de synchronisation'
    );
  }
}

/** Branche le push des mutations locales vers Supabase. */
export function startSync(): void {
  setRemoteHandler(op => {
    chain = chain.then(() => apply(op));
  });
}

export function stopSync(): void {
  setRemoteHandler(null);
}
