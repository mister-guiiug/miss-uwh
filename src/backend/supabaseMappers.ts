/**
 * Mappage domaine (camelCase, dates en epoch ms) ↔ lignes Postgres/Supabase
 * (snake_case, dates ISO / `date`). PUR et testé : c'est le cœur de l'adaptateur
 * de données V2 (le branchement lecture/écriture du store sur Supabase). Isoler
 * et tester ce mappage évite les erreurs silencieuses de schéma au runtime.
 */
import type {
  AuditCategory,
  AuditEvent,
  Club,
  EntrySens,
  EventKind,
  EventLedger,
  JournalEntry,
  PaymentMethod,
  Season,
  SeasonStatus,
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
