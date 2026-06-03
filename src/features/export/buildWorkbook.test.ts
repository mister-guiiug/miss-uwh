import { describe, expect, it } from 'vitest';
import type { JournalEntry, Season } from '../../shared/types/domain.ts';
import {
  buildEvolutionRows,
  buildWorkbookSheets,
  safeSheetName,
} from './buildWorkbook.ts';

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

describe('safeSheetName', () => {
  it('tronque, nettoie et déduplique', () => {
    const used = new Set<string>();
    expect(safeSheetName('Bilan', used)).toBe('Bilan');
    expect(safeSheetName('Bilan', used)).toBe('Bilan 2');
    expect(safeSheetName('a:b/c?[d]', used)).toBe('a b c  d');
  });
});

describe('buildWorkbookSheets', () => {
  it('produit Bilan, Compte, une feuille par catégorie utilisée, Evolution', () => {
    const entries = [
      entry({ categoryCode: 'R1', sens: 'credit', amount: 647 }),
      entry({ categoryCode: 'D4', sens: 'debit', amount: 100 }),
    ];
    const sheets = buildWorkbookSheets(
      'Clermont Hockey Sub',
      season,
      [season],
      entries
    );
    const names = sheets.map(s => s.name);
    expect(names).toEqual(['Bilan', 'Compte', 'R1', 'D4', 'Evolution']);

    const compte = sheets.find(s => s.name === 'Compte')!;
    // en-tête + 2 écritures
    expect(compte.rows).toHaveLength(3);
    // solde courant final = reliquat + 647 - 100
    expect(compte.rows[2]![8]).toBe(2911.85);
  });
});

describe('buildEvolutionRows', () => {
  it('utilise summary pour l’historique', () => {
    const histo: Season = {
      ...season,
      label: '2024-2025',
      summary: { totalRecettes: 49536.46, totalDepenses: 44152.64 },
    };
    const rows = buildEvolutionRows([histo], []);
    expect(rows[1]).toEqual(['2024-2025', 49536.46, 44152.64, 5383.82]);
  });
});
