/**
 * Robustesse monétaire. Décision d'architecture : les montants sont des nombres
 * en EUROS avec `round2` aux points d'agrégation (et `numeric(12,2)` en base),
 * plutôt qu'un refactor en centimes entiers. Ces tests prouvent l'ABSENCE de
 * dérive d'arrondi aux ordres de grandeur d'un club (< 100 k€), ce qui rend le
 * refactor centimes inutile (risque > bénéfice). Si l'échelle change un jour,
 * l'option centimes reste documentée.
 */
import { describe, expect, it } from 'vitest';
import type { JournalEntry, Season } from '../types/domain.ts';
import { computeBilan, round2 } from './engine.ts';

/** Générateur pseudo-aléatoire déterministe (pas de Math.random : reproductible). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
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

let seq = 0;
function entry(p: Partial<JournalEntry>): JournalEntry {
  seq += 1;
  return {
    id: `e${seq}`,
    seasonId: 's1',
    categoryCode: 'R1',
    date: '2025-09-10',
    label: 't',
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

describe('robustesse monétaire', () => {
  it('cumuler 1000 montants au centime ne dérive pas (round2 exact)', () => {
    const rnd = lcg(42);
    let cents = 0;
    let euros = 0;
    for (let i = 0; i < 1000; i++) {
      const c = Math.floor(rnd() * 100_000); // 0 → 999,99 €
      cents += c;
      euros = round2(euros + c / 100);
    }
    // La valeur en euros, ramenée au centime, égale la somme entière exacte.
    expect(Math.round(euros * 100)).toBe(cents);
  });

  it('invariant solde créditeur = trésorerie sur 100 jeux aléatoires', () => {
    const rnd = lcg(7);
    const codes = ['R1', 'R2', 'R7', 'D1', 'D4', 'D12'];
    for (let t = 0; t < 100; t++) {
      const entries = Array.from({ length: 60 }, () => {
        const code = codes[Math.floor(rnd() * codes.length)]!;
        const sens = code.startsWith('R') ? 'credit' : 'debit';
        const amount = round2((Math.floor(rnd() * 500_000) + 1) / 100);
        return entry({ categoryCode: code, sens, amount });
      });
      const b = computeBilan(season, entries);
      expect(b.soldeCrediteur).toBe(b.tresorerie);
    }
  });
});
