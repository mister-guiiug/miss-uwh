/**
 * Règles de validation d'une écriture — partagées entre le formulaire (front)
 * et documentées pour le backend (mêmes contrôles rejoués côté serveur, jamais
 * de confiance au client). Pures et testées.
 *
 * Règles couvertes : montant strictement positif (3), catégorie obligatoire (2),
 * sens cohérent avec la catégorie, date dans la saison, somme des composantes =
 * montant (8), saison non clôturée (verrouillage).
 */
import type {
  EntrySens,
  PaymentMethod,
  Season,
} from '../../shared/types/domain.ts';
import { categoryByCode } from '../../shared/lib/categories.ts';
import { round2 } from '../../shared/lib/engine.ts';

export interface EntryDraft {
  date: string;
  label: string;
  categoryCode: string;
  sens: EntrySens;
  amount: number;
  method: PaymentMethod;
  components?: Record<string, number>;
}

export type EntryErrors = Partial<Record<keyof EntryDraft | 'season', string>>;

export function validateEntry(
  draft: EntryDraft,
  season: Season | undefined
): EntryErrors {
  const errors: EntryErrors = {};

  if (!season) {
    errors.season = 'Aucune saison sélectionnée.';
  } else if (season.status === 'cloturee') {
    errors.season = 'Saison clôturée : déverrouillez-la pour saisir.';
  }

  if (!draft.label.trim()) errors.label = 'Le libellé est obligatoire.';

  const cat = categoryByCode(draft.categoryCode);
  if (!cat) {
    errors.categoryCode = 'Catégorie inconnue.';
  } else if (
    (cat.sens === 'recette' && draft.sens !== 'credit') ||
    (cat.sens === 'depense' && draft.sens !== 'debit')
  ) {
    errors.sens =
      cat.sens === 'recette'
        ? 'Une recette doit être au crédit.'
        : 'Une dépense doit être au débit.';
  }

  if (!Number.isFinite(draft.amount) || draft.amount <= 0) {
    errors.amount = 'Le montant doit être strictement positif.';
  }

  if (season && draft.date) {
    if (draft.date < season.startDate || draft.date > season.endDate) {
      errors.date = `Date hors saison (${season.startDate} → ${season.endDate}).`;
    }
  }

  if (draft.components) {
    const values = Object.values(draft.components);
    const sum = round2(values.reduce((s, v) => s + (Number(v) || 0), 0));
    if (sum > 0 && Math.abs(sum - round2(draft.amount)) > 0.01) {
      errors.components = `La somme des composantes (${sum.toFixed(2)} €) doit égaler le montant (${draft.amount.toFixed(2)} €).`;
    }
  }

  return errors;
}

export function hasErrors(errors: EntryErrors): boolean {
  return Object.keys(errors).length > 0;
}
