/**
 * Validation runtime (zod) des données relues du stockage / importées.
 * Garantit qu'un JSON externe ou corrompu ne casse pas l'application.
 * Les champs ajoutés après coup utilisent `.catch(default)` pour rester
 * rétro-compatibles (pas de réinitialisation des données héritées).
 */
import { z } from 'zod';
import {
  AUDIT_CATEGORIES,
  ENTRY_SENS,
  EVENT_KINDS,
  PAYMENT_METHODS,
  SEASON_STATUS,
} from '../types/domain.ts';

const attachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  mime: z.string(),
  size: z.number().nonnegative(),
  dataUrl: z.string().optional(),
  storagePath: z.string().optional(),
  uploadedAt: z.number(),
  uploadedBy: z.string().optional(),
});

const entrySchema = z.object({
  id: z.string(),
  seasonId: z.string(),
  categoryCode: z.string(),
  date: z.string(),
  label: z.string(),
  sens: z.enum(ENTRY_SENS),
  amount: z.number().positive(),
  method: z.enum(PAYMENT_METHODS).catch('autre'),
  pieceRef: z.string().optional(),
  invoiceCode: z.string().optional(),
  observation: z.string().optional(),
  eventId: z.string().optional(),
  components: z.record(z.string(), z.number()).optional(),
  attachments: z.array(attachmentSchema).catch([]),
  createdAt: z.number(),
  createdBy: z.string().optional(),
  updatedAt: z.number(),
  updatedBy: z.string().optional(),
  deletedAt: z.number().optional(),
  deletedBy: z.string().optional(),
  version: z.number().int().positive().catch(1),
});

const eventSchema = z.object({
  id: z.string(),
  seasonId: z.string(),
  name: z.string(),
  kind: z.enum(EVENT_KINDS).catch('autre'),
});

const seasonSchema = z.object({
  id: z.string(),
  label: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(SEASON_STATUS).catch('ouverte'),
  openingBalance: z.number(),
  closingBalance: z.number().optional(),
  lockedAt: z.number().optional(),
  lockedBy: z.string().optional(),
  reopenedAt: z.number().optional(),
  reopenReason: z.string().optional(),
});

const auditSchema = z.object({
  id: z.string(),
  ts: z.number(),
  actor: z.string(),
  action: z.string(),
  category: z.enum(AUDIT_CATEGORIES).catch('metier'),
  targetType: z.string(),
  targetId: z.string().optional(),
  summary: z.string(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
});

const clubSchema = z.object({
  name: z.string(),
  ffessmAffiliation: z.string().optional(),
  treasurer: z.string().optional(),
});

const settingsSchema = z.object({
  theme: z.enum(['light', 'dark']).catch('light'),
  decimals: z.number().int().min(0).max(3).catch(2),
  showCompensated: z.boolean().catch(true),
});

export const appDataSchema = z.object({
  version: z.number().int().positive(),
  club: clubSchema,
  seasons: z.array(seasonSchema).min(1),
  activeSeasonId: z.string(),
  entries: z.array(entrySchema).catch([]),
  events: z.array(eventSchema).catch([]),
  audit: z.array(auditSchema).catch([]),
  settings: settingsSchema,
  onboarded: z.boolean(),
});

export type AppDataInput = z.infer<typeof appDataSchema>;
