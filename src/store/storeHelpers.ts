/**
 * Briques transverses du store : un seul point de persistance (`persist`), un
 * seul point d'audit (`audit`), et le pont vers le bus de synchro (`remote`).
 * `commitAudited`/`commitPlain` factorisent le motif répété
 * « persist(audit(...)) » / « persist(...) » de chaque mutation.
 */
import type {
  AppData,
  AuditCategory,
  AuditEvent,
  Season,
} from '../shared/types/domain.ts';
import { createId } from '../shared/lib/id.ts';
import { setCustomCategories } from '../shared/lib/categories.ts';
import { saveData } from '../shared/lib/storage.ts';
import { IS_SUPABASE } from '../backend/config.ts';
import { emitRemote, type RemoteOp } from '../backend/syncBus.ts';

/** Acteur courant (mode local). En mode Supabase, l'email de session le remplace. */
let currentActor = 'local';
export function setCurrentActor(actor: string): void {
  currentActor = actor;
}
export function getCurrentActor(): string {
  return currentActor;
}

/** Émet une intention de synchronisation (no-op en mode local). */
export function remote(op: RemoteOp): void {
  if (IS_SUPABASE) emitRemote(op);
}

/** Persiste l'état local et garde le registre de catégories synchronisé. */
export function persist(data: AppData): AppData {
  saveData(data);
  setCustomCategories(data.customCategories);
  return data;
}

export interface AuditArgs {
  action: string;
  category: AuditCategory;
  /** Type de cible (`entry`, `season`, `adherent`…). */
  target: string;
  summary: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
}

/** Ajoute un événement d'audit (borne souple : 1000 derniers conservés). */
export function audit(data: AppData, args: AuditArgs): AppData {
  const event: AuditEvent = {
    id: createId('aud'),
    ts: Date.now(),
    actor: currentActor,
    action: args.action,
    category: args.category,
    targetType: args.target,
    targetId: args.targetId,
    summary: args.summary,
    before: args.before,
    after: args.after,
  };
  return { ...data, audit: [...data.audit, event].slice(-1000) };
}

/** Journalise un audit puis persiste. */
export function commitAudited(data: AppData, args: AuditArgs): AppData {
  return persist(audit(data, args));
}

/** Persiste sans trace d'audit (mutations sans portée métier/sécurité). */
export function commitPlain(data: AppData): AppData {
  return persist(data);
}

export function seasonOf(data: AppData, seasonId: string): Season | undefined {
  return data.seasons.find(s => s.id === seasonId);
}

/** Une saison clôturée verrouille toute écriture qui lui est rattachée. */
export function isLocked(data: AppData, seasonId: string): boolean {
  return seasonOf(data, seasonId)?.status === 'cloturee';
}
