/**
 * Mappage domaine (camelCase, dates en epoch ms) ↔ lignes Postgres/Supabase
 * (snake_case, dates ISO / `date`). PUR et testé : c'est le cœur de l'adaptateur
 * de données V2 (le branchement lecture/écriture du store sur Supabase). Isoler
 * et tester ce mappage évite les erreurs silencieuses de schéma au runtime.
 */
import type {
  Adherent,
  AdherentCategory,
  Announcement,
  Attachment,
  AuditCategory,
  AuditEvent,
  Category,
  CategoryKind,
  Club,
  ClubEvent,
  ClubEventType,
  EntrySens,
  EventKind,
  EventLedger,
  Exercise,
  ExerciseCategory,
  Guardian,
  GuardianRelation,
  JournalEntry,
  MemberRole,
  MemberStatus,
  PaymentMethod,
  PhotoAlbum,
  RecurringTemplate,
  Referee,
  Season,
  SeasonStatus,
  Sens,
  Strategy,
  StrategyPhase,
  TrainingSession,
  Tournament,
  TournamentStatus,
} from '../shared/types/domain.ts';

// ── Formes des lignes Postgres (cf. supabase/migrations/0001_schema.sql) ──
export interface EntryRow {
  id: string;
  season_id: string;
  category_code: string;
  date: string;
  label: string;
  sens: EntrySens;
  amount: number | string;
  method: string;
  piece_ref: string | null;
  invoice_code: string | null;
  observation: string | null;
  reconciled: boolean | null;
  event_id: string | null;
  components: Record<string, number> | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  version: number;
}

export interface SeasonRow {
  id: string;
  club_id: string;
  label: string;
  start_date: string;
  end_date: string;
  status: SeasonStatus;
  opening_balance: number | string;
  closing_balance: number | string | null;
  locked_at: string | null;
  reopened_at: string | null;
  reopen_reason: string | null;
}

export interface EventRow {
  id: string;
  season_id: string;
  name: string;
  kind: EventKind;
}

const num = (v: number | string): number =>
  typeof v === 'number' ? v : Number(v);
const isoToEpoch = (s: string | null): number | undefined =>
  s ? Date.parse(s) : undefined;
const epochToIso = (n: number | undefined): string | null =>
  n == null ? null : new Date(n).toISOString();
const orUndef = <T>(v: T | null): T | undefined => (v == null ? undefined : v);

// ── Écritures ────────────────────────────────────────────────────────
export function rowToEntry(row: EntryRow): JournalEntry {
  return {
    id: row.id,
    seasonId: row.season_id,
    categoryCode: row.category_code,
    date: row.date,
    label: row.label,
    sens: row.sens,
    amount: num(row.amount),
    method: row.method as PaymentMethod,
    pieceRef: orUndef(row.piece_ref),
    invoiceCode: orUndef(row.invoice_code),
    observation: orUndef(row.observation),
    reconciled: row.reconciled ?? undefined,
    eventId: orUndef(row.event_id),
    components: orUndef(row.components),
    attachments: [], // chargées séparément (table attachments)
    createdAt: isoToEpoch(row.created_at) ?? 0,
    createdBy: orUndef(row.created_by),
    updatedAt: isoToEpoch(row.updated_at) ?? 0,
    updatedBy: orUndef(row.updated_by),
    deletedAt: isoToEpoch(row.deleted_at),
    deletedBy: orUndef(row.deleted_by),
    version: row.version,
  };
}

/** Sous-ensemble insérable/modifiable (les colonnes générées sont gérées par la BDD). */
export function entryToRow(
  e: Omit<JournalEntry, 'attachments'> & { attachments?: unknown }
): Partial<EntryRow> {
  return {
    season_id: e.seasonId,
    category_code: e.categoryCode,
    date: e.date,
    label: e.label,
    sens: e.sens,
    amount: e.amount,
    method: e.method,
    piece_ref: e.pieceRef ?? null,
    invoice_code: e.invoiceCode ?? null,
    observation: e.observation ?? null,
    reconciled: e.reconciled ?? false,
    event_id: e.eventId ?? null,
    components: e.components ?? null,
    deleted_at: epochToIso(e.deletedAt),
  };
}

// ── Saisons ──────────────────────────────────────────────────────────
export function rowToSeason(row: SeasonRow): Season {
  return {
    id: row.id,
    clubId: row.club_id,
    label: row.label,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    openingBalance: num(row.opening_balance),
    closingBalance:
      row.closing_balance == null ? undefined : num(row.closing_balance),
    lockedAt: isoToEpoch(row.locked_at),
    reopenedAt: isoToEpoch(row.reopened_at),
    reopenReason: orUndef(row.reopen_reason),
  };
}

