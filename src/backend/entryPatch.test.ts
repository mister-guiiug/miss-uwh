/**
 * Le DIFF d'une modification d'écriture : ce qui part vers
 * `update_entry_checked`, et rien d'autre. Deux erreurs coûteraient cher ici,
 * sans qu'aucun type ne les voie :
 *  - un champ changé qui manque au diff part... nulle part : la modification
 *    est perdue, en silence ;
 *  - un champ INCHANGÉ qui entre au diff écraserait, après un conflit, la
 *    valeur qu'un autre trésorier vient d'y mettre.
 */
import { describe, expect, it } from 'vitest';
import type { JournalEntry } from '../shared/types/domain.ts';
import {
  EntryWriteRejected,
  applyEntryPatch,
  entryPatchBetween,
  entryRejectionFromCode,
  entryRejectionOf,
  entryUpdateOp,
  isEmptyPatch,
  mergeEntryPatches,
} from './entryPatch.ts';

const entry = (over: Partial<JournalEntry> = {}): JournalEntry => ({
  id: 'e1',
  seasonId: 's1',
  categoryCode: 'R1',
  date: '2025-09-10',
  label: 'Cotisations',
  sens: 'credit',
  amount: 640,
  method: 'cheque',
  attachments: [],
  createdAt: 1,
  updatedAt: 1,
  version: 3,
  ...over,
});

describe('entryPatchBetween', () => {
  it('rien de changé : un diff vide', () => {
    expect(entryPatchBetween(entry(), entry())).toEqual({});
  });

  it('ne porte que les champs changés', () => {
    expect(
      entryPatchBetween(
        entry(),
        entry({ label: 'Cotisations sept.', amount: 660 })
      )
    ).toEqual({ label: 'Cotisations sept.', amount: 660 });
  });

  it('porte la catégorie AVEC le sens : le serveur refuse l’un sans l’autre', () => {
    expect(
      entryPatchBetween(
        entry(),
        entry({ categoryCode: 'D12', sens: 'debit', method: 'virement' })
      )
    ).toEqual({ categoryCode: 'D12', sens: 'debit', method: 'virement' });
  });

  it('un champ facultatif vidé part à null — c’est ce qui le vide côté serveur', () => {
    const before = entry({
      pieceRef: 'chq 1',
      invoiceCode: 'FA1',
      observation: 'Remis',
      eventId: 'ev1',
      components: { adulte_plein: 640 },
    });
    expect(entryPatchBetween(before, entry())).toEqual({
      pieceRef: null,
      invoiceCode: null,
      observation: null,
      eventId: null,
      components: null,
    });
  });

  it('un champ facultatif rempli part avec sa valeur', () => {
    expect(
      entryPatchBetween(entry(), entry({ pieceRef: 'vir 42', eventId: 'ev2' }))
    ).toEqual({ pieceRef: 'vir 42', eventId: 'ev2' });
  });

  it('pointage : « non renseigné » vaut « non pointé », comme la colonne NOT NULL', () => {
    expect(entryPatchBetween(entry(), entry({ reconciled: false }))).toEqual(
      {}
    );
    expect(
      entryPatchBetween(
        entry({ reconciled: false }),
        entry({ reconciled: true })
      )
    ).toEqual({ reconciled: true });
  });

  it('composantes : comparées par valeur, et vides = absentes', () => {
    const before = entry({ components: { adulte_plein: 600, licence: 40 } });
    expect(
      entryPatchBetween(
        before,
        entry({ components: { licence: 40, adulte_plein: 600 } })
      )
    ).toEqual({});
    expect(entryPatchBetween(entry(), entry({ components: {} }))).toEqual({});
    expect(
      entryPatchBetween(before, entry({ components: { adulte_plein: 640 } }))
    ).toEqual({ components: { adulte_plein: 640 } });
    expect(
      entryPatchBetween(
        before,
        entry({ components: { adulte_plein: 600, licence: 41 } })
      )
    ).toEqual({ components: { adulte_plein: 600, licence: 41 } });
  });

  it('suppression logique et restauration', () => {
    expect(
      entryPatchBetween(entry(), entry({ deletedAt: 1_700_000_000_000 }))
    ).toEqual({ deletedAt: 1_700_000_000_000 });
    expect(
      entryPatchBetween(entry({ deletedAt: 1_700_000_000_000 }), entry())
    ).toEqual({ deletedAt: null });
  });

  it('ignore ce que le serveur ne tient pas, ou tient lui-même', () => {
    // Pointage horodaté, pièces jointes (autre table), saison (jamais
    // déplacée), traces d'édition et version (tenues par le serveur).
    expect(
      entryPatchBetween(
        entry(),
        entry({
          reconciledAt: 5,
          attachments: [
            {
              id: 'a',
              name: 'x.pdf',
              mime: 'application/pdf',
              size: 1,
              uploadedAt: 1,
            },
          ],
          seasonId: 's2',
          updatedAt: 9,
          updatedBy: 'bob',
          deletedBy: 'bob',
          version: 9,
        })
      )
    ).toEqual({});
  });
});

