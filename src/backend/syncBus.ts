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
  AiClubConfig,
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
import type { Translate } from '../i18n/index.ts';
import type { EntryPatch } from './entryPatch.ts';

export type RemoteOp =
  /** CRÉATION d'une écriture (upsert idempotent sur l'UUID client). */
  | { kind: 'entry.upsert'; entry: JournalEntry }
  | { kind: 'entry.bulkUpsert'; entries: JournalEntry[] }
  /**
   * MODIFICATION d'une écriture existante : un diff, et la version que le
   * client a vue — la RPC `update_entry_checked` refuse (40001) si le serveur
   * a bougé depuis. `label` ne sert qu'à nommer l'écriture à l'utilisateur.
   */
  | {
      kind: 'entry.update';
      id: string;
      label: string;
      expectedVersion: number;
      patch: EntryPatch;
    }
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
  | { kind: 'category.delete'; code: string }
  | { kind: 'aiconfig.upsert'; config: AiClubConfig };

type Handler = (op: RemoteOp) => void;

let handler: Handler | null = null;

export function setRemoteHandler(h: Handler | null): void {
  handler = h;
}

export function emitRemote(op: RemoteOp): void {
  handler?.(op);
}

/**
 * Libellé lisible d'une opération (file d'attente / lettres mortes des
 * Réglages) : l'utilisateur doit comprendre QUELLE donnée n'a pas pu être
 * synchronisée sans connaître le vocabulaire technique. Le traducteur est
 * PASSÉ plutôt qu'importé : ce module reste sans état ni dépendance à l'i18n,
 * et le même libellé sert au toast (hors React) comme à la carte des Réglages.
 */
export function describeRemoteOp(op: RemoteOp, t: Translate): string {
  switch (op.kind) {
    case 'entry.upsert':
      return t('sync.op.entry', { label: op.entry.label });
    case 'entry.update':
      return t('sync.op.entryUpdate', { label: op.label });
    case 'entry.bulkUpsert':
      return t('sync.op.entryImport', { n: op.entries.length });
    case 'season.upsert':
      return t('sync.op.season', { label: op.season.label });
    case 'season.close':
      return t('sync.op.seasonClose');
    case 'season.reopen':
      return t('sync.op.seasonReopen');
    case 'event.upsert':
      return t('sync.op.event', { name: op.event.name });
    case 'event.delete':
      return t('sync.op.eventDelete');
    case 'recurring.upsert':
      return t('sync.op.recurring', { label: op.recurring.label });
    case 'recurring.delete':
      return t('sync.op.recurringDelete');
    case 'adherent.upsert':
      return t('sync.op.adherent', {
        name: `${op.adherent.firstName} ${op.adherent.lastName}`,
      });
    case 'adherent.delete':
      return t('sync.op.adherentDelete');
    case 'guardian.upsert':
      return t('sync.op.guardian', { name: op.guardian.name });
    case 'guardian.delete':
      return t('sync.op.guardianDelete');
    case 'clubevent.upsert':
      return t('sync.op.clubEvent', { title: op.clubEvent.title });
    case 'clubevent.delete':
      return t('sync.op.clubEventDelete');
    case 'announcement.upsert':
      return t('sync.op.announcement', { title: op.announcement.title });
    case 'announcement.delete':
      return t('sync.op.announcementDelete');
    case 'tournament.upsert':
      return t('sync.op.tournament', { name: op.tournament.name });
    case 'tournament.delete':
      return t('sync.op.tournamentDelete');
    case 'session.upsert':
      return t('sync.op.session', { date: op.session.date });
    case 'session.delete':
      return t('sync.op.sessionDelete');
    case 'exercise.upsert':
      return t('sync.op.exercise', { name: op.exercise.name });
    case 'exercise.delete':
      return t('sync.op.exerciseDelete');
    case 'strategy.upsert':
      return t('sync.op.strategy', { name: op.strategy.name });
    case 'strategy.delete':
      return t('sync.op.strategyDelete');
    case 'referee.upsert':
      return t('sync.op.referee', { name: op.referee.name });
    case 'referee.delete':
      return t('sync.op.refereeDelete');
    case 'album.upsert':
      return t('sync.op.album', { title: op.album.title });
    case 'album.delete':
      return t('sync.op.albumDelete');
    case 'category.upsert':
      return t('sync.op.category', { label: op.category.label });
    case 'category.delete':
      return t('sync.op.categoryDelete', { code: op.code });
    case 'aiconfig.upsert':
      return t('sync.op.aiConfig');
  }
}