export function seasonToRow(s: Season): Partial<SeasonRow> {
  return {
    label: s.label,
    start_date: s.startDate,
    end_date: s.endDate,
    status: s.status,
    opening_balance: s.openingBalance,
    closing_balance: s.closingBalance ?? null,
    locked_at: epochToIso(s.lockedAt),
    reopened_at: epochToIso(s.reopenedAt),
    reopen_reason: s.reopenReason ?? null,
  };
}

/** Ligne complète insérable (UPSERT) : inclut l'id pour `on conflict (id)`. */
export function entryToUpsertRow(e: JournalEntry): Partial<EntryRow> {
  return { id: e.id, ...entryToRow(e) };
}

export function seasonToUpsertRow(s: Season): Partial<SeasonRow> {
  return {
    id: s.id,
    club_id: s.clubId,
    ...seasonToRow(s),
  } as Partial<SeasonRow>;
}

// ── Événements ───────────────────────────────────────────────────────
export function rowToEvent(row: EventRow): EventLedger {
  return {
    id: row.id,
    seasonId: row.season_id,
    name: row.name,
    kind: row.kind,
  };
}

export function eventToRow(e: EventLedger): EventRow {
  return { id: e.id, season_id: e.seasonId, name: e.name, kind: e.kind };
}

// ── Récurrences (modèles d'écriture) ─────────────────────────────────
export interface RecurringRow {
  id: string;
  club_id: string;
  label: string;
  category_code: string;
  amount: number | string;
  method: string;
}

export function rowToRecurring(row: RecurringRow): RecurringTemplate {
  return {
    id: row.id,
    label: row.label,
    categoryCode: row.category_code,
    amount: num(row.amount),
    method: row.method as PaymentMethod,
  };
}

/** Ligne UPSERT : le club courant est injecté par le repository. */
export function recurringToUpsertRow(
  t: RecurringTemplate,
  clubId: string
): RecurringRow {
  return {
    id: t.id,
    club_id: clubId,
    label: t.label,
    category_code: t.categoryCode,
    amount: t.amount,
    method: t.method,
  };
}

// ── Adhérents (registre des inscriptions) ────────────────────────────
export interface AdherentRow {
  id: string;
  season_id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  category: AdherentCategory;
  member_roles: MemberRole[] | null;
  licence_number: string | null;
  email: string | null;
  phone: string | null;
  status: MemberStatus | string | null;
  amount: number | string;
  paid: boolean;
  notes: string | null;
}

export function rowToAdherent(row: AdherentRow): Adherent {
  return {
    id: row.id,
    seasonId: row.season_id,
    firstName: row.first_name,
    lastName: row.last_name,
    birthDate: orUndef(row.birth_date),
    category: row.category,
    roles: row.member_roles ?? [],
    licenceNumber: orUndef(row.licence_number),
    email: orUndef(row.email),
    phone: orUndef(row.phone),
    status: (row.status as MemberStatus) ?? 'actif',
    amount: num(row.amount),
    paid: row.paid,
    notes: orUndef(row.notes),
  };
}

export function adherentToUpsertRow(a: Adherent): AdherentRow {
  return {
    id: a.id,
    season_id: a.seasonId,
    first_name: a.firstName,
    last_name: a.lastName,
    birth_date: a.birthDate ?? null,
    category: a.category,
    member_roles: a.roles ?? [],
    licence_number: a.licenceNumber ?? null,
    email: a.email ?? null,
    phone: a.phone ?? null,
    status: a.status ?? 'actif',
    amount: a.amount,
    paid: a.paid,
    notes: a.notes ?? null,
  };
}

// ── Tuteurs / contacts (familles) ────────────────────────────────────
export interface GuardianRow {
  id: string;
  member_id: string;
  relation: GuardianRelation;
  name: string;
  phone: string | null;
  email: string | null;
}

export function rowToGuardian(row: GuardianRow): Guardian {
  return {
    id: row.id,
    memberId: row.member_id,
    relation: row.relation,
    name: row.name,
    phone: orUndef(row.phone),
    email: orUndef(row.email),
  };
}

export function guardianToUpsertRow(g: Guardian): GuardianRow {
  return {
    id: g.id,
    member_id: g.memberId,
    relation: g.relation,
    name: g.name,
    phone: g.phone ?? null,
    email: g.email ?? null,
  };
}

