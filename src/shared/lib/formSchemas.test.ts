import { describe, expect, it } from 'vitest';
import { clubEventFormSchema, memberFormSchema } from './formSchemas.ts';

const baseMember = {
  firstName: '',
  lastName: '',
  birthDate: '',
  category: 'adulte' as const,
  roles: [],
  licenceNumber: '',
  licenceExpiry: '',
  medicalCertExpiry: '',
  email: '',
  phone: '',
  status: 'actif' as const,
  notes: '',
};

describe('memberFormSchema', () => {
  it('refuse un membre sans aucun nom (erreur sur firstName)', () => {
    const r = memberFormSchema.safeParse(baseMember);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.firstName?.[0]).toBe(
        'Indiquez au moins un nom.'
      );
    }
  });

  it('accepte avec un seul nom et nettoie/normalise la sortie', () => {
    const r = memberFormSchema.safeParse({
      ...baseMember,
      lastName: '  Plouf  ',
      licenceNumber: '   ',
      email: '  ',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.lastName).toBe('Plouf');
      expect(r.data.firstName).toBe('');
      // Champs optionnels vides → undefined (jamais de chaîne vide persistée).
      expect(r.data.licenceNumber).toBeUndefined();
      expect(r.data.email).toBeUndefined();
    }
  });

  it('refuse un email mal formé', () => {
    const r = memberFormSchema.safeParse({
      ...baseMember,
      firstName: 'Marie',
      email: 'pasunemail',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.email?.[0]).toBe(
        'Adresse email invalide.'
      );
    }
  });

  it('accepte un email valide', () => {
    const r = memberFormSchema.safeParse({
      ...baseMember,
      firstName: 'Marie',
      email: 'marie@club.fr',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('marie@club.fr');
  });
});

describe('clubEventFormSchema', () => {
  const base = {
    date: '2025-09-10',
    title: 'AG',
    type: 'ag' as const,
    location: '',
    description: '',
  };

  it('exige un titre et une date', () => {
    const noTitle = clubEventFormSchema.safeParse({ ...base, title: '   ' });
    const noDate = clubEventFormSchema.safeParse({ ...base, date: '' });
    expect(noTitle.success).toBe(false);
    expect(noDate.success).toBe(false);
    if (!noTitle.success) {
      expect(noTitle.error.flatten().fieldErrors.title?.[0]).toBe(
        'Titre requis.'
      );
    }
  });

  it('nettoie les champs optionnels', () => {
    const r = clubEventFormSchema.safeParse({
      ...base,
      title: '  Réunion  ',
      location: '  ',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.title).toBe('Réunion');
      expect(r.data.location).toBeUndefined();
    }
  });
});
