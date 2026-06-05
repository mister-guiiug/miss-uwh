import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// La couche réseau (repo Supabase) est mockée : on teste l'ORCHESTRATION
// (drain, classification d'erreurs, lettre morte, hydratation) sans serveur.
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
  // Écritures (drain)
  deleteEvent: vi.fn(),
  upsertEntry: vi.fn(),
}));

import * as repo from './supabaseRepository.ts';
import * as q from './syncQueue.ts';
import { drain, pullAll } from './sync.ts';
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

beforeEach(() => {
  q.clearAll();
  vi.clearAllMocks();
  vi.useFakeTimers(); // empêche le retry programmé de se déclencher tout seul
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
    q.enqueue({ kind: 'event.delete', id: 'ev1' });

    await drain();

    expect(repo.deleteEvent).toHaveBeenCalledWith('ev1');
    expect(q.pendingCount()).toBe(0);
    expect(q.deadCount()).toBe(0);
  });

  it('rejet permanent (RLS) : l’opération part en lettre morte', async () => {
    vi.mocked(repo.deleteEvent).mockRejectedValue(
      new Error('permission denied (RLS)')
    );
    q.enqueue({ kind: 'event.delete', id: 'ev1' });

    await drain();

    expect(q.pendingCount()).toBe(0);
    expect(q.deadCount()).toBe(1);
    expect(q.deadItems()[0]?.lastError).toContain('permission denied');
  });

  it('erreur transitoire (réseau) : l’opération est conservée et comptée', async () => {
    vi.mocked(repo.deleteEvent).mockRejectedValue(new Error('network timeout'));
    q.enqueue({ kind: 'event.delete', id: 'ev1' });

    await drain();

    expect(q.pendingCount()).toBe(1);
    expect(q.deadCount()).toBe(0);
    expect(q.peek()?.attempts).toBe(1);
  });

  it('s’arrête au premier échec transitoire (ordre préservé)', async () => {
    vi.mocked(repo.deleteEvent).mockRejectedValue(new Error('network down'));
    q.enqueue({ kind: 'event.delete', id: 'ev1' });
    q.enqueue({ kind: 'event.delete', id: 'ev2' }); // ne doit pas être tentée

    await drain();

    expect(repo.deleteEvent).toHaveBeenCalledTimes(1);
    expect(repo.deleteEvent).toHaveBeenCalledWith('ev1');
    expect(q.pendingCount()).toBe(2);
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

  it('passe le statut en erreur si une lecture échoue', async () => {
    vi.mocked(repo.fetchEntries).mockRejectedValue(new Error('boom'));

    await pullAll();

    expect(useAppStore.getState().syncStatus.state).toBe('error');
  });
});
