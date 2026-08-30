import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// La couche réseau (repo Supabase) est mockée : on teste l'ORCHESTRATION
// (drain via la file du socle, classification d'erreurs, lettre morte,
// hydratation) sans serveur.
vi.mock('./supabaseRepository.ts', () => ({
  // Lectures (pullAll)
  fetchClub: vi.fn(),
  fetchSeasons: vi.fn(),
  fetchEvents: vi.fn(),
  fetchEntries: vi.fn(),
  fetchAudit: vi.fn(),
  fetchAttachments: vi.fn(),
  fetchRecurrings: vi.fn(),
  fetchAdherents: vi.fn(),
  fetchCustomCategories: vi.fn(),
  fetchGuardians: vi.fn(),
  fetchClubEvents: vi.fn(),
  fetchAnnouncements: vi.fn(),
  fetchTournaments: vi.fn(),
  fetchTrainingSessions: vi.fn(),
  fetchExercises: vi.fn(),
  fetchStrategies: vi.fn(),
  fetchReferees: vi.fn(),
  fetchPhotoAlbums: vi.fn(),
  fetchAiConfig: vi.fn(),
  // Écritures (drain)
  deleteEvent: vi.fn(),
  upsertEntry: vi.fn(),
  upsertAiConfig: vi.fn(),
}));

import * as repo from './supabaseRepository.ts';
import { MAX_TRANSIENT_ATTEMPTS, getSyncQueue } from './syncQueue.ts';
import { drain, pullAll, retryDeadOps } from './sync.ts';
import { useAppStore } from '../store/useAppStore.ts';

const FETCHES = [
  'fetchClub',
  'fetchSeasons',
  'fetchEvents',
  'fetchEntries',
  'fetchAudit',
  'fetchAttachments',
  'fetchRecurrings',
  'fetchAdherents',
  'fetchCustomCategories',
  'fetchGuardians',
  'fetchClubEvents',
  'fetchAnnouncements',
  'fetchTournaments',
  'fetchTrainingSessions',
  'fetchExercises',
  'fetchStrategies',
  'fetchReferees',
  'fetchPhotoAlbums',
] as const;

/** La file du socle instanciée par l'app (sync.ts y branche le transport). */
const queue = () => getSyncQueue();

