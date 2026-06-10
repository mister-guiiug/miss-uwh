/**
 * Types partagés du store, découpés par domaine (slices Zustand). `AppState` est
 * la composition de l'état de base et des actions de chaque slice.
 */
import type { StateCreator } from 'zustand';
import type {
  Adherent,
  AiSettings,
  Announcement,
  AppData,
  Attachment,
  Category,
  Club,
  ClubEvent,
  EventKind,
  Exercise,
  Guardian,
  JournalEntry,
  PhotoAlbum,
  RecurringTemplate,
  Referee,
  Sens,
  Settings,
  Strategy,
  TrainingSession,
  Tournament,
} from '../shared/types/domain.ts';

/**
 * Statut de synchronisation (mode Supabase). Non persisté.
 * `offline` = des modifications locales attendent le retour du réseau (état
 * normal du mode hors ligne, PAS une erreur) ; `error` = pull impossible ou
 * opérations refusées par le serveur (lettres mortes).
 */
export interface SyncStatus {
  state: 'idle' | 'syncing' | 'ready' | 'offline' | 'error';
  error?: string;
  /** Opérations locales en attente d'envoi. */
  pending?: number;
  /** Opérations refusées par le serveur (lettres mortes). */
  dead?: number;
  /** Horodatage (ms epoch) du dernier pull serveur réussi. */
  lastSyncAt?: number;
}

/** Brouillon d'écriture : champs métier saisis, le reste est dérivé au commit. */
export type EntryInput = Omit<
  JournalEntry,
  | 'id'
  | 'attachments'
  | 'createdAt'
  | 'createdBy'
  | 'updatedAt'
  | 'updatedBy'
  | 'version'
  | 'deletedAt'
  | 'deletedBy'
>;

export interface BaseState {
  data: AppData;
  /** Statut de synchronisation Supabase (mode supabase uniquement). */
  syncStatus: SyncStatus;
}

export interface SystemActions {
  setSyncStatus: (status: SyncStatus) => void;
  /** Remplace l'état depuis un pull serveur (sans trace d'audit locale). */
  hydrate: (data: AppData) => void;
  logSecurity: (action: string, summary: string) => void;
  replaceData: (data: AppData) => void;
  resetAll: (clubName?: string, seasonLabel?: string, opening?: number) => void;
  /**
   * Purge des données locales (mode Supabase, à la déconnexion) : vide le
   * miroir localStorage + la file de synchro pour qu'aucune donnée d'un membre
   * ne subsiste sur un appareil partagé (RGPD). Le serveur reste la source.
   */
  wipeLocal: () => void;
}

export interface MetaActions {
  completeOnboarding: () => void;
  setupClub: (club: Club, seasonLabel: string, opening: number) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateClub: (patch: Partial<Club>) => void;
  /** Réglages IA locaux à l'appareil (clé personnelle, skills variables). */
  updateAiSettings: (patch: Partial<AiSettings>) => void;
  /** Skills IA communs du club (synchronisés) — « partie fixe pour tous ». */
  updateAiClubConfig: (sharedSkills: string) => void;
}

export interface SeasonActions {
  setActiveSeason: (id: string) => void;
  addSeason: (label: string, opening: number) => string;
  closeSeason: (id: string) => void;
  reopenSeason: (id: string, reason: string) => void;
  setSeasonOpening: (id: string, opening: number) => void;
  carryOverReliquat: (fromId: string, toId: string) => void;
  setBudget: (seasonId: string, code: string, amount: number) => void;
}

export interface FinanceActions {
  addEvent: (name: string, kind: EventKind) => string;
  updateEvent: (id: string, patch: { name?: string; kind?: EventKind }) => void;
  deleteEvent: (id: string) => void;
  addRecurring: (t: Omit<RecurringTemplate, 'id'>) => string;
  deleteRecurring: (id: string) => void;
  generateFromRecurring: (id: string, date: string) => string | null;
  addCustomCategory: (input: {
    label: string;
    sens: Sens;
    kind?: Category['kind'];
  }) => string;
  removeCustomCategory: (code: string) => void;
}

export interface EntriesActions {
  addEntry: (input: EntryInput) => string | null;
  importEntries: (drafts: EntryInput[]) => number;
  updateEntry: (id: string, patch: Partial<EntryInput>) => void;
  setReconciled: (id: string, reconciled: boolean) => void;
  softDeleteEntry: (id: string, reason?: string) => void;
  restoreEntry: (id: string) => void;
  addAttachment: (entryId: string, attachment: Attachment) => void;
  removeAttachment: (entryId: string, attId: string) => void;
}

export interface AdherentActions {
  addAdherent: (a: Omit<Adherent, 'id'>) => string;
  updateAdherent: (id: string, patch: Partial<Omit<Adherent, 'id'>>) => void;
  deleteAdherent: (id: string) => void;
  addGuardian: (g: Omit<Guardian, 'id'>) => string;
  updateGuardian: (id: string, patch: Partial<Omit<Guardian, 'id'>>) => void;
  deleteGuardian: (id: string) => void;
}

export interface TrainingActions {
  addTrainingSession: (s: Omit<TrainingSession, 'id'>) => string;
  updateTrainingSession: (
    id: string,
    patch: Partial<Omit<TrainingSession, 'id'>>
  ) => void;
  deleteTrainingSession: (id: string) => void;
  addExercise: (e: Omit<Exercise, 'id'>) => string;
  updateExercise: (id: string, patch: Partial<Omit<Exercise, 'id'>>) => void;
  deleteExercise: (id: string) => void;
  addStrategy: (s: Omit<Strategy, 'id'>) => string;
  updateStrategy: (id: string, patch: Partial<Omit<Strategy, 'id'>>) => void;
  deleteStrategy: (id: string) => void;
  addReferee: (r: Omit<Referee, 'id'>) => string;
  updateReferee: (id: string, patch: Partial<Omit<Referee, 'id'>>) => void;
  deleteReferee: (id: string) => void;
}

export interface VieClubActions {
  addClubEvent: (e: Omit<ClubEvent, 'id'>) => string;
  updateClubEvent: (id: string, patch: Partial<Omit<ClubEvent, 'id'>>) => void;
  deleteClubEvent: (id: string) => void;
  addAnnouncement: (a: Omit<Announcement, 'id'>) => string;
  updateAnnouncement: (
    id: string,
    patch: Partial<Omit<Announcement, 'id'>>
  ) => void;
  deleteAnnouncement: (id: string) => void;
  addTournament: (t: Omit<Tournament, 'id'>) => string;
  updateTournament: (
    id: string,
    patch: Partial<Omit<Tournament, 'id'>>
  ) => void;
  deleteTournament: (id: string) => void;
  addPhotoAlbum: (a: Omit<PhotoAlbum, 'id'>) => string;
  updatePhotoAlbum: (
    id: string,
    patch: Partial<Omit<PhotoAlbum, 'id'>>
  ) => void;
  deletePhotoAlbum: (id: string) => void;
}

/** État applicatif complet = base + actions de tous les slices. */
export type AppState = BaseState &
  SystemActions &
  MetaActions &
  SeasonActions &
  FinanceActions &
  EntriesActions &
  AdherentActions &
  TrainingActions &
  VieClubActions;

/** Signature d'un slice : un `StateCreator` qui ne produit que ses actions. */
export type StoreSlice<T> = StateCreator<AppState, [], [], T>;
