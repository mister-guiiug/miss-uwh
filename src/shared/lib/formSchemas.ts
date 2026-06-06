/**
 * Schémas Zod au **bord des formulaires** (stricts, messages FR), distincts des
 * schémas de persistance (`schema.ts`, lenients via `.catch`). Ils valident la
 * saisie ET nettoient la sortie (trim, vide → `undefined`) pour produire
 * directement le sous-ensemble éditable de l'entité.
 */
import { z } from 'zod';
import {
  ADHERENT_CATEGORIES,
  CLUB_EVENT_TYPES,
  MEMBER_ROLES,
  MEMBER_STATUSES,
} from '../types/domain.ts';

/** Email « assez bon » : un @, un point dans le domaine, pas d'espace. */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// ── Membre / adhérent ────────────────────────────────────────────────
export const memberFormSchema = z
  .object({
    firstName: z.string(),
    lastName: z.string(),
    birthDate: z.string(),
    category: z.enum(ADHERENT_CATEGORIES),
    roles: z.array(z.enum(MEMBER_ROLES)),
    licenceNumber: z.string(),
    licenceExpiry: z.string(),
    medicalCertExpiry: z.string(),
    email: z.string(),
    phone: z.string(),
    status: z.enum(MEMBER_STATUSES),
    notes: z.string(),
  })
  .superRefine((v, ctx) => {
    if (!v.firstName.trim() && !v.lastName.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['firstName'],
        message: 'Indiquez au moins un nom.',
      });
    }
    if (v.email.trim() && !EMAIL_RE.test(v.email.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: 'Adresse email invalide.',
      });
    }
  })
  .transform(v => ({
    firstName: v.firstName.trim(),
    lastName: v.lastName.trim(),
    birthDate: v.birthDate || undefined,
    category: v.category,
    roles: v.roles,
    licenceNumber: v.licenceNumber.trim() || undefined,
    licenceExpiry: v.licenceExpiry || undefined,
    medicalCertExpiry: v.medicalCertExpiry || undefined,
    email: v.email.trim() || undefined,
    phone: v.phone.trim() || undefined,
    status: v.status,
    notes: v.notes.trim() || undefined,
  }));

export type MemberFormValues = z.input<typeof memberFormSchema>;
export type MemberFormParsed = z.output<typeof memberFormSchema>;

// ── Événement de la vie du club ──────────────────────────────────────
export const clubEventFormSchema = z
  .object({
    date: z.string(),
    title: z.string(),
    type: z.enum(CLUB_EVENT_TYPES),
    location: z.string(),
    description: z.string(),
  })
  .superRefine((v, ctx) => {
    if (!v.title.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['title'],
        message: 'Titre requis.',
      });
    }
    if (!v.date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['date'],
        message: 'Date requise.',
      });
    }
  })
  .transform(v => ({
    date: v.date,
    title: v.title.trim(),
    type: v.type,
    location: v.location.trim() || undefined,
    description: v.description.trim() || undefined,
  }));

export type ClubEventFormValues = z.input<typeof clubEventFormSchema>;
export type ClubEventFormParsed = z.output<typeof clubEventFormSchema>;