describe('mergeEntryPatches', () => {
  it('la plus récente l’emporte champ par champ, les autres champs restent', () => {
    expect(
      mergeEntryPatches(
        { label: 'A', amount: 10, observation: 'x' },
        { amount: 12, observation: null }
      )
    ).toEqual({ label: 'A', amount: 12, observation: null });
  });

  it('l’ordre compte', () => {
    expect(mergeEntryPatches({ label: 'B' }, { label: 'A' })).toEqual({
      label: 'A',
    });
  });
});

describe('applyEntryPatch', () => {
  it('pose les champs du patch, et ceux-là seulement', () => {
    const server = entry({ label: 'Serveur', amount: 700, observation: 'obs' });
    const next = applyEntryPatch(server, { amount: 660, method: 'virement' });
    expect(next).toEqual({ ...server, amount: 660, method: 'virement' });
    expect(server.amount).toBe(700); // pas de mutation
  });

  it('`null` retire le champ facultatif', () => {
    const next = applyEntryPatch(
      entry({
        pieceRef: 'p',
        invoiceCode: 'i',
        observation: 'o',
        eventId: 'ev',
        components: { a: 1 },
        deletedAt: 5,
      }),
      {
        pieceRef: null,
        invoiceCode: null,
        observation: null,
        eventId: null,
        components: null,
        deletedAt: null,
      }
    );
    expect(next.pieceRef).toBeUndefined();
    expect(next.invoiceCode).toBeUndefined();
    expect(next.observation).toBeUndefined();
    expect(next.eventId).toBeUndefined();
    expect(next.components).toBeUndefined();
    expect(next.deletedAt).toBeUndefined();
  });

  it('pose chaque champ que le serveur sait écrire', () => {
    const next = applyEntryPatch(entry(), {
      label: 'L',
      amount: 1,
      categoryCode: 'D8',
      date: '2025-10-01',
      sens: 'debit',
      method: 'especes',
      reconciled: true,
      pieceRef: 'p',
      invoiceCode: 'i',
      observation: 'o',
      eventId: 'ev',
      components: { b: 1 },
      deletedAt: 7,
    });
    expect(next).toMatchObject({
      label: 'L',
      amount: 1,
      categoryCode: 'D8',
      date: '2025-10-01',
      sens: 'debit',
      method: 'especes',
      reconciled: true,
      pieceRef: 'p',
      invoiceCode: 'i',
      observation: 'o',
      eventId: 'ev',
      components: { b: 1 },
      deletedAt: 7,
    });
  });

  it('aller-retour : le diff reposé sur l’état de départ redonne l’état d’arrivée', () => {
    const before = entry({ observation: 'o', pieceRef: 'p' });
    const after = entry({
      label: 'Nouveau',
      observation: undefined,
      eventId: 'ev1',
      components: { adulte_plein: 640 },
    });
    expect(applyEntryPatch(before, entryPatchBetween(before, after))).toEqual(
      after
    );
  });
});

describe('entryUpdateOp', () => {
  it('rien de connu du serveur n’a changé : aucune opération', () => {
    expect(entryUpdateOp(entry(), entry({ reconciledAt: 3 }))).toBeNull();
    expect(isEmptyPatch({})).toBe(true);
  });

  it('part avec la version VUE avant la modification, et le libellé d’après', () => {
    expect(
      entryUpdateOp(entry({ version: 4 }), entry({ version: 4, label: 'Neuf' }))
    ).toEqual({
      kind: 'entry.update',
      id: 'e1',
      label: 'Neuf',
      expectedVersion: 4,
      patch: { label: 'Neuf' },
    });
  });
});

describe('refus : EntryWriteRejected, et sa relecture après rechargement', () => {
  it('le SQLSTATE entre en tête du message, seule trace persistée', () => {
    const conflict = new EntryWriteRejected('conflict', 'Conflit de version');
    expect(conflict.message).toBe('[40001] Conflit de version');
    expect(conflict.reason).toBe('conflict');
    expect(conflict.name).toBe('EntryWriteRejected');
    expect(conflict).toBeInstanceOf(Error);
    expect(new EntryWriteRejected('forbidden', 'Refusé').message).toBe(
      '[42501] Refusé'
    );
  });

  it('se relit depuis le lastError d’une lettre morte', () => {
    expect(entryRejectionOf('[40001] Conflit de version')).toBe('conflict');
    expect(entryRejectionOf('[42501] Droits insuffisants')).toBe('forbidden');
    expect(entryRejectionOf('permission denied (RLS)')).toBeNull();
    expect(entryRejectionOf('[23514] check_violation')).toBeNull();
    expect(entryRejectionOf(undefined)).toBeNull();
  });

  it('se lit depuis le code d’erreur PostgREST', () => {
    expect(entryRejectionFromCode('40001')).toBe('conflict');
    expect(entryRejectionFromCode('42501')).toBe('forbidden');
    expect(entryRejectionFromCode('23505')).toBeNull();
    expect(entryRejectionFromCode(undefined)).toBeNull();
  });
});
