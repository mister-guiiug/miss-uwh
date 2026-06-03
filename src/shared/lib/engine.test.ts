import { describe, expect, it } from 'vitest';
import type { EventLedger, JournalEntry, Season } from '../types/domain.ts';
import {
  componentsMatchAmount,
  computeBilan,
  eventResults,
  round2,
  runningBalances,
  seasonTotals,
  signedAmount,
  treasury,
} from './engine.ts';

let seq = 0;
function entry(p: Partial<JournalEntry>): JournalEntry {
  seq += 1;
  return {
    id: `e${seq}`,
    seasonId: 's1',
    categoryCode: 'R1',
    date: '2025-09-01',
    label: 'test',
    sens: 'credit',
    amount: 10,
    method: 'virement',
    attachments: [],
    createdAt: seq,
    updatedAt: seq,
    version: 1,
    ...p,
  };
}

const season: Season = {
  id: 's1',
  label: '2025-2026',
  startDate: '2025-05-15',
  endDate: '2026-05-15',
  status: 'ouverte',
  openingBalance: 2364.85,
};

describe('signedAmount', () => {
  it('credit positif, debit négatif', () => {
    expect(signedAmount(entry({ sens: 'credit', amount: 50 }))).toBe(50);
    expect(signedAmount(entry({ sens: 'debit', amount: 50 }))).toBe(-50);
  });
});

describe('runningBalances', () => {
  it('recalcule le solde après chaque écriture, dans l’ordre chronologique', () => {
    const entries = [
      entry({ date: '2025-09-10', sens: 'credit', amount: 647 }),
      entry({ date: '2025-09-01', sens: 'debit', amount: 14.67 }),
      entry({ date: '2025-09-29', sens: 'credit', amount: 1219.36 }),
    ];
    const rows = runningBalances(entries, season.openingBalance);
    // tri par date : -14.67, +647, +1219.36
    expect(rows.map(r => r.entry.amount)).toEqual([14.67, 647, 1219.36]);
    expect(rows[0]!.solde).toBe(round2(2364.85 - 14.67)); // 2350.18
    expect(rows[1]!.solde).toBe(round2(2350.18 + 647)); // 2997.18
    expect(rows[2]!.solde).toBe(round2(2997.18 + 1219.36)); // 4216.54
  });

  it('ignore les écritures supprimées logiquement', () => {
    const entries = [
      entry({ sens: 'credit', amount: 100 }),
      entry({ sens: 'credit', amount: 999, deletedAt: 1 }),
    ];
    const rows = runningBalances(entries, 0);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.solde).toBe(100);
  });
});

describe('computeBilan', () => {
  it('agrège recettes/dépenses et calcule le solde créditeur (règle 6)', () => {
    const entries = [
      entry({ categoryCode: 'R1', sens: 'credit', amount: 4574 }),
      entry({ categoryCode: 'R2', sens: 'credit', amount: 1219.36 }),
      entry({ categoryCode: 'D4', sens: 'debit', amount: 2939.04 }),
      entry({ categoryCode: 'D5', sens: 'debit', amount: 2082.59 }),
    ];
    const b = computeBilan(season, entries);
    expect(b.totalRecettesHorsReliquat).toBe(round2(4574 + 1219.36));
    expect(b.totalRecettes).toBe(round2(2364.85 + 4574 + 1219.36));
    expect(b.totalDepenses).toBe(round2(2939.04 + 2082.59));
    expect(b.soldeCrediteur).toBe(round2(b.totalRecettes - b.totalDepenses));
  });

  it('le solde créditeur est égal à la trésorerie de clôture', () => {
    const entries = [
      entry({ categoryCode: 'R1', sens: 'credit', amount: 800 }),
      entry({ categoryCode: 'D12', sens: 'debit', amount: 14.67 }),
      entry({ categoryCode: 'R7', sens: 'credit', amount: 79.5 }),
    ];
    const b = computeBilan(season, entries);
    expect(b.soldeCrediteur).toBe(b.tresorerie);
  });

  it('les écritures compensées gonflent les deux totaux mais s’annulent dans le solde', () => {
    const piscine = 28341.5;
    const base = [entry({ categoryCode: 'R1', sens: 'credit', amount: 1000 })];
    const withComp = [
      ...base,
      entry({ categoryCode: 'R-COMP', sens: 'credit', amount: piscine }),
      entry({ categoryCode: 'D-COMP', sens: 'debit', amount: piscine }),
    ];
    const a = computeBilan(season, base);
    const c = computeBilan(season, withComp);
    expect(c.totalRecettes).toBe(round2(a.totalRecettes + piscine));
    expect(c.totalDepenses).toBe(round2(a.totalDepenses + piscine));
    expect(c.soldeCrediteur).toBe(a.soldeCrediteur);
    expect(c.compensated.recettes).toBe(piscine);
    // le résultat d'exploitation ignore les compensées
    expect(c.resultatExploitation).toBe(a.resultatExploitation);
  });

  it('marque « à compléter » les catégories sans écriture (règle 12)', () => {
    const b = computeBilan(season, [
      entry({ categoryCode: 'R1', sens: 'credit', amount: 10 }),
    ]);
    const r1 = b.recettes.find(l => l.code === 'R1')!;
    const r2 = b.recettes.find(l => l.code === 'R2')!;
    expect(r1.status).toBe('complete');
    expect(r2.status).toBe('a_completer');
  });
});

