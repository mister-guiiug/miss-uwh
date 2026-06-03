/**
 * File d'attente de synchronisation PERSISTANTE (localStorage). Garantit qu'une
 * mutation faite hors ligne (ou pendant une panne réseau) n'est pas perdue :
 * elle est rejouée vers Supabase à la reconnexion. Les opérations en échec
 * PERMANENT (rejet serveur — ex. RLS) partent en « lettre morte » (dead-letter)
 * pour inspection, sans bloquer la file.
 *
 * Logique pure (juste adossée à localStorage) → entièrement testable.
 */
import type { RemoteOp } from './syncBus.ts';

export interface QueueItem {
  id: string;
  op: RemoteOp;
  attempts: number;
  lastError?: string;
}

const KEY = 'miss-uwh:syncqueue';
const DEAD = 'miss-uwh:syncdead';

function read(key: string): QueueItem[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as QueueItem[]) : [];
  } catch {
    return [];
  }
}

function write(key: string, items: QueueItem[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* quota / indisponible : on ne casse pas l'app */
  }
}

let counter = 0;

/** Clé d'entité d'une opération (pour la déduplication). `null` = non déduplicable. */
export function entityKey(op: RemoteOp): string | null {
  switch (op.kind) {
    case 'entry.upsert':
      return `entry:${op.entry.id}`;
    case 'season.upsert':
      return `season:${op.season.id}`;
    case 'event.upsert':
      return `event:${op.event.id}`;
    case 'event.delete':
      return `event:${op.id}`;
    case 'entry.bulkUpsert':
    case 'season.close':
    case 'season.reopen':
      return null; // lot / changements d'état : ne pas fusionner
  }
}

/**
 * Enfile une opération. Les ops mono-entité en attente sur la MÊME entité sont
 * fusionnées : seule la dernière (état le plus récent) est conservée → moins
 * d'appels serveur au drain, sans changer le résultat final (upsert idempotent).
 */
export function enqueue(op: RemoteOp): QueueItem {
  const key = entityKey(op);
  let items = read(KEY);
  if (key) items = items.filter(i => entityKey(i.op) !== key);
  counter += 1;
  const item: QueueItem = { id: `q_${Date.now()}_${counter}`, op, attempts: 0 };
  items.push(item);
  write(KEY, items);
  return item;
}

export function peek(): QueueItem | undefined {
  return read(KEY)[0];
}

export function queued(): QueueItem[] {
  return read(KEY);
}

export function pendingCount(): number {
  return read(KEY).length;
}

/** Retire l'opération (succès). */
export function ack(id: string): void {
  write(
    KEY,
    read(KEY).filter(i => i.id !== id)
  );
}

/** Incrémente le compteur de tentatives (échec transitoire — on garde). */
export function bumpAttempt(id: string, error: string): void {
  write(
    KEY,
    read(KEY).map(i =>
      i.id === id ? { ...i, attempts: i.attempts + 1, lastError: error } : i
    )
  );
}

/** Déplace en lettre morte (échec permanent). */
export function deadLetter(id: string, error: string): void {
  const items = read(KEY);
  const item = items.find(i => i.id === id);
  if (!item) return;
  const dead = read(DEAD);
  dead.push({ ...item, lastError: error });
  write(DEAD, dead);
  write(
    KEY,
    items.filter(i => i.id !== id)
  );
}

export function deadItems(): QueueItem[] {
  return read(DEAD);
}

export function deadCount(): number {
  return read(DEAD).length;
}

export function clearDead(): void {
  write(DEAD, []);
}

export function clearAll(): void {
  write(KEY, []);
  write(DEAD, []);
}
