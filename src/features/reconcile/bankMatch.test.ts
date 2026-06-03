import { describe, expect, it } from 'vitest';
import type { JournalEntry } from '../../shared/types/domain.ts';
import { matchBankLines, parseBankCsv, type BankLine } from './bankMatch.ts';

let seq = 0;
function entry(p: Partial<JournalEntry>): JournalEntry {
  seq += 1;
  return {
    id: `e${seq}`,
    seasonId: 's1',
    categoryCode: 'R1',
    date: '2025-09-10',
    label: 'test',
    sens: 'credit',
    amount: 100,
    method: 'virement',
    attachments: [],
    createdAt: seq,
    updatedAt: seq,
    version: 1,
    ...p,
  };
}

describe('matchBankLines', () => {
  it('apparie par montant signé et date proche, ignore les pointées', () => {
    const entries = [
      entry({ id: 'a', sens: 'credit', amount: 647, date: '2025-09-10' }),
      entry({ id: 'b', sens: 'debit', amount: 100, date: '2025-09-12' }),
      entry({
        id: 'c',
        sens: 'credit',
        amount: 647,
        date: '2025-09-10',
        reconciled: true,
      }),
    ];
    const bank: BankLine[] = [
      { date: '2025-09-11', label: 'VIR', amount: 647 }, // → a (c déjà pointée)
      { date: '2025-09-12', label: 'PRLV', amount: -100 }, // → b
      { date: '2025-09-20', label: 'inconnu', amount: 999 }, // → aucun
    ];
    const res = matchBankLines(bank, entries);
    expect(res.matches).toEqual([
      { entryId: 'a', bankIndex: 0 },
      { entryId: 'b', bankIndex: 1 },
    ]);
    expect(res.unmatchedBank).toEqual([2]);
  });

  it('respecte la fenêtre de jours', () => {
    const entries = [entry({ id: 'a', amount: 50, date: '2025-01-01' })];
    const bank: BankLine[] = [{ date: '2025-02-01', label: 'x', amount: 50 }];
    expect(matchBankLines(bank, entries, 5).matches).toHaveLength(0);
  });
});

describe('parseBankCsv', () => {
  it('parse un CSV débit/crédit (FR, séparateur ;)', () => {
    const csv =
      'Date;Libellé;Débit;Crédit\n10/09/2025;VIR HELLOASSO;;647,00\n12/09/2025;PRLV SG;14,67;';
    const lines = parseBankCsv(csv);
    expect(lines).toEqual([
      { date: '2025-09-10', label: 'VIR HELLOASSO', amount: 647 },
      { date: '2025-09-12', label: 'PRLV SG', amount: -14.67 },
    ]);
  });

  it('parse un CSV montant unique signé', () => {
    const csv = 'date,label,montant\n2025-09-10,Test,-25.50';
    expect(parseBankCsv(csv)).toEqual([
      { date: '2025-09-10', label: 'Test', amount: -25.5 },
    ]);
  });
});
