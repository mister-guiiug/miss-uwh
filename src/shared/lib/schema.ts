/**
 * Validation runtime (zod) des données relues du stockage / importées.
 * Garantit qu'un JSON externe ou corrompu ne casse pas l'application.
 * Les champs ajoutés après coup utilisent `.catch(default)` pour rester
 * rétro-compatibles (pas de réinitialisation des données héritées).
 */
import { z } from 'zod';
import {
  ADHERENT_CATEGORIES,
  AUDIT_CATEGORIES,
  CATEGORY_KINDS,
  CLUB_EVENT_TYPES,
  ENTRY_SENS,
  EVENT_KINDS,
  EXERCISE_CATEGORIES,
  GUARDIAN_RELATIONS,
  MEMBER_ROLES,
  MEMBER_STATUSES,
  PAYMENT_METHODS,
  SEASON_STATUS,
  SENS,
  STRATEGY_PHASES,
  TOURNAMENT_STATUSES,
} from '../types/domain.ts';

const categorySchema = z.object({
  code: z.string(),
  label: z.string(),
  sens: z.enum(SENS),
  kind: z.enum(CATEGORY_KINDS).catch('exploitation'),
  group: z.string().optional(),
  components: z.array(z.string()).optional(),
  eventCapable: z.boolean().optional(),
});

const adherentSchema = z.object({
  id: z.string(),
  seasonId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  birthDate: z.string().optional(),
  category: z.enum(ADHERENT_CATEGORIES).catch('adulte'),
  roles: z.array(z.enum(MEMBER_ROLES)).catch([]),
  licenceNumber: z.string().optional(),
  licenceExpiry: z.string().optional(),
  medicalCertExpiry: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(MEMBER_STATUSES).catch('actif'),
  amount: z.number().nonnegative().catch(0),
  paid: z.boolean().catch(false),
  helloassoId: z.string().optional(),
  notes: z.string().optional(),
});

const guardianSchema = z.object({
  id: z.string(),
  memberId: z.string(),
  relation: z.enum(GUARDIAN_RELATIONS).catch('tuteur'),
  name: z.string(),
  phone: z.string().optional(),
  email: z.string().optional(),
});

const clubEventSchema = z.object({
  id: z.string(),
  seasonId: z.string(),
  date: z.string(),
  title: z.string(),
  type: z.enum(CLUB_EVENT_TYPES).catch('autre'),
  location: z.string().optional(),
  description: z.string().optional(),
});

const announcementSchema = z.object({
  id: z.string(),
  seasonId: z.string(),
  date: z.string(),
  title: z.string(),
  body: z.string(),
  pinned: z.boolean().catch(false),
});

const tournamentSchema = z.object({
  id: z.string(),
  seasonId: z.string(),
  name: z.string(),
  date: z.string(),
  location: z.string().optional(),
  status: z.enum(TOURNAMENT_STATUSES).catch('prevu'),
  eventId: z.string().optional(),
  notes: z.string().optional(),
});

const sessionPlanItemSchema = z.object({
  exerciseId: z.string(),
  durationMin: z.number().optional(),
  notes: z.string().optional(),
});

const trainingSessionSchema = z.object({
  id: z.string(),
  seasonId: z.string(),
  date: z.string(),
  location: z.string().optional(),
  group: z.string().optional(),
  coachId: z.string().optional(),
  focus: z.string().optional(),
  plan: z.array(sessionPlanItemSchema).catch([]),
  attendance: z.array(z.string()).catch([]),
});

const exerciseSchema = z.object({
  id: z.string(),
  seasonId: z.string(),
  name: z.string(),
  category: z.enum(EXERCISE_CATEGORIES).catch('technique'),
  description: z.string().optional(),
  durationMin: z.number().optional(),
  level: z.string().optional(),
});

const strategySchema = z.object({
  id: z.string(),
  seasonId: z.string(),
  name: z.string(),
  phase: z.enum(STRATEGY_PHASES).catch('attaque'),
  description: z.string().optional(),
  diagramUrl: z.string().optional(),
});

const refereeSchema = z.object({
  id: z.string(),
  seasonId: z.string(),
  name: z.string(),
  level: z.string().optional(),
  certifications: z.string().optional(),
  active: z.boolean().catch(true),
});

const photoAlbumSchema = z.object({
  id: z.string(),
  seasonId: z.string(),
  title: z.string(),
  url: z.string(),
  date: z.string().optional(),
  coverUrl: z.string().optional(),
});

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
  reconciled: z.boolean().optional(),
  reconciledAt: z.number().optional(),
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
  clubId: z.string().optional(),
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
  summary: z
    .object({ totalRecettes: z.number(), totalDepenses: z.number() })
    .optional(),
  budget: z.record(z.string(), z.number()).optional(),
});

const recurringSchema = z.object({
  id: z.string(),
  label: z.string(),
  categoryCode: z.string(),
  amount: z.number().positive(),
  method: z.enum(PAYMENT_METHODS).catch('autre'),
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

const helloAssoSchema = z
  .object({
    orgSlug: z.string().optional(),
    formSlug: z.string().optional(),
    formType: z.string().optional(),
  })
  .optional()
  .catch(undefined);

const googleCalendarSchema = z
  .object({
    icsUrl: z.string().optional(),
  })
  .optional()
  .catch(undefined);

const settingsSchema = z.object({
  theme: z.enum(['light', 'dark']).catch('light'),
  decimals: z.number().int().min(0).max(3).catch(2),
  showCompensated: z.boolean().catch(true),
  helloAsso: helloAssoSchema,
  googleCalendar: googleCalendarSchema,
});

export const appDataSchema = z.object({
  version: z.number().int().positive(),
  club: clubSchema,
  seasons: z.array(seasonSchema).min(1),
  activeSeasonId: z.string(),
  entries: z.array(entrySchema).catch([]),
  events: z.array(eventSchema).catch([]),
  recurrings: z.array(recurringSchema).catch([]),
  customCategories: z.array(categorySchema).catch([]),
  adherents: z.array(adherentSchema).catch([]),
  guardians: z.array(guardianSchema).catch([]),
  clubEvents: z.array(clubEventSchema).catch([]),
  announcements: z.array(announcementSchema).catch([]),
  tournaments: z.array(tournamentSchema).catch([]),
  trainingSessions: z.array(trainingSessionSchema).catch([]),
  exercises: z.array(exerciseSchema).catch([]),
  strategies: z.array(strategySchema).catch([]),
  referees: z.array(refereeSchema).catch([]),
  photoAlbums: z.array(photoAlbumSchema).catch([]),
  audit: z.array(auditSchema).catch([]),
  settings: settingsSchema,
  onboarded: z.boolean(),
});

export type AppDataInput = z.infer<typeof appDataSchema>;
