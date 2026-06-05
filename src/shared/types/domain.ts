/**
 * Modèle de domaine — bilan comptable saisonnier d'un club de Hockey Subaquatique.
 *
 * Règles structurantes (cf. README §Règles de gestion) :
 *  - une écriture appartient à UNE saison et UNE catégorie ;
 *  - elle a un sens comptable (crédit/débit) et un montant strictement positif ;
 *  - le solde courant se recalcule après chaque écriture ;
 *  - les écritures compensées / de régularisation / les transferts internes sont
 *    distingués des recettes et dépenses d'exploitation ;
 *  - modification historisée (version + audit), suppression logique (deletedAt).
 */

/** Sens « métier » d'une catégorie : entre (recette) ou sort (dépense). */
export const SENS = ['recette', 'depense'] as const;
export type Sens = (typeof SENS)[number];

/** Sens comptable d'une écriture. crédit = entrée d'argent, débit = sortie. */
export const ENTRY_SENS = ['credit', 'debit'] as const;
export type EntrySens = (typeof ENTRY_SENS)[number];

/**
 * Nature d'une catégorie / écriture (règles 10–11) :
 *  - exploitation   : recette/dépense réelle de la saison ;
 *  - compensee      : écriture non monétaire compensée (ex. gratuité de piscine
 *                     valorisée en recette ET en dépense pour le même montant) ;
 *  - regularisation : correction / régularisation comptable ;
 *  - transfert      : transfert interne (livret ↔ compte courant, etc.).
 */
export const CATEGORY_KINDS = [
  'exploitation',
  'compensee',
  'regularisation',
  'transfert',
] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

/** Modes de règlement observés dans le relevé (et extensibles). */
export const PAYMENT_METHODS = [
  'especes',
  'cheque',
  'virement',
  'prelevement',
  'carte',
  'helloasso',
  'stripe',
  'sumup',
  'monetico',
  'autre',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  especes: 'Espèces',
  cheque: 'Chèque',
  virement: 'Virement',
  prelevement: 'Prélèvement',
  carte: 'Carte bancaire',
  helloasso: 'HelloAsso',
  stripe: 'Stripe',
  sumup: 'SumUp',
  monetico: 'Monetico',
  autre: 'Autre',
};

export const SEASON_STATUS = ['ouverte', 'cloturee'] as const;
export type SeasonStatus = (typeof SEASON_STATUS)[number];

/** Composantes tarifaires d'une écriture (inscriptions, assurances, licences). */
export type ComponentBreakdown = Record<string, number>;

export interface Category {
  /** Code stable : R1..R9, D1..D13, R-INT, R-COMP, R-REG, D-COMP, D-REG. */
  code: string;
  label: string;
  sens: Sens;
  kind: CategoryKind;
  /** Regroupement d'affichage (ex. « Tournoi des Arvernes »). */
  group?: string;
  /** Clés des composantes tarifaires saisissables, le cas échéant. */
  components?: string[];
  /** Catégorie liable à un événement (TDA, CDF, stage, buvette). */
  eventCapable?: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  /** Mode local : contenu inline (data URL). */
  dataUrl?: string;
  /** Mode Supabase : chemin dans le bucket privé `justificatifs`. */
  storagePath?: string;
  uploadedAt: number;
  uploadedBy?: string;
}

export interface JournalEntry {
  id: string;
  seasonId: string;
  categoryCode: string;
  /** Date de l'opération (ISO `yyyy-mm-dd`). */
  date: string;
  label: string;
  sens: EntrySens;
  /** Montant strictement positif (règle 3). */
  amount: number;
  method: PaymentMethod;
  /** N° de pièce comptable. */
  pieceRef?: string;
  /** Code facture / référence externe. */
  invoiceCode?: string;
  observation?: string;
  /** Pointage : écriture rapprochée avec le relevé bancaire. */
  reconciled?: boolean;
  reconciledAt?: number;
  /** Rattachement à un événement pour le calcul du résultat net (règle 10). */
  eventId?: string;
  /** Détail par composante tarifaire (règle 8). Somme = `amount`. */
  components?: ComponentBreakdown;
  attachments: Attachment[];
  createdAt: number;
  createdBy?: string;
  updatedAt: number;
  updatedBy?: string;
  /** Suppression logique tracée (règle 14). */
  deletedAt?: number;
  deletedBy?: string;
  /** Incrémenté à chaque modification (historisation, règle 13). */
  version: number;
}

