/**
 * Tests du GLUE applicatif autour de la file du socle : clé d'entité,
 * classification des erreurs et migration de l'ancien format d'entrées.
 * La mécanique de file (enfilage, drain, backoff, lettres mortes, fusion)
 * appartient au socle (`@mister-guiiug/dev-pwa-config/sync-queue`) et y est
 * testée ; elle n'est plus re-testée ici.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { RemoteOp } from './syncBus.ts';
import { entityKey, isTransient, migrateLegacyItems } from './syncQueue.ts';

const QUEUE_KEY = 'miss-uwh:syncqueue';
const DEAD_KEY = 'miss-uwh:syncdead';

describe('entityKey', () => {
  it('upsert et delete d’une même entité partagent la même clé (fusion)', () => {
    const up: RemoteOp = {
      kind: 'event.upsert',
      event: { id: 'x', seasonId: 's', name: 'Tournoi', kind: 'tournoi' },
    };
    const del: RemoteOp = { kind: 'event.delete', id: 'x' };
    expect(entityKey(up)).toBe('event:x');
    expect(entityKey(del)).toBe('event:x');
  });

  it('la config IA est un singleton club', () => {
    expect(
      entityKey({ kind: 'aiconfig.upsert', config: { sharedSkills: 's' } })
    ).toBe('aiconfig');
  });

  it('lots et changements d’état ne fusionnent jamais', () => {
    expect(entityKey({ kind: 'entry.bulkUpsert', entries: [] })).toBeNull();
    expect(entityKey({ kind: 'season.close', id: 's1' })).toBeNull();
    expect(
      entityKey({ kind: 'season.reopen', id: 's1', reason: 'erreur' })
    ).toBeNull();
  });
});

describe('isTransient', () => {
  it.each([
    'Failed to fetch', // Chrome
    'Load failed', // Safari
    'NetworkError when attempting to fetch a resource.', // Firefox
    'connect ETIMEDOUT', // timeout
    'JWT expired', // jeton à rafraîchir
    '503 Service Unavailable',
  ])('réessayable : %s', msg => {
    expect(isTransient(msg)).toBe(true);
  });

  it.each(['permission denied (RLS)', 'duplicate key value', 'invalid input'])(
    'rejet serveur : %s',
    msg => {
      expect(isTransient(msg)).toBe(false);
    }
  );
});

describe('migrateLegacyItems', () => {
  beforeEach(() => {
    localStorage.removeItem(QUEUE_KEY);
    localStorage.removeItem(DEAD_KEY);
  });

  it('reprend les écritures en attente de l’ancien format (même clé localStorage)', () => {
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([
        {
          id: 'q_1',
          op: { kind: 'event.delete', id: 'ev1' },
          attempts: 2,
          lastError: 'réseau',
        },
        { id: 'q_2', op: { kind: 'season.close', id: 's1' }, attempts: 0 },
      ])
    );

    migrateLegacyItems('queue');

    const items = JSON.parse(localStorage.getItem(QUEUE_KEY)!) as Array<
      Record<string, unknown>
    >;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: 'q_1',
      payload: { kind: 'event.delete', id: 'ev1' },
      key: 'event:ev1',
      attempts: 2,
      lastError: 'réseau',
    });
    expect(items[0]!.op).toBeUndefined(); // plus d’ancien champ
    expect(items[0]!.enqueuedAt).toEqual(expect.any(String));
    // Op non fusionnable : clé nulle, comme l’aurait produite le socle.
    expect(items[1]).toMatchObject({ id: 'q_2', key: null, attempts: 0 });
  });

  it('reprend aussi les lettres mortes', () => {
    localStorage.setItem(
      DEAD_KEY,
      JSON.stringify([
        {
          id: 'q_9',
          op: { kind: 'event.delete', id: 'ev9' },
          attempts: 3,
          lastError: 'permission denied',
        },
      ])
    );

    migrateLegacyItems('dead');

    const items = JSON.parse(localStorage.getItem(DEAD_KEY)!) as Array<
      Record<string, unknown>
    >;
    expect(items[0]).toMatchObject({
      id: 'q_9',
      payload: { kind: 'event.delete', id: 'ev9' },
      key: 'event:ev9',
      lastError: 'permission denied',
    });
  });

  it('idempotente : une entrée déjà au format socle est laissée intacte', () => {
    const socleItem = {
      id: 'q_3',
      payload: { kind: 'event.delete', id: 'ev3' },
      key: 'event:ev3',
      attempts: 1,
      enqueuedAt: '2026-08-01T00:00:00.000Z',
    };
    localStorage.setItem(QUEUE_KEY, JSON.stringify([socleItem]));

    migrateLegacyItems('queue');

    expect(JSON.parse(localStorage.getItem(QUEUE_KEY)!)).toEqual([socleItem]);
  });

  it('mélange ancien/nouveau : seul l’ancien est converti, l’ordre est préservé', () => {
    const socleItem = {
      id: 'q_new',
      payload: { kind: 'event.delete', id: 'ev2' },
      key: 'event:ev2',
      attempts: 0,
      enqueuedAt: '2026-08-01T00:00:00.000Z',
    };
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([
        { id: 'q_old', op: { kind: 'event.delete', id: 'ev1' } },
        socleItem,
      ])
    );

    migrateLegacyItems('queue');

    const items = JSON.parse(localStorage.getItem(QUEUE_KEY)!) as Array<
      Record<string, unknown>
    >;
    expect(items.map(i => i.id)).toEqual(['q_old', 'q_new']);
    expect(items[0]).toMatchObject({ key: 'event:ev1', attempts: 0 });
    expect(items[1]).toEqual(socleItem);
  });

  it('contenu illisible ou absent : aucune exception, rien n’est écrit', () => {
    localStorage.setItem(QUEUE_KEY, 'pas du JSON');
    expect(() => migrateLegacyItems('queue')).not.toThrow();
    expect(localStorage.getItem(QUEUE_KEY)).toBe('pas du JSON');

    localStorage.removeItem(QUEUE_KEY);
    expect(() => migrateLegacyItems('queue')).not.toThrow();
    expect(localStorage.getItem(QUEUE_KEY)).toBeNull();
  });
});
