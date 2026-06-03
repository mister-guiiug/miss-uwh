import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './useAppStore.ts';
import type { EntryInput } from './useAppStore.ts';

const get = () => useAppStore.getState();
const data = () => get().data;
const activeId = () => data().activeSeasonId;

function draft(p: Partial<EntryInput> = {}): EntryInput {
  return {
    seasonId: activeId(),
    categoryCode: 'R1',
    date: '2025-09-10',
    label: 'Test',
    sens: 'credit',
    amount: 100,
    method: 'virement',
    ...p,
  };
}

describe('useAppStore', () => {
  beforeEach(() => {
    get().resetAll('Club test', '2025-2026', 1000);
  });

  it('addEntry crée une écriture (UUID) + journalise l’audit', () => {
    const id = get().addEntry(draft());
    expect(id).toBeTruthy();
    expect(/^[0-9a-f]{8}-/.test(id!)).toBe(true);
    const entries = data().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]!.version).toBe(1);
    expect(data().audit.some(a => a.action === 'entry.create')).toBe(true);
  });

  it('updateEntry incrémente la version, préserve le pointage', () => {
    const id = get().addEntry(draft({ reconciled: true }))!;
    get().updateEntry(id, { amount: 250 });
    const e = data().entries.find(x => x.id === id)!;
    expect(e.amount).toBe(250);
    expect(e.version).toBe(2);
    expect(e.reconciled).toBe(true); // préservé (pas dans le patch)
  });

  it('suppression logique + restauration (audit sécurité)', () => {
    const id = get().addEntry(draft())!;
    get().softDeleteEntry(id, 'doublon');
    expect(data().entries.find(x => x.id === id)!.deletedAt).toBeTruthy();
    expect(
      data().audit.some(
        a => a.action === 'entry.delete' && a.category === 'securite'
      )
    ).toBe(true);
    get().restoreEntry(id);
    expect(data().entries.find(x => x.id === id)!.deletedAt).toBeUndefined();
  });

  it('verrou de clôture : aucune création/modif sur saison clôturée', () => {
    const id = get().addEntry(draft())!;
    get().closeSeason(activeId());
    expect(data().seasons.find(s => s.id === activeId())!.status).toBe(
      'cloturee'
    );
    expect(get().addEntry(draft())).toBeNull();
    get().updateEntry(id, { amount: 999 });
    expect(data().entries.find(x => x.id === id)!.amount).toBe(100); // inchangé
  });

  it('clôture fige le solde et trace en audit sécurité', () => {
    get().addEntry(draft({ sens: 'credit', amount: 500 }));
    get().closeSeason(activeId());
    const s = data().seasons.find(x => x.id === activeId())!;
    expect(s.closingBalance).toBe(1500); // reliquat 1000 + 500
    expect(data().audit.some(a => a.action === 'season.close')).toBe(true);
  });

  it('report de reliquat d’une saison clôturée vers une autre', () => {
    get().addEntry(draft({ sens: 'credit', amount: 500 }));
    const from = activeId();
    get().closeSeason(from);
    const to = get().addSeason('2026-2027', 0);
    get().carryOverReliquat(from, to);
    expect(data().seasons.find(s => s.id === to)!.openingBalance).toBe(1500);
  });

  it('setReconciled bascule le pointage', () => {
    const id = get().addEntry(draft())!;
    get().setReconciled(id, true);
    expect(data().entries.find(x => x.id === id)!.reconciled).toBe(true);
    get().setReconciled(id, false);
    expect(data().entries.find(x => x.id === id)!.reconciled).toBe(false);
  });

  it('importEntries ajoute en lot et ignore une saison clôturée', () => {
    const n = get().importEntries([draft(), draft({ amount: 50 })]);
    expect(n).toBe(2);
    expect(data().entries).toHaveLength(2);
  });

  it('generateFromRecurring crée une écriture depuis un modèle', () => {
    const rid = get().addRecurring({
      label: 'Frais SG',
      categoryCode: 'D12',
      amount: 14.67,
      method: 'prelevement',
    });
    const eid = get().generateFromRecurring(rid, '2025-10-10');
    const e = data().entries.find(x => x.id === eid)!;
    expect(e.categoryCode).toBe('D12');
    expect(e.sens).toBe('debit'); // déduit du sens de la catégorie
    expect(e.amount).toBe(14.67);
  });

  it('setBudget enregistre le budget par catégorie', () => {
    get().setBudget(activeId(), 'R1', 5000);
    expect(data().seasons.find(s => s.id === activeId())!.budget?.R1).toBe(
      5000
    );
  });
});