beforeEach(() => {
  queue().clear();
  vi.clearAllMocks();
  vi.useFakeTimers(); // empêche le rejeu programmé (backoff) de partir tout seul
  // Par défaut, toutes les lectures renvoient vide.
  for (const f of FETCHES) {
    (repo[f] as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  }
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('drain', () => {
  it('succès : l’opération est acquittée (file vidée)', async () => {
    vi.mocked(repo.deleteEvent).mockResolvedValue(undefined);
    queue().enqueue({ kind: 'event.delete', id: 'ev1' });

    await drain();

    expect(repo.deleteEvent).toHaveBeenCalledWith('ev1');
    expect(queue().pending()).toBe(0);
    expect(queue().deadLetters()).toHaveLength(0);
  });

  it('rejet permanent (RLS) : l’opération part en lettre morte', async () => {
    vi.mocked(repo.deleteEvent).mockRejectedValue(
      new Error('permission denied (RLS)')
    );
    queue().enqueue({ kind: 'event.delete', id: 'ev1' });

    await drain();

    expect(queue().pending()).toBe(0);
    expect(queue().deadLetters()).toHaveLength(1);
    expect(queue().deadLetters()[0]?.lastError).toContain('permission denied');
  });

  it('erreur transitoire (réseau) : l’opération est conservée et comptée', async () => {
    vi.mocked(repo.deleteEvent).mockRejectedValue(new Error('network timeout'));
    queue().enqueue({ kind: 'event.delete', id: 'ev1' });

    await drain();

    expect(queue().pending()).toBe(1);
    expect(queue().deadLetters()).toHaveLength(0);
    expect(queue().list()[0]?.attempts).toBe(1);
  });

  it('s’arrête au premier échec transitoire (ordre préservé)', async () => {
    vi.mocked(repo.deleteEvent).mockRejectedValue(new Error('network down'));
    queue().enqueue({ kind: 'event.delete', id: 'ev1' });
    queue().enqueue({ kind: 'event.delete', id: 'ev2' }); // ne doit pas être tentée

    await drain();

    expect(repo.deleteEvent).toHaveBeenCalledTimes(1);
    expect(repo.deleteEvent).toHaveBeenCalledWith('ev1');
    expect(queue().pending()).toBe(2);
  });

  it('échec transitoire avec ops en attente → statut « offline » (pas une erreur)', async () => {
    vi.mocked(repo.deleteEvent).mockRejectedValue(new Error('network down'));
    queue().enqueue({ kind: 'event.delete', id: 'ev1' });

    await drain();

    expect(useAppStore.getState().syncStatus.state).toBe('offline');
    expect(useAppStore.getState().syncStatus.pending).toBe(1);
  });

  it('échec « transitoire » récidivant : lettre morte au plafond de tentatives', async () => {
    vi.mocked(repo.deleteEvent).mockRejectedValue(new Error('network down'));
    queue().enqueue({ kind: 'event.delete', id: 'ev1' });

    // Chaque drain consomme UNE tentative sur la tête de file ; au plafond,
    // le socle requalifie l'échec en lettre morte.
    for (let i = 0; i < MAX_TRANSIENT_ATTEMPTS; i++) await drain();

    expect(queue().pending()).toBe(0);
    expect(queue().deadLetters()).toHaveLength(1);
    expect(useAppStore.getState().syncStatus.state).toBe('error');
    expect(useAppStore.getState().syncStatus.dead).toBe(1);
  });
});

describe('retryDeadOps', () => {
  it('rejoue les lettres mortes avec succès → file et lettres mortes vides', async () => {
    vi.mocked(repo.deleteEvent)
      .mockRejectedValueOnce(new Error('permission denied (RLS)'))
      .mockResolvedValue(undefined);
    queue().enqueue({ kind: 'event.delete', id: 'ev1' });
    await drain();
    expect(queue().deadLetters()).toHaveLength(1);

    await retryDeadOps();

    expect(queue().deadLetters()).toHaveLength(0);
    expect(queue().pending()).toBe(0);
    expect(useAppStore.getState().syncStatus.state).toBe('ready');
  });
});

describe('pullAll', () => {
  it('hydrate le store et marque l’app comme initialisée', async () => {
    await pullAll();

    const data = useAppStore.getState().data;
    expect(data.onboarded).toBe(true);
    expect(data.seasons.length).toBeGreaterThan(0); // fallback créé si serveur vide
    expect(repo.fetchEntries).toHaveBeenCalled();
  });

  it('passe le statut en erreur si une lecture échoue (rejet serveur)', async () => {
    vi.mocked(repo.fetchEntries).mockRejectedValue(new Error('boom'));

    await pullAll();

    expect(useAppStore.getState().syncStatus.state).toBe('error');
  });

  it('panne réseau au pull → statut « offline », pas une erreur bloquante', async () => {
    vi.mocked(repo.fetchEntries).mockRejectedValue(
      new Error('Failed to fetch')
    );

    await pullAll();

    expect(useAppStore.getState().syncStatus.state).toBe('offline');
  });

  it('pull réussi mais lettres mortes présentes → l’erreur reste visible', async () => {
    vi.mocked(repo.deleteEvent).mockRejectedValue(
      new Error('permission denied')
    );
    queue().enqueue({ kind: 'event.delete', id: 'ev1' });
    await drain(); // → lettre morte

    await pullAll();

    const status = useAppStore.getState().syncStatus;
    expect(status.state).toBe('error');
    expect(status.error).toContain('refusée');
    expect(status.lastSyncAt).toBeTruthy();
  });
});