// ── Vie du club : agenda ─────────────────────────────────────────────
export interface ClubEventRow {
  id: string;
  season_id: string;
  date: string;
  title: string;
  type: ClubEventType;
  location: string | null;
  description: string | null;
}

export function rowToClubEvent(row: ClubEventRow): ClubEvent {
  return {
    id: row.id,
    seasonId: row.season_id,
    date: row.date,
    title: row.title,
    type: row.type,
    location: orUndef(row.location),
    description: orUndef(row.description),
  };
}

export function clubEventToUpsertRow(e: ClubEvent): ClubEventRow {
  return {
    id: e.id,
    season_id: e.seasonId,
    date: e.date,
    title: e.title,
    type: e.type,
    location: e.location ?? null,
    description: e.description ?? null,
  };
}

// ── Vie du club : annonces ───────────────────────────────────────────
export interface AnnouncementRow {
  id: string;
  season_id: string;
  date: string;
  title: string;
  body: string;
  pinned: boolean | null;
}

export function rowToAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    seasonId: row.season_id,
    date: row.date,
    title: row.title,
    body: row.body,
    pinned: row.pinned ?? false,
  };
}

export function announcementToUpsertRow(a: Announcement): AnnouncementRow {
  return {
    id: a.id,
    season_id: a.seasonId,
    date: a.date,
    title: a.title,
    body: a.body,
    pinned: a.pinned ?? false,
  };
}

// ── Tournois ─────────────────────────────────────────────────────────
export interface TournamentRow {
  id: string;
  season_id: string;
  name: string;
  date: string;
  location: string | null;
  status: TournamentStatus;
  event_id: string | null;
  notes: string | null;
}

export function rowToTournament(row: TournamentRow): Tournament {
  return {
    id: row.id,
    seasonId: row.season_id,
    name: row.name,
    date: row.date,
    location: orUndef(row.location),
    status: row.status,
    eventId: orUndef(row.event_id),
    notes: orUndef(row.notes),
  };
}

export function tournamentToUpsertRow(t: Tournament): TournamentRow {
  return {
    id: t.id,
    season_id: t.seasonId,
    name: t.name,
    date: t.date,
    location: t.location ?? null,
    status: t.status,
    event_id: t.eventId ?? null,
    notes: t.notes ?? null,
  };
}

// ── Séances d'entraînement ───────────────────────────────────────────
export interface TrainingSessionRow {
  id: string;
  season_id: string;
  date: string;
  location: string | null;
  team_group: string | null;
  coach_id: string | null;
  focus: string | null;
  attendance: string[] | null;
}

export function rowToTrainingSession(row: TrainingSessionRow): TrainingSession {
  return {
    id: row.id,
    seasonId: row.season_id,
    date: row.date,
    location: orUndef(row.location),
    group: orUndef(row.team_group),
    coachId: orUndef(row.coach_id),
    focus: orUndef(row.focus),
    attendance: row.attendance ?? [],
  };
}

export function trainingSessionToUpsertRow(
  s: TrainingSession
): TrainingSessionRow {
  return {
    id: s.id,
    season_id: s.seasonId,
    date: s.date,
    location: s.location ?? null,
    team_group: s.group ?? null,
    coach_id: s.coachId ?? null,
    focus: s.focus ?? null,
    attendance: s.attendance ?? [],
  };
}

// ── Exercices ────────────────────────────────────────────────────────
export interface ExerciseRow {
  id: string;
  season_id: string;
  name: string;
  category: ExerciseCategory;
  description: string | null;
  duration_min: number | string | null;
  level: string | null;
}

export function rowToExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    seasonId: row.season_id,
    name: row.name,
    category: row.category,
    description: orUndef(row.description),
    durationMin: row.duration_min == null ? undefined : num(row.duration_min),
    level: orUndef(row.level),
  };
}

export function exerciseToUpsertRow(e: Exercise): ExerciseRow {
  return {
    id: e.id,
    season_id: e.seasonId,
    name: e.name,
    category: e.category,
    description: e.description ?? null,
    duration_min: e.durationMin ?? null,
    level: e.level ?? null,
  };
}

// ── Stratégies ───────────────────────────────────────────────────────
export interface StrategyRow {
  id: string;
  season_id: string;
  name: string;
  phase: StrategyPhase;
  description: string | null;
  diagram_url: string | null;
}

export function rowToStrategy(row: StrategyRow): Strategy {
  return {
    id: row.id,
    seasonId: row.season_id,
    name: row.name,
    phase: row.phase,
    description: orUndef(row.description),
    diagramUrl: orUndef(row.diagram_url),
  };
}

