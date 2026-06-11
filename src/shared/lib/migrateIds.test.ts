import { describe, expect, it } from 'vitest';
import { isUuid, remapNonUuidSyncIds } from './migrateIds.ts';

describe('isUuid', () => {
  it('reconnaît un UUID v4 et rejette les ids courts du seed', () => {
    expect(isUuid('be775a20-6f6f-4f6f-8f6f-6f6f6f6f6f6f')).toBe(true);
    expect(isUuid('sea_be775a20')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(42)).toBe(false);
  });
});

describe('remapNonUuidSyncIds', () => {
  it('réécrit la saison en UUID et propage aux écritures + à la saison active', () => {
    const data = {
      activeSeasonId: 'sea_be775a20',
      seasons: [{ id: 'sea_be775a20', label: '2025-2026' }],
      entries: [
        { id: 'ec_1', seasonId: 'sea_be775a20' },
        { id: 'ec_2', seasonId: 'sea_be775a20' },
      ],
    };

    remapNonUuidSyncIds(data);

    const newId = data.seasons[0].id;
    expect(isUuid(newId)).toBe(true);
    expect(data.activeSeasonId).toBe(newId);
    expect(data.entries[0].seasonId).toBe(newId);
    expect(data.entries[1].seasonId).toBe(newId);
    expect(isUuid(data.entries[0].id)).toBe(true);
  });

  it('propage le remappage des événements (eventId des écritures et tournois)', () => {
    const data = {
      seasons: [{ id: 'sea_a' }],
      events: [{ id: 'ev_1', seasonId: 'sea_a' }],
      entries: [{ id: 'ec_1', seasonId: 'sea_a', eventId: 'ev_1' }],
      tournaments: [{ id: 'tr_1', seasonId: 'sea_a', eventId: 'ev_1' }],
    };

    remapNonUuidSyncIds(data);

    const evId = data.events[0].id;
    expect(isUuid(evId)).toBe(true);
    expect(data.entries[0].eventId).toBe(evId);
    expect(data.tournaments[0].eventId).toBe(evId);
    expect(data.entries[0].seasonId).toBe(data.seasons[0].id);
  });

  it('propage le remappage des adhérents (tuteurs, coach, présences)', () => {
    const data = {
      seasons: [{ id: 'sea_a' }],
      adherents: [{ id: 'adh_1', seasonId: 'sea_a' }],
      guardians: [{ id: 'g1-uuid', memberId: 'adh_1' }],
      trainingSessions: [
        {
          id: 'ts_1',
          seasonId: 'sea_a',
          coachId: 'adh_1',
          attendance: ['adh_1', 'inconnu'],
          plan: [{ exerciseId: 'ex_1' }],
        },
      ],
      exercises: [{ id: 'ex_1', seasonId: 'sea_a' }],
    };

    remapNonUuidSyncIds(data);

    const adhId = data.adherents[0].id;
    expect(isUuid(adhId)).toBe(true);
    expect(data.guardians[0].memberId).toBe(adhId);
    expect(data.trainingSessions[0].coachId).toBe(adhId);
    expect(data.trainingSessions[0].attendance[0]).toBe(adhId);
    // Référence pendante (aucune entité correspondante) : laissée telle quelle.
    expect(data.trainingSessions[0].attendance[1]).toBe('inconnu');
    expect(data.trainingSessions[0].plan[0].exerciseId).toBe(
      data.exercises[0].id
    );
  });

  it('laisse intactes les données déjà au format UUID (idempotent)', () => {
    const uuid = 'be775a20-6f6f-4f6f-8f6f-6f6f6f6f6f6f';
    const data = {
      activeSeasonId: uuid,
      seasons: [{ id: uuid, label: '2025-2026' }],
      entries: [{ id: '11111111-2222-4333-8444-555555555555', seasonId: uuid }],
    };
    const snapshot = structuredClone(data);

    remapNonUuidSyncIds(data);

    expect(data).toEqual(snapshot);
  });

  it('ne casse pas sur des collections absentes ou des entrées non valides', () => {
    expect(() => remapNonUuidSyncIds(null)).not.toThrow();
    expect(() => remapNonUuidSyncIds(undefined)).not.toThrow();
    expect(() => remapNonUuidSyncIds({})).not.toThrow();
    expect(() =>
      remapNonUuidSyncIds({ seasons: [null, { id: 'sea_a' }, 7] })
    ).not.toThrow();
  });
});
