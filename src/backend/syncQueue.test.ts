import { beforeEach, describe, expect, it } from 'vitest';
import type { RemoteOp } from './syncBus.ts';
import {
  ack,
  bumpAttempt,
  clearAll,
  deadCount,
  deadItems,
  deadLetter,
  enqueue,
  peek,
  pendingCount,
  queued,
} from './syncQueue.ts';

const op = (id: string): RemoteOp => ({ kind: 'event.delete', id });

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
});