export function strategyToUpsertRow(s: Strategy): StrategyRow {
  return {
    id: s.id,
    season_id: s.seasonId,
    name: s.name,
    phase: s.phase,
    description: s.description ?? null,
    diagram_url: s.diagramUrl ?? null,
  };
}

// ── Arbitres ─────────────────────────────────────────────────────────
export interface RefereeRow {
  id: string;
  season_id: string;
  name: string;
  level: string | null;
  certifications: string | null;
  active: boolean;
}

export function rowToReferee(row: RefereeRow): Referee {
  return {
    id: row.id,
    seasonId: row.season_id,
    name: row.name,
    level: orUndef(row.level),
    certifications: orUndef(row.certifications),
    active: row.active,
  };
}

export function refereeToUpsertRow(r: Referee): RefereeRow {
  return {
    id: r.id,
    season_id: r.seasonId,
    name: r.name,
    level: r.level ?? null,
    certifications: r.certifications ?? null,
    active: r.active,
  };
}

// ── Albums photos (Google Photos) ────────────────────────────────────
export interface PhotoAlbumRow {
  id: string;
  season_id: string;
  title: string;
  url: string;
  date: string | null;
  cover_url: string | null;
}

export function rowToPhotoAlbum(row: PhotoAlbumRow): PhotoAlbum {
  return {
    id: row.id,
    seasonId: row.season_id,
    title: row.title,
    url: row.url,
    date: orUndef(row.date),
    coverUrl: orUndef(row.cover_url),
  };
}

export function photoAlbumToUpsertRow(a: PhotoAlbum): PhotoAlbumRow {
  return {
    id: a.id,
    season_id: a.seasonId,
    title: a.title,
    url: a.url,
    date: a.date ?? null,
    cover_url: a.coverUrl ?? null,
  };
}

// ── Catégories personnalisées (table `categories`, colonne `custom`) ──
export interface CategoryRow {
  code: string;
  label: string;
  sens: Sens;
  kind: CategoryKind;
  components: string[] | null;
  custom: boolean;
}

export function rowToCategory(row: CategoryRow): Category {
  return {
    code: row.code,
    label: row.label,
    sens: row.sens,
    kind: row.kind,
    components: orUndef(row.components),
  };
}

export function customCategoryToUpsertRow(c: Category): CategoryRow {
  return {
    code: c.code,
    label: c.label,
    sens: c.sens,
    kind: c.kind,
    components: c.components ?? null,
    custom: true,
  };
}

// ── Club ─────────────────────────────────────────────────────────────
export interface ClubRow {
  id: string;
  name: string;
  affiliation: string | null;
}

export function rowToClub(row: ClubRow): Club & { id: string } {
  return {
    id: row.id,
    name: row.name,
    ffessmAffiliation: orUndef(row.affiliation),
  };
}

// ── Audit (tables audit_metier / audit_securite) ─────────────────────
export interface AuditRow {
  id: number | string;
  ts: string;
  actor: string | null;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  summary: string;
  before?: unknown;
  after?: unknown;
}

// ── Pièces justificatives ────────────────────────────────────────────
export interface AttachmentRow {
  id: string;
  entry_id: string;
  name: string;
  mime: string | null;
  size: number | null;
  storage_path: string;
  uploaded_at: string;
  uploaded_by: string | null;
}

export function rowToAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    name: row.name,
    mime: row.mime ?? '',
    size: row.size ?? 0,
    storagePath: row.storage_path,
    uploadedAt: isoToEpoch(row.uploaded_at) ?? 0,
    uploadedBy: orUndef(row.uploaded_by),
  };
}

/** Nom de fichier assaini (évite les caractères problématiques dans le chemin). */
export function safeFileName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80);
  return cleaned || 'fichier';
}

/** Chemin de stockage d'une pièce : `<entryId>/<attId>-<nom>`. */
export function attachmentPath(
  entryId: string,
  attId: string,
  fileName: string
): string {
  return `${entryId}/${attId}-${safeFileName(fileName)}`;
}

export function rowToAudit(row: AuditRow, category: AuditCategory): AuditEvent {
  return {
    id: String(row.id),
    ts: isoToEpoch(row.ts) ?? 0,
    actor: row.actor_email ?? row.actor ?? 'serveur',
    action: row.action,
    category,
    targetType: row.target_type,
    targetId: orUndef(row.target_id),
    summary: row.summary,
    before: row.before,
    after: row.after,
  };
}
