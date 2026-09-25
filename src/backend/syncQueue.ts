/**
 * File d'attente de synchronisation : instance APP de la file du SOCLE
 * (`@mister-guiiug/dev-pwa-config/sync-queue`), laquelle est la PROMOTION de
 * l'ancienne implémentation locale de ce dépôt — file persistante, drain
 * sérialisé (ordre préservé), backoff exponentiel dispersé, lettres mortes
 * rejouables, fusion par entité, plafond.
 *
 * Ne restent ici que les parties PROPRES à l'app :
 *  - `entityKey` : la clé d'entité d'une opération (le `keyOf` de la fusion) ;
 *  - `isTransient` : la classification échec transitoire / rejet serveur ;
 *  - le transport et l'observateur, BRANCHÉS par `sync.ts` — même doctrine que
 *    `syncBus` : le store peut importer ce module (wipeLocal) sans jamais
 *    importer la couche réseau, et le mode local reste indépendant de
 *    Supabase ;
 *  - une migration PONCTUELLE de l'ancien format d'entrées : mêmes clés
 *    localStorage, items repris — aucune écriture en attente n'est perdue ;
 *  - les gestes PAR ÉCRITURE qu'exige la concurrence optimiste (fusion des
 *    modifications en attente, reprise de version après un succès, une
 *    lettre morte par écriture, relance sans les conflits) — cf. la section
 *    « Modifications d'écritures » plus bas.
 */
import {
  createSyncQueue,
  type SyncQueue,
  type SyncQueueEntry,
} from '@mister-guiiug/dev-pwa-config/sync-queue';
import { createStore } from '@mister-guiiug/dev-pwa-config/storage';
import type { RemoteOp } from './syncBus.ts';
import {
  EntryWriteRejected,
  entryRejectionOf,
  mergeEntryPatches,
  type EntryPatch,
  type EntryUpdateOp,
} from './entryPatch.ts';

/** Entrée de file (contrat du socle) portant une opération distante de l'app. */
export type QueueItem = SyncQueueEntry<RemoteOp>;

/** Entrée portant une modification d'écriture. */
export type EntryUpdateItem = SyncQueueEntry<EntryUpdateOp>;

/**
 * Une erreur transitoire (réseau, service indisponible, jeton à rafraîchir) est
 * réessayable ; sinon c'est un rejet serveur (ex. RLS) → lettre morte. Couvre
 * les messages des principaux navigateurs : « Failed to fetch » (Chrome),
 * « Load failed » (Safari), « NetworkError… » (Firefox).
 */
export function isTransient(message: string): boolean {
  return /fetch|network|load failed|timeout|timed?\s?out|offline|connexion|connection|econn|enotfound|socket|abort|too many requests|jwt expired|token.{0,10}expired|service unavailable|bad gateway|gateway time/i.test(
    message
  );
}

/**
 * Au-delà de ce nombre de tentatives, un échec « transitoire » est requalifié en
 * échec durable (lettre morte) : sinon une erreur mal classée bloquerait la
 * file pour toujours, silencieusement. L'opération reste récupérable depuis
 * les Réglages (« Réessayer »). N'est jamais atteint hors ligne : le drain du
 * socle s'interrompt sans consommer de tentative quand le réseau est coupé.
 */
export const MAX_TRANSIENT_ATTEMPTS = 10;

/** Clé d'entité d'une opération (pour la fusion). `null` = non fusionnable. */
export function entityKey(op: RemoteOp): string | null {
  switch (op.kind) {
    case 'entry.upsert':
      return `entry:${op.entry.id}`;
    case 'entry.update':
      // Clé DISTINCTE de la création : une modification ne doit jamais
      // remplacer, dans la file, la création encore en attente de la même
      // écriture — la RPC viserait une ligne qui n'existe pas encore.
      return `entry.update:${op.id}`;
    case 'season.upsert':
      return `season:${op.season.id}`;
    case 'event.upsert':
      return `event:${op.event.id}`;
    case 'event.delete':
      return `event:${op.id}`;
    case 'recurring.upsert':
      return `recurring:${op.recurring.id}`;
    case 'recurring.delete':
      return `recurring:${op.id}`;
    case 'adherent.upsert':
      return `adherent:${op.adherent.id}`;
    case 'adherent.delete':
      return `adherent:${op.id}`;
    case 'guardian.upsert':
      return `guardian:${op.guardian.id}`;
    case 'guardian.delete':
      return `guardian:${op.id}`;
    case 'clubevent.upsert':
      return `clubevent:${op.clubEvent.id}`;
    case 'clubevent.delete':
      return `clubevent:${op.id}`;
    case 'announcement.upsert':
      return `announcement:${op.announcement.id}`;
    case 'announcement.delete':
      return `announcement:${op.id}`;
    case 'tournament.upsert':
      return `tournament:${op.tournament.id}`;
    case 'tournament.delete':
      return `tournament:${op.id}`;
    case 'session.upsert':
      return `session:${op.session.id}`;
    case 'session.delete':
      return `session:${op.id}`;
    case 'exercise.upsert':
      return `exercise:${op.exercise.id}`;
    case 'exercise.delete':
      return `exercise:${op.id}`;
    case 'strategy.upsert':
      return `strategy:${op.strategy.id}`;
    case 'strategy.delete':
      return `strategy:${op.id}`;
    case 'referee.upsert':
      return `referee:${op.referee.id}`;
    case 'referee.delete':
      return `referee:${op.id}`;
    case 'album.upsert':
      return `album:${op.album.id}`;
    case 'album.delete':
      return `album:${op.id}`;
    case 'category.upsert':
      return `category:${op.category.code}`;
    case 'category.delete':
      return `category:${op.code}`;
    case 'aiconfig.upsert':
      return 'aiconfig'; // singleton club : seul le dernier état compte
    case 'entry.bulkUpsert':
    case 'season.close':
    case 'season.reopen':
      return null; // lot / changements d'état : ne pas fusionner
  }
}