describe('eventResults', () => {
  it('calcule le résultat net par événement (règle 10)', () => {
    const events: EventLedger[] = [
      { id: 'tda', seasonId: 's1', name: 'TDA 2026', kind: 'tournoi' },
    ];
    const entries = [
      entry({
        eventId: 'tda',
        categoryCode: 'R5',
        sens: 'credit',
        amount: 4350,
      }),
      entry({
        eventId: 'tda',
        categoryCode: 'D7',
        sens: 'debit',
        amount: 4064.75,
      }),
      entry({ categoryCode: 'R1', sens: 'credit', amount: 100 }), // hors événement
    ];
    const [tda] = eventResults(events, entries);
    expect(tda!.recettes).toBe(4350);
    expect(tda!.depenses).toBe(4064.75);
    expect(tda!.net).toBe(round2(4350 - 4064.75)); // 285.25
    expect(tda!.count).toBe(2);
  });
});

describe('seasonTotals', () => {
  it('utilise season.summary quand présent (saison historique)', () => {
    const histo: Season = {
      ...season,
      summary: { totalRecettes: 49536.46, totalDepenses: 44152.64 },
    };
    const t = seasonTotals(histo, []);
    expect(t.recettes).toBe(49536.46);
    expect(t.depenses).toBe(44152.64);
    expect(t.solde).toBe(round2(49536.46 - 44152.64)); // 5383.82
  });

  it('agrège depuis les écritures à défaut de summary', () => {
    const entries = [
      entry({ categoryCode: 'R1', sens: 'credit', amount: 1000 }),
      entry({ categoryCode: 'D4', sens: 'debit', amount: 400 }),
    ];
    const t = seasonTotals(season, entries);
    expect(t.recettes).toBe(round2(2364.85 + 1000));
    expect(t.depenses).toBe(400);
    expect(t.solde).toBe(round2(2364.85 + 1000 - 400));
  });
});

describe('treasury', () => {
  it('reliquat + somme des montants signés', () => {
    const entries = [
      entry({ sens: 'credit', amount: 500 }),
      entry({ sens: 'debit', amount: 200 }),
    ];
    expect(treasury(entries, 1000)).toBe(1300);
  });
});

describe('componentsMatchAmount', () => {
  it('valide quand la somme des composantes = montant', () => {
    expect(
      componentsMatchAmount(
        entry({ amount: 294, components: { adulte_plein: 200, enfant: 94 } })
      )
    ).toBe(true);
  });
  it('invalide quand la somme diffère', () => {
    expect(
      componentsMatchAmount(
        entry({ amount: 294, components: { adulte_plein: 200 } })
      )
    ).toBe(false);
  });
});
