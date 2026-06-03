import { describe, expect, it } from 'vitest';
import type { Season } from '../../shared/types/domain.ts';
import {
  validateEntry,
  hasErrors,
  type EntryDraft,
} from './entryValidation.ts';

const season: Season = {
  id: 's1',
  label: '2025-2026',
  startDate: '2025-05-15',
  endDate: '2026-05-15',
  status: 'ouverte',
  openingBalance: 0,
};

function draft(p: Partial<EntryDraft> = {}): EntryDraft {
  return {
    date: '2025-09-01',
    label: 'Inscription',
    categoryCode: 'R1',
    sens: 'credit',
    amount: 100,
    method: 'virement',
    ...p,
  };
}

describe('validateEntry', () => {
  it('accepte une écriture valide', () => {
    expect(hasErrors(validateEntry(draft(), season))).toBe(false);
  });

  it('refuse un montant négatif ou nul (règle 3)', () => {
    expect(validateEntry(draft({ amount: 0 }), season).amount).toBeDefined();
    expect(validateEntry(draft({ amount: -5 }), season).amount).toBeDefined();
  });

  it('exige la cohérence sens/catégorie', () => {
    expect(validateEntry(draft({ sens: 'debit' }), season).sens).toBeDefined();
    expect(
      validateEntry(draft({ categoryCode: 'D4', sens: 'credit' }), season).sens
    ).toBeDefined();
  });

  it('refuse une date hors saison', () => {
    expect(
      validateEntry(draft({ date: '2024-01-01' }), season).date
    ).toBeDefined();
  });

  it('bloque la saisie sur une saison clôturée', () => {
    const closed: Season = { ...season, status: 'cloturee' };
    expect(validateEntry(draft(), closed).season).toBeDefined();
  });

  it('vérifie la somme des composantes (règle 8)', () => {
    expect(
      validateEntry(
        draft({ amount: 294, components: { adulte_plein: 200 } }),
        season
      ).components
    ).toBeDefined();
    expect(
      validateEntry(
        draft({ amount: 294, components: { adulte_plein: 200, enfant: 94 } }),
        season
      ).components
    ).toBeUndefined();
  });
});
