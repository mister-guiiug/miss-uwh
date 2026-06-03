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

export interface Season {
  id: string;
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
  audit: AuditEvent[];
  settings: Settings;
  onboarded: boolean;
}