// ── Branchements tardifs (par sync.ts) ───────────────────────────────

/** Pousse une opération vers Supabase (injecté : la file ignore le réseau). */
export type QueueTransport = (op: RemoteOp) => Promise<void>;

export interface QueueObserver {
  /** Après chaque évolution de la file (alimente le statut d'interface). */
  onChange?: (status: { pending: number; dead: number }) => void;
  /** Quand une opération part en lettre morte (toast persistant). */
  onDead?: (op: RemoteOp, error: unknown) => void;
}

let transport: QueueTransport | null = null;
let observer: QueueObserver = {};

export function setQueueTransport(t: QueueTransport | null): void {
  transport = t;
}

export function setQueueObserver(o: QueueObserver): void {
  observer = o;
}

// ── Persistance : reprise des clés historiques ───────────────────────

/**
 * Avec les clés par défaut du socle (`queue` / `dead`), ce préfixe redonne
 * EXACTEMENT les clés historiques de l'app (`miss-uwh:syncqueue` /
 * `miss-uwh:syncdead`) : la file déjà persistée chez les utilisateurs est
 * reprise, pas abandonnée.
 */
const store = createStore('miss-uwh:sync');

/**
 * Les clés du socle, NOMMÉES et passées explicitement à la file : ce module les
 * relit et les réécrit (migration ci-dessous, gestes par écriture plus bas),
 * il ne doit donc pas dépendre d'un défaut qui pourrait changer.
 */
const QUEUE_KEY = 'queue';
const DEAD_KEY = 'dead';

/** Forme des entrées écrites par l'ancien syncQueue local (avant le socle). */
interface LegacyItem {
  id: string;
  op: RemoteOp;
  attempts?: number;
  lastError?: string;
}

function isLegacyItem(value: unknown): value is LegacyItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'op' in value &&
    !('payload' in value)
  );
}

/**
 * Migration ponctuelle `{ op }` → `{ payload, key, enqueuedAt }` (contrat du
 * socle) : les écritures enfilées AVANT la montée de version — en attente comme
 * en lettre morte — repartent telles quelles au prochain drain. Idempotente
 * (une entrée déjà migrée est laissée intacte). Exportée pour les tests.
 */
export function migrateLegacyItems(
  storageKey: typeof QUEUE_KEY | typeof DEAD_KEY
): void {
  const items = store.get<unknown[]>(storageKey, []);
  if (!Array.isArray(items) || !items.some(isLegacyItem)) return;
  store.set(
    storageKey,
    items.map(item =>
      isLegacyItem(item)
        ? {
            id: item.id,
            payload: item.op,
            key: entityKey(item.op),
            attempts: item.attempts ?? 0,
            enqueuedAt: new Date().toISOString(),
            ...(item.lastError !== undefined
              ? { lastError: item.lastError }
              : {}),
          }
        : item
    )
  );
}

let queue: SyncQueue<RemoteOp> | null = null;

/**
 * La file du socle, créée au premier usage (après reprise de l'ancien format).
 * Rien ne s'exécute à l'import de ce module — doctrine anti-écran-blanc.
 */
