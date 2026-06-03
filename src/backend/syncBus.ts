/**
 * Bus de synchronisation découplé. Le store émet des « intentions » de
 * synchronisation après chaque commit local ; en mode Supabase, `sync.ts`
 * enregistre un handler qui les pousse vers le serveur. En mode local, aucun
 * handler n'est branché → `emitRemote` est un no-op (zéro surcoût).
 *
 * Ce découplage évite que le store importe la couche réseau (pas de cycle, et
 * le mode local reste totalement indépendant de Supabase).
 */
import type {
  EventLedger,
  JournalEntry,
  Season,
} from '../shared/types/domain.ts';

export type RemoteOp =
  | { kind: 'entry.upsert'; entry: JournalEntry }
  | { kind: 'entry.bulkUpsert'; entries: JournalEntry[] }
  | { kind: 'season.upsert'; season: Season }
  | { kind: 'season.close'; id: string }
  | { kind: 'season.reopen'; id: string; reason: string }
  | { kind: 'event.upsert'; event: EventLedger }
  | { kind: 'event.delete'; id: string };

type Handler = (op: RemoteOp) => void;

let handler: Handler | null = null;

export function setRemoteHandler(h: Handler | null): void {
  handler = h;
}

export function emitRemote(op: RemoteOp): void {
  handler?.(op);
}
