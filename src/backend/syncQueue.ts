/**
 * File d'attente de synchronisation : instance APP de la file du SOCLE
 * (`@mister-guiiug/dev-wpa-config/sync-queue`), laquelle est la PROMOTION de
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
 *    localStorage, items repris — aucune écriture en attente n'est perdue.
 */
import {
  createSyncQueue,
  type SyncQueue,
  type SyncQueueEntry,
} from '@mister-guiiug/dev-wpa-config/sync-queue';
import { createStore } from '@mister-guiiug/dev-wpa-config/storage';
import type { RemoteOp } from './syncBus.ts';

/** Entrée de file (contrat du socle) portant une opération distante de l'app. */
export type QueueItem = SyncQueueEntry<RemoteOp>;

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
export function migrateLegacyItems(storageKey: 'queue' | 'dead'): void {
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
    migrateLegacyItems('queue');
    migrateLegacyItems('dead');
    queue = createSyncQueue<RemoteOp>({
      store,
      process: op => {
        if (!transport)
          throw new Error('Transport de synchronisation non branché.');
        return transport(op);
      },
      keyOf: entityKey,
      shouldRetry: error =>
        isTransient(error instanceof Error ? error.message : String(error)),
      maxAttempts: MAX_TRANSIENT_ATTEMPTS,
      // Mêmes réglages que l'ancien backoff local : 1 s → 60 s, jitter ±20 %
      // (le socle disperse de ± jitter/2 autour de la valeur exponentielle).
      backoff: { baseDelayMs: 1000, maxDelayMs: 60_000, jitter: 0.4 },
      onDead: (entry, error) => observer.onDead?.(entry.payload, error),
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
