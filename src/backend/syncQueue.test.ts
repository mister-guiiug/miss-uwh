import { beforeEach, describe, expect, it } from 'vitest';
import type { RemoteOp } from './syncBus.ts';
import {
  ack,
  backoffDelay,
  bumpAttempt,
  clearAll,
  deadCount,
  deadItems,
  deadLetter,
  enqueue,
  peek,
  pendingCount,
  queued,
  requeueDead,
} from './syncQueue.ts';

const op = (id: string): RemoteOp => ({ kind: 'event.delete', id });

describe('backoffDelay', () => {
  const noJitter = () => 0.5; // (rand*2-1)=0 → jitter nul, valeurs exactes

  it('croît exponentiellement depuis la base', () => {
    expect(backoffDelay(1, 1000, 60_000, noJitter)).toBe(1000);
    expect(backoffDelay(2, 1000, 60_000, noJitter)).toBe(2000);
    expect(backoffDelay(3, 1000, 60_000, noJitter)).toBe(4000);
    expect(backoffDelay(4, 1000, 60_000, noJitter)).toBe(8000);
  });

  it('plafonne au cap', () => {
    expect(backoffDelay(20, 1000, 60_000, noJitter)).toBe(60_000);
  });

  it('applique un jitter borné à ±20 %', () => {
    const lo = backoffDelay(4, 1000, 60_000, () => 0); // jitter -20%
    const hi = backoffDelay(4, 1000, 60_000, () => 1); // jitter +20%
    expect(lo).toBe(6400);
    expect(hi).toBe(9600);
  });

  it('ne renvoie jamais de délai négatif', () => {
    expect(backoffDelay(0, 1000, 60_000, () => 0)).toBeGreaterThanOrEqual(0);
  });
});

describe('syncQueue', () => {
  beforeEach(() => clearAll());

  it('enfile et lit en FIFO, persiste dans localStorage', () => {
    enqueue(op('a'));
    enqueue(op('b'));
    expect(pendingCount()).toBe(2);
    expect(peek()?.op).toEqual(op('a'));
    expect(localStorage.getItem('miss-uwh:syncqueue')).toContain('"a"');
  });

  it('ack retire l’opération traitée', () => {
    const first = enqueue(op('a'));
    enqueue(op('b'));
    ack(first.id);
    expect(pendingCount()).toBe(1);
    expect(peek()?.op).toEqual(op('b'));
  });

  it('bumpAttempt incrémente sans retirer', () => {
    const it1 = enqueue(op('a'));
    bumpAttempt(it1.id, 'réseau');
    expect(pendingCount()).toBe(1);
    expect(queued()[0]!.attempts).toBe(1);
    expect(queued()[0]!.lastError).toBe('réseau');
  });

  it('deadLetter déplace en lettre morte', () => {
    const it1 = enqueue(op('a'));
    deadLetter(it1.id, 'RLS refus');
    expect(pendingCount()).toBe(0);
    expect(deadCount()).toBe(1);
    expect(deadItems()[0]!.lastError).toBe('RLS refus');
  });

  it('survit au rechargement (relecture depuis localStorage)', () => {
    enqueue(op('a'));
    // simulate reload: la lecture repart de localStorage
    expect(pendingCount()).toBe(1);
  });

  it('fusionne les ops mono-entité sur la même entité (dédup)', () => {
    const ev = (name: string): RemoteOp => ({
      kind: 'event.upsert',
      event: { id: 'x', seasonId: 's', name, kind: 'tournoi' },
    });
    enqueue(ev('v1'));
    enqueue(ev('v2'));
    enqueue(op('y')); // autre entité
    expect(pendingCount()).toBe(2);
    const evItem = queued().find(i => i.op.kind === 'event.upsert');
    expect((evItem!.op as { event: { name: string } }).event.name).toBe('v2');
  });

  describe('requeueDead', () => {
    it('replace les lettres mortes en tête de file, tentatives remises à zéro', () => {
      const it1 = enqueue(op('a'));
      bumpAttempt(it1.id, 'réseau');
      deadLetter(it1.id, 'refus serveur');
      enqueue(op('b')); // arrivée APRÈS l'échec

      expect(requeueDead()).toBe(1);

      expect(deadCount()).toBe(0);
      expect(pendingCount()).toBe(2);
      expect(peek()?.op).toEqual(op('a')); // ordre d'origine préservé
      expect(peek()?.attempts).toBe(0);
    });

    it('abandonne la lettre morte si une op plus récente attend sur la même entité', () => {
      const ev = (name: string): RemoteOp => ({
        kind: 'event.upsert',
        event: { id: 'x', seasonId: 's', name, kind: 'tournoi' },
      });
      const old = enqueue(ev('périmée'));
      deadLetter(old.id, 'refus');
      enqueue(ev('fraîche')); // même entité, état plus récent

      expect(requeueDead()).toBe(0);

      expect(deadCount()).toBe(0);
      expect(pendingCount()).toBe(1);
      const item = queued()[0]!;
      expect((item.op as { event: { name: string } }).event.name).toBe(
        'fraîche'
      );
    });

    it('sans lettre morte : no-op', () => {
      enqueue(op('a'));
      expect(requeueDead()).toBe(0);
      expect(pendingCount()).toBe(1);
    });
  });
});