export const EVENT_KINDS = ['tournoi', 'buvette', 'stage', 'autre'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export interface EventLedger {
  id: string;
  seasonId: string;
  name: string;
  kind: EventKind;
}

/** Modèle d'écriture récurrente (génération rapide : frais bancaires, soutiens…). */
export interface RecurringTemplate {
  id: string;
  label: string;
  categoryCode: string;
  amount: number;
  method: PaymentMethod;
}

export interface Season {
  id: string;
  /** Club propriétaire (mode Supabase uniquement ; ignoré en local). */
  clubId?: string;
  /** Libellé saison sportive, ex. « 2025-2026 ». */
  label: string;
  startDate: string;
  endDate: string;
  status: SeasonStatus;
  /** Reliquat de l'exercice précédent (solde d'ouverture, règle 7). */
  openingBalance: number;
  /** Solde de clôture figé au verrouillage. */
  closingBalance?: number;
  lockedAt?: number;
  lockedBy?: string;
  reopenedAt?: number;
  reopenReason?: string;
  /**
   * Totaux historiques (saisons antérieures sans journal détaillé importé) —
   * alimentent la synthèse d'évolution multi-saisons. Reliquat inclus dans
   * `totalRecettes` (présentation « bilan »).
   */
  summary?: { totalRecettes: number; totalDepenses: number };
  /** Budget prévisionnel par catégorie (code → montant prévu, orienté sens). */
  budget?: Record<string, number>;
}

export const ADHERENT_CATEGORIES = [
  'adulte',
  'adulte_reduit',
  'jeune',
  'enfant',
] as const;
export type AdherentCategory = (typeof ADHERENT_CATEGORIES)[number];

/** Rôles d'un adhérent AU SEIN du club (donnée, distincte des rôles d'accès RBAC). */
export const MEMBER_ROLES = [
  'joueur',
  'encadrant',
  'arbitre',
  'dirigeant',
] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  joueur: 'Joueur',
  encadrant: 'Encadrant',
  arbitre: 'Arbitre',
  dirigeant: 'Dirigeant',
};

export const MEMBER_STATUSES = ['actif', 'inactif'] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

/**
 * Adhérent / membre du club (registre des personnes — règle 8). Porte à la fois
 * la personne (identité, rôles dans le club, contact) ET sa cotisation
 * (montant/réglé) ; l'espace Adhérents gère les deux facettes.
 */
export interface Adherent {
  id: string;
  seasonId: string;
  firstName: string;
  lastName: string;
  /** Date de naissance (ISO `yyyy-mm-dd`) — pour distinguer mineurs/majeurs. */
  birthDate?: string;
  category: AdherentCategory;
  /** Rôles dans le club (joueur, encadrant, arbitre, dirigeant). */
  roles?: MemberRole[];
  licenceNumber?: string;
  email?: string;
  phone?: string;
  /** Adhérent actif sur la saison ou archivé. */
  status?: MemberStatus;
  /** Cotisation due/réglée. */
  amount: number;
  paid: boolean;
  notes?: string;
}

/** Lien familial / contact d'un adhérent (parents, tuteur, urgence — mineurs). */
export const GUARDIAN_RELATIONS = [
  'pere',
  'mere',
  'tuteur',
  'urgence',
] as const;
export type GuardianRelation = (typeof GUARDIAN_RELATIONS)[number];

export const GUARDIAN_RELATION_LABELS: Record<GuardianRelation, string> = {
  pere: 'Père',
  mere: 'Mère',
  tuteur: 'Tuteur',
  urgence: "Contact d'urgence",
};

export interface Guardian {
  id: string;
  /** Adhérent rattaché (`Adherent.id`). */
  memberId: string;
  relation: GuardianRelation;
  name: string;
  phone?: string;
  email?: string;
}

// ── Vie du club ──────────────────────────────────────────────────────
/** Événement de la vie du club (agenda) — distinct de l'`EventLedger` comptable. */
export const CLUB_EVENT_TYPES = [
  'reunion',
  'sortie',
  'ag',
  'soiree',
  'competition',
  'autre',
] as const;
export type ClubEventType = (typeof CLUB_EVENT_TYPES)[number];

export const CLUB_EVENT_TYPE_LABELS: Record<ClubEventType, string> = {
  reunion: 'Réunion',
  sortie: 'Sortie',
  ag: 'Assemblée générale',
  soiree: 'Soirée',
  competition: 'Compétition',
  autre: 'Autre',
};

export interface ClubEvent {
  id: string;
  seasonId: string;
  /** Date de l'événement (ISO `yyyy-mm-dd`). */
  date: string;
  title: string;
  type: ClubEventType;
  location?: string;
  description?: string;
}

/** Annonce / actualité / convocation diffusée au club. */
export interface Announcement {
  id: string;
  seasonId: string;
  /** Date de publication (ISO `yyyy-mm-dd`). */
  date: string;
  title: string;
  body: string;
  /** Épinglée en tête de liste. */
  pinned?: boolean;
}

/** Album photo (lien Google Photos partagé). */
export interface PhotoAlbum {
  id: string;
  seasonId: string;
  title: string;
  /** Lien de l'album partagé (Google Photos). */
  url: string;
  date?: string;
  /** Image de couverture (URL, optionnel). */
  coverUrl?: string;
}

