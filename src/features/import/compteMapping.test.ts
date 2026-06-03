import { describe, expect, it } from 'vitest';
import {
  categoryFromOrder,
  mapCompteRows,
  methodFromLabel,
  toIsoDate,
} from './compteMapping.ts';

describe('categoryFromOrder', () => {
  it('déduit la catégorie du préfixe d’ORDRE', () => {
    expect(categoryFromOrder('R8 Divers 3')).toBe('R8');
    expect(categoryFromOrder('D6 Stage J 1')).toBe('D6');
    expect(categoryFromOrder('R1 Cotis. 12')).toBe('R1');
  });
  it('distingue D1 de D10–D13', () => {
    expect(categoryFromOrder('D1 Licenc. 3')).toBe('D1');
    expect(categoryFromOrder('D10 Inscrip 2')).toBe('D10');
    expect(categoryFromOrder('D12 Divers 5')).toBe('D12');
  });
  it('mappe les libellés sans code (Formation, Comm)', () => {
    expect(categoryFromOrder('Formation 1')).toBe('D11');
    expect(categoryFromOrder('Comm 2')).toBe('D13');
  });
  it('renvoie undefined pour un préfixe inconnu', () => {
    expect(categoryFromOrder('XYZ 1')).toBeUndefined();
  });
});

describe('methodFromLabel', () => {
  it('reconnaît les modes de règlement du relevé', () => {
    expect(methodFromLabel('PRLV')).toBe('prelevement');
    expect(methodFromLabel('VRT')).toBe('virement');
    expect(methodFromLabel('cheque')).toBe('cheque');
    expect(methodFromLabel('HelloAsso')).toBe('helloasso');
    expect(methodFromLabel('')).toBe('autre');
  });
});

describe('toIsoDate', () => {
  it('normalise différentes formes de date', () => {
    expect(toIsoDate(new Date('2025-09-10T00:00:00Z'))).toBe('2025-09-10');
    expect(toIsoDate('2025-09-10 00:00:00')).toBe('2025-09-10');
    expect(toIsoDate('')).toBeUndefined();
  });
});

describe('mapCompteRows', () => {
  it('extrait le reliquat, mappe crédits/débits et signale les inconnus', () => {
    const rows: unknown[][] = [
      [
        'ORDRE',
        'DATE',
        'LIBELLE',
        'CODE FACTURE',
        'MODE RGLT',
        'N° PIECE',
        'DEBITS',
        'CREDIT',
        'SOLDE',
      ],
      ['', '', 'ANCIEN SOLDE au 15/05/2025', '', '', '', '', 2364.85, 2364.85],
      [
        'R8 Divers 1',
        '2025-06-08 00:00:00',
        'Soutien ASSO',
        '',
        'PRLV',
        '',
        '',
        14.67,
        2379.52,
      ],
      [
        'D6 Stage J 1',
        '2025-06-09 00:00:00',
        'resto CF D1+D2',
        '',
        'cheque',
        'chq 0010739',
        720,
        '',
        1659.52,
      ],
      [
        'ZZ Inconnu 1',
        '2025-06-10 00:00:00',
        'ligne bizarre',
        '',
        'VRT',
        '',
        10,
        '',
        0,
      ],
      ['R1 Cotis. 6', '', 'ligne réservée', '', '', '', '', '', ''],
    ];
    const res = mapCompteRows(rows);
    expect(res.openingBalance).toBe(2364.85);
    expect(res.entries).toHaveLength(2);

    const [soutien, resto] = res.entries;
    expect(soutien).toMatchObject({
      categoryCode: 'R8',
      sens: 'credit',
      amount: 14.67,
      method: 'prelevement',
      date: '2025-06-08',
    });
    expect(resto).toMatchObject({
      categoryCode: 'D6',
      sens: 'debit',
      amount: 720,
      method: 'cheque',
      pieceRef: 'chq 0010739',
    });
    expect(res.warnings.some(w => w.includes('ZZ Inconnu'))).toBe(true);
  });
});