export function getSyncQueue(): SyncQueue<RemoteOp> {
  if (!queue) {
    migrateLegacyItems(QUEUE_KEY);
    migrateLegacyItems(DEAD_KEY);
    queue = createSyncQueue<RemoteOp>({
      store,
      queueKey: QUEUE_KEY,
      deadKey: DEAD_KEY,
      process: op => {
        if (!transport)
          throw new Error('Transport de synchronisation non branché.');
        return transport(op);
      },
      keyOf: entityKey,
      // Un conflit de version ou un refus de droits ne se règle pas en
      // réessayant : il attend une DÉCISION (Réglages). Classé d'avance, quel
      // que soit le texte que le serveur a renvoyé.
      shouldRetry: error =>
        !(error instanceof EntryWriteRejected) &&
        isTransient(error instanceof Error ? error.message : String(error)),
      maxAttempts: MAX_TRANSIENT_ATTEMPTS,
      // Mêmes réglages que l'ancien backoff local : 1 s → 60 s, jitter ±20 %
      // (le socle disperse de ± jitter/2 autour de la valeur exponentielle).
      backoff: { baseDelayMs: 1000, maxDelayMs: 60_000, jitter: 0.4 },
      onDead: (entry, error) => {
        if (entry.payload.kind === 'entry.update')
          consolidateDeadEntryUpdates(entry.payload.id);
        observer.onDead?.(entry.payload, error);
      },
      onChange: status => observer.onChange?.(status),
      // Minuteurs résolus À CHAQUE appel : les fake timers des tests restent
      // effectifs même si la file a été créée sous une autre horloge.
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: id => clearTimeout(id),
    });
  }
  return queue;
}

/** Lettres mortes (Réglages → « État de la base de données »). */
export function deadItems(): QueueItem[] {
  return getSyncQueue().deadLetters();
}

/** Purge complète — file ET lettres mortes (déconnexion, appareil partagé). */
export function clearAll(): void {
  getSyncQueue().clear();
}

// ── Modifications d'écritures (concurrence optimiste) ────────────────
//
// ÉCRITURE DIRECTE DANS LE MAGASIN DE LA FILE — et pourquoi elle est sûre. Le
// socle n'offre, pour les lettres mortes, que des gestes de GROUPE
// (`requeueDead`, `clearDead`) et aucune réécriture d'une entrée en attente ;
// la concurrence optimiste en demande par écriture. Or le `Store` injecté est
// la SOURCE DE VÉRITÉ de la file, relue à chaque tour (en-tête de
// `sync-queue.js`) : réécrire ses deux clés, c'est faire ce que la file ferait
// elle-même. Limite assumée : si le stockage a refusé une écriture plus tôt
// (quota), la file travaille sur son reflet mémoire et ne verra pas celle-ci —
// l'effet est alors un conflit de plus ou une lettre morte en double, jamais
// une modification perdue ni écrasée.

/** Prédicat : l'entrée porte-t-elle une modification de CETTE écriture ? */
function updatesOf(entryId: string) {
  return (item: QueueItem): item is EntryUpdateItem =>
    item.payload.kind === 'entry.update' && item.payload.id === entryId;
}

/** L'observateur voit l'état réel après une réécriture directe. */
function notifyChange(): void {
  const q = getSyncQueue();
  observer.onChange?.({ pending: q.pending(), dead: q.deadLetters().length });
}

/**
 * Fusionne une modification qui arrive avec celle qui ATTEND déjà sur la même
 * écriture. La file du socle REMPLACE l'entrée de même clé — juste pour un
 * upsert, qui porte l'état complet, faux pour un diff : le libellé changé
 * d'abord, le montant ensuite, et le libellé partait à la trappe.
 *
 * La version attendue est la PLUS ANCIENNE des deux : une partie du patch
 * fusionné a été faite sur elle, et c'est contre elle que le serveur doit
 * juger. Prendre la plus récente ferait passer sans contrôle des champs
 * modifiés sur une version plus vieille — un écrasement silencieux.
 */
export function withPendingPatch(
  op: RemoteOp,
  pending: readonly QueueItem[]
): RemoteOp {
  if (op.kind !== 'entry.update') return op;
  const key = entityKey(op);
  const previous = pending
    .filter((item): item is EntryUpdateItem => item.key === key)
    .at(-1)?.payload;
  if (!previous) return op;
  return {
    ...op,
    patch: mergeEntryPatches(previous.patch, op.patch),
    expectedVersion: Math.min(previous.expectedVersion, op.expectedVersion),
  };
}

/** Les modifications EN ATTENTE d'une écriture, dans l'ordre de la file. */
export function pendingEntryUpdates(entryId: string): EntryUpdateItem[] {
  return getSyncQueue().list().filter(updatesOf(entryId));
}

/** La lettre morte d'une écriture (une au plus : cf. la consolidation). */
export function deadEntryUpdate(entryId: string): EntryUpdateItem | undefined {
  return getSyncQueue().deadLetters().filter(updatesOf(entryId)).at(-1);
}

