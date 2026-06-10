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
 * synchronisée sans connaître le vocabulaire technique.
 */
export function describeRemoteOp(op: RemoteOp): string {
  switch (op.kind) {
    case 'entry.upsert':
      return `Écriture « ${op.entry.label} »`;
    case 'entry.bulkUpsert':
      return `Import de ${op.entries.length} écriture(s)`;
    case 'season.upsert':
      return `Saison ${op.season.label}`;
    case 'season.close':
      return 'Clôture de saison';
    case 'season.reopen':
      return 'Réouverture de saison';
    case 'event.upsert':
      return `Événement financier « ${op.event.name} »`;
    case 'event.delete':
      return 'Suppression d’un événement financier';
    case 'recurring.upsert':
      return `Modèle récurrent « ${op.recurring.label} »`;
    case 'recurring.delete':
      return 'Suppression d’un modèle récurrent';
    case 'adherent.upsert':
      return `Adhérent·e ${op.adherent.firstName} ${op.adherent.lastName}`;
    case 'adherent.delete':
      return 'Suppression d’un·e adhérent·e';
    case 'guardian.upsert':
      return `Responsable légal « ${op.guardian.name} »`;
    case 'guardian.delete':
      return 'Suppression d’un responsable légal';
    case 'clubevent.upsert':
      return `Événement « ${op.clubEvent.title} »`;
    case 'clubevent.delete':
      return 'Suppression d’un événement';
    case 'announcement.upsert':
      return `Annonce « ${op.announcement.title} »`;
    case 'announcement.delete':
      return 'Suppression d’une annonce';
    case 'tournament.upsert':
      return `Tournoi « ${op.tournament.name} »`;
    case 'tournament.delete':
      return 'Suppression d’un tournoi';
    case 'session.upsert':
      return `Séance du ${op.session.date}`;
    case 'session.delete':
      return 'Suppression d’une séance';
    case 'exercise.upsert':
      return `Exercice « ${op.exercise.name} »`;
    case 'exercise.delete':
      return 'Suppression d’un exercice';
    case 'strategy.upsert':
      return `Stratégie « ${op.strategy.name} »`;
    case 'strategy.delete':
      return 'Suppression d’une stratégie';
    case 'referee.upsert':
      return `Arbitre « ${op.referee.name} »`;
    case 'referee.delete':
      return 'Suppression d’un arbitre';
    case 'album.upsert':
      return `Album photo « ${op.album.title} »`;
    case 'album.delete':
      return 'Suppression d’un album photo';
    case 'category.upsert':
      return `Catégorie « ${op.category.label} »`;
    case 'category.delete':
      return `Suppression de la catégorie ${op.code}`;
    case 'aiconfig.upsert':
      return 'Instructions IA communes du club';
  }
}