// ── Tournois (Lot B) ─────────────────────────────────────────────────
export const TOURNAMENT_STATUSES = ['prevu', 'en_cours', 'termine'] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export const TOURNAMENT_STATUS_LABELS: Record<TournamentStatus, string> = {
  prevu: 'Prévu',
  en_cours: 'En cours',
  termine: 'Terminé',
};

export interface Tournament {
  id: string;
  seasonId: string;
  name: string;
  /** Date (ou date de début) ISO `yyyy-mm-dd`. */
  date: string;
  location?: string;
  status: TournamentStatus;
  /** Lien optionnel vers l'événement comptable (résultat financier). */
  eventId?: string;
  notes?: string;
}

// ── Entraînements / Stratégie (Lot C) ────────────────────────────────
/** Séance d'entraînement (planning + présences). */
export interface TrainingSession {
  id: string;
  seasonId: string;
  date: string;
  location?: string;
  /** Groupe concerné (ex. « Compét », « Loisir », « Jeunes »). */
  group?: string;
  /** Encadrant responsable (`Adherent.id`). */
  coachId?: string;
  /** Thème / objectif de la séance. */
  focus?: string;
  /** Présents : identifiants d'adhérents. */
  attendance: string[];
}

/** Exercice de la bibliothèque (drills). */
export const EXERCISE_CATEGORIES = [
  'echauffement',
  'technique',
  'physique',
  'jeu',
  'gardien',
] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  echauffement: 'Échauffement',
  technique: 'Technique',
  physique: 'Physique',
  jeu: 'Jeu',
  gardien: 'Gardien',
};

export interface Exercise {
  id: string;
  seasonId: string;
  name: string;
  category: ExerciseCategory;
  description?: string;
  /** Durée indicative (minutes). */
  durationMin?: number;
  /** Niveau / public (texte libre). */
  level?: string;
}

/** Système de jeu / composition (stratégie). */
export const STRATEGY_PHASES = [
  'attaque',
  'defense',
  'transition',
  'specifique',
] as const;
export type StrategyPhase = (typeof STRATEGY_PHASES)[number];

export const STRATEGY_PHASE_LABELS: Record<StrategyPhase, string> = {
  attaque: 'Attaque',
  defense: 'Défense',
  transition: 'Transition',
  specifique: 'Situation spéciale',
};

export interface Strategy {
  id: string;
  seasonId: string;
  name: string;
  phase: StrategyPhase;
  description?: string;
  /** Lien vers un schéma tactique (image). */
  diagramUrl?: string;
}

/** Arbitre du club (registre arbitrage). */
export interface Referee {
  id: string;
  seasonId: string;
  name: string;
  /** Niveau (Départemental / Régional / National / International…). */
  level?: string;
  certifications?: string;
  active: boolean;
}

export const AUDIT_CATEGORIES = ['metier', 'securite'] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

/** Entrée de journalisation (audit). Logs métier vs sécurité séparés (specs). */
export interface AuditEvent {
  id: string;
  ts: number;
  actor: string;
  action: string;
  category: AuditCategory;
  targetType: string;
  targetId?: string;
  summary: string;
  before?: unknown;
  after?: unknown;
}

export interface Club {
  name: string;
  ffessmAffiliation?: string;
  treasurer?: string;
}

export interface Settings {
  theme: 'light' | 'dark';
  /** Nombre de décimales d'affichage (2 par défaut). */
  decimals: number;
  /** Inclure les écritures compensées dans les totaux affichés. */
  showCompensated: boolean;
}

export interface AppData {
  version: number;
  club: Club;
  seasons: Season[];
  activeSeasonId: string;
  entries: JournalEntry[];
  events: EventLedger[];
  recurrings: RecurringTemplate[];
  /** Catégories personnalisées (en plus de la taxonomie R1–D13). */
  customCategories: Category[];
  /** Registre des adhérents (toutes saisons). */
  adherents: Adherent[];
  /** Liens familiaux / contacts des adhérents (parents, tuteurs, urgence). */
  guardians: Guardian[];
  /** Agenda de la vie du club. */
  clubEvents: ClubEvent[];
  /** Annonces / actualités du club. */
  announcements: Announcement[];
  /** Tournois (organisation / suivi). */
  tournaments: Tournament[];
  /** Séances d'entraînement (planning + présences). */
  trainingSessions: TrainingSession[];
  /** Bibliothèque d'exercices. */
  exercises: Exercise[];
  /** Systèmes de jeu / stratégies. */
  strategies: Strategy[];
  /** Arbitres du club. */
  referees: Referee[];
  /** Albums photos (liens Google Photos). */
  photoAlbums: PhotoAlbum[];
  audit: AuditEvent[];
  settings: Settings;
  onboarded: boolean;
}