/**
 * Après un succès — la RPC a fait passer l'écriture de `from` à `to` —, les
 * modifications de la même écriture qui partaient encore de `from` partent
 * désormais de `to`. Elles existent quand l'utilisateur a modifié l'écriture
 * PENDANT l'envoi : leur patch contient déjà la modification qui vient
 * d'aboutir (la fusion l'y a mise), et le serveur est exactement à `to` par
 * notre fait. Sans cette reprise, notre propre modification leur serait
 * opposée en conflit.
 *
 * Seule l'égalité à `from` est reprise : c'est la seule version dont on SAIT
 * que le serveur l'a quittée par nous. Les lettres mortes suivent la même
 * règle — relancées plus tard, elles doivent partir de la bonne version.
 */
export function rebaseEntryUpdates(
  entryId: string,
  from: number,
  to: number
): void {
  const matches = updatesOf(entryId);
  const rebase = (items: QueueItem[]): QueueItem[] | null => {
    let changed = false;
    const next = items.map(item => {
      if (!matches(item) || item.payload.expectedVersion !== from) return item;
      changed = true;
      return { ...item, payload: { ...item.payload, expectedVersion: to } };
    });
    return changed ? next : null;
  };
  const q = getSyncQueue();
  const pending = rebase(q.list());
  if (pending) store.set(QUEUE_KEY, pending);
  const dead = rebase(q.deadLetters());
  if (dead) store.set(DEAD_KEY, dead);
}

/**
 * UNE ÉCRITURE, UNE LETTRE MORTE. Quand une modification est refusée alors
 * qu'une autre, de la même écriture, attend déjà une décision, les deux
 * fusionnent : les Réglages proposent un choix par écriture, pas un choix par
 * tentative.
 *
 * Et la lettre morte perd sa clé d'entité. `requeueDead` du socle ABANDONNE
 * une lettre morte dont la clé a une entrée plus récente en attente — juste
 * pour un upsert, perte sèche pour un diff : la modification refusée ne
 * figure pas dans la suivante. Sans clé, elle est relancée à part.
 */
export function consolidateDeadEntryUpdates(entryId: string): void {
  const matches = updatesOf(entryId);
  const dead = getSyncQueue().deadLetters();
  const mine = dead.filter(matches);
  const newest = mine.at(-1);
  if (!newest || (mine.length === 1 && newest.key === null)) return;
  const merged: EntryUpdateItem = {
    ...newest,
    key: null,
    payload: {
      ...newest.payload,
      patch: mine.reduce<EntryPatch>(
        (acc, item) => mergeEntryPatches(acc, item.payload.patch),
        {}
      ),
      expectedVersion: Math.min(
        ...mine.map(item => item.payload.expectedVersion)
      ),
    },
  };
  store.set(DEAD_KEY, [...dead.filter(item => !matches(item)), merged]);
}

/**
 * Retire TOUTES les modifications d'une écriture — refusées et en attente —
 * et les rend dans l'ordre où elles ont été faites : les refusées d'abord
 * (parties plus tôt), puis celles qui attendent. C'est le point de départ des
 * deux gestes de récupération : garder la version du serveur (on les jette),
 * réappliquer ma modification (on les fusionne sur la version relue).
 */
export function takeEntryUpdates(entryId: string): EntryUpdateOp[] {
  const q = getSyncQueue();
  const matches = updatesOf(entryId);
  const dead = q.deadLetters();
  const refused = dead.filter(matches);
  const waiting = q.list().filter(matches);
  if (refused.length > 0) {
    store.set(
      DEAD_KEY,
      dead.filter(item => !matches(item))
    );
  }
  for (const item of waiting) q.remove(item.id);
  notifyChange();
  return [...refused, ...waiting].map(item => item.payload);
}

/** Une lettre morte est-elle un conflit de version (40001) ? */
function isConflict(item: QueueItem): boolean {
  return (
    item.payload.kind === 'entry.update' &&
    entryRejectionOf(item.lastError) === 'conflict'
  );
}

/**
 * « Réessayer » des Réglages et du bandeau : relance les lettres mortes, SAUF
 * les conflits de version. Renvoyer une modification avec la version
 * périmée ne peut qu'échouer à nouveau — la version d'une écriture ne
 * redescend jamais —, et la faire passer autrement écraserait la
 * modification d'un autre. Un conflit attend une décision : garder la
 * version du serveur, ou réappliquer la sienne. Rend le nombre relancé.
 */
export function requeueRetryable(): number {
  const q = getSyncQueue();
  // Une seule lecture : chaque `deadLetters()` relit le stockage et rend des
  // objets NEUFS — on filtre donc sur le prédicat, jamais sur l'identité.
  const dead = q.deadLetters();
  const conflicts = dead.filter(isConflict);
  if (conflicts.length === 0) return q.requeueDead();
  store.set(
    DEAD_KEY,
    dead.filter(item => !isConflict(item))
  );
  const revived = q.requeueDead();
  store.set(DEAD_KEY, [...q.deadLetters(), ...conflicts]);
  notifyChange();
  return revived;
}
