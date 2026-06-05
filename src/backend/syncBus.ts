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
  Adherent,
  Announcement,
  Category,
  ClubEvent,
  EventLedger,
  Exercise,
  Guardian,
  JournalEntry,
  PhotoAlbum,
  RecurringTemplate,
  Referee,
  Season,
  Strategy,
  TrainingSession,
  Tournament,
} from '../shared/types/domain.ts';

export type RemoteOp =
  | { kind: 'entry.upsert'; entry: JournalEntry }
  | { kind: 'entry.bulkUpsert'; entries: JournalEntry[] }
  | { kind: 'season.upsert'; season: Season }
  | { kind: 'season.close'; id: string }
  | { kind: 'season.reopen'; id: string; reason: string }
  | { kind: 'event.upsert'; event: EventLedger }
  | { kind: 'event.delete'; id: string }
  | { kind: 'recurring.upsert'; recurring: RecurringTemplate }
  | { kind: 'recurring.delete'; id: string }
  | { kind: 'adherent.upsert'; adherent: Adherent }
  | { kind: 'adherent.delete'; id: string }
  | { kind: 'guardian.upsert'; guardian: Guardian }
  | { kind: 'guardian.delete'; id: string }
  | { kind: 'clubevent.upsert'; clubEvent: ClubEvent }
  | { kind: 'clubevent.delete'; id: string }
  | { kind: 'announcement.upsert'; announcement: Announcement }
  | { kind: 'announcement.delete'; id: string }
  | { kind: 'tournament.upsert'; tournament: Tournament }
  | { kind: 'tournament.delete'; id: string }
  | { kind: 'session.upsert'; session: TrainingSession }
  | { kind: 'session.delete'; id: string }
  | { kind: 'exercise.upsert'; exercise: Exercise }
  | { kind: 'exercise.delete'; id: string }
  | { kind: 'strategy.upsert'; strategy: Strategy }
  | { kind: 'strategy.delete'; id: string }
  | { kind: 'referee.upsert'; referee: Referee }
  | { kind: 'referee.delete'; id: string }
  | { kind: 'album.upsert'; album: PhotoAlbum }
  | { kind: 'album.delete'; id: string }
  | { kind: 'category.upsert'; category: Category }
  | { kind: 'category.delete'; code: string };

type Handler = (op: RemoteOp) => void;

let handler: Handler | null = null;

export function setRemoteHandler(h: Handler | null): void {
  handler = h;
}

export function emitRemote(op: RemoteOp): void {
  handler?.(op);
}
