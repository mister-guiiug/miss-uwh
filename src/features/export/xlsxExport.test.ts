/**
 * Preuve de bout en bout que l'export Excel est bien MULTI-FEUILLES depuis la
 * bascule sur `@mister-guiiug/dev-pwa-config/xlsx` — le point exact sur lequel
 * la PR #54 avait refusé d'adopter le module socle.
 *
 * Le classeur est RELU, pas seulement construit : `buildXlsx` produit une
 * archive ZIP « stored » (méthode 0, sans compression), donc les parties OOXML
 * s'en extraient sans dépendance. On vérifie sur le fichier réel ce que le
 * trésorier verra : autant d'onglets que de feuilles demandées, les noms
 * rendus par `safeSheetName` intacts, les montants en cellules NUMÉRIQUES, les
 * en-têtes en gras, et les lignes vides et de longueurs inégales préservées.
 */
import { buildXlsx } from '@mister-guiiug/dev-pwa-config/xlsx';
import { describe, expect, it } from 'vitest';
import type { JournalEntry, Season } from '../../shared/types/domain.ts';
import { buildWorkbookSheets } from './buildWorkbook.ts';

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

/**
 * Extrait les entrées d'une archive ZIP « stored » : nom → contenu décodé.
 * Parcourt les en-têtes locaux tant que la signature `PK\x03\x04` est là.
 */
function readStoredZip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const parts = new Map<string, string>();
  let p = 0;
  while (p + 30 <= bytes.length && view.getUint32(p, true) === 0x04034b50) {
    if (view.getUint16(p + 8, true) !== 0)
      throw new Error('entrée compressée : le lecteur ne gère que « stored »');
    const size = view.getUint32(p + 18, true);
    const nameLen = view.getUint16(p + 26, true);
    const start = p + 30 + nameLen + view.getUint16(p + 28, true);
    parts.set(
      decoder.decode(bytes.subarray(p + 30, p + 30 + nameLen)),
      decoder.decode(bytes.subarray(start, start + size))
    );
    p = start + size;
  }
  return parts;
}

/** Les catégories mouvementées du jeu de test : une feuille chacune. */
const CODES = ['R1', 'R2', 'R5', 'D1', 'D4', 'D9', 'D12'];

const entries = CODES.map(code =>
  entry({
    categoryCode: code,
    sens: code.startsWith('R') ? 'credit' : 'debit',
    amount: 100,
  })
);

describe('exportWorkbookXlsx — classeur multi-feuilles', () => {
  const sheets = buildWorkbookSheets(
    'Clermont Hockey Sub',
    season,
    [season],
    [...entries, entry({ categoryCode: 'R1', sens: 'credit', amount: 647 })]
  );
  const parts = readStoredZip(buildXlsx(sheets));
  const workbook = parts.get('xl/workbook.xml') ?? '';

  it('déclare autant d’onglets que de feuilles, dans l’ordre et sous leurs noms', () => {
    // Bilan + Compte + 7 catégories mouvementées + Evolution.
    expect(sheets).toHaveLength(10);
    const names = [...workbook.matchAll(/<sheet name="([^"]+)"/g)].map(
      m => m[1]
    );
    expect(names).toEqual(sheets.map(s => s.name));
    expect(names).toEqual([
      'Bilan',
      'Compte',
      'R1',
      'R2',
      'R5',
      'D1',
      'D4',
      'D9',
      'D12',
      'Evolution',
    ]);
  });

  it('embarque une partie worksheet par onglet, et pas une de plus', () => {
    const worksheets = [...parts.keys()].filter(n =>
      n.startsWith('xl/worksheets/')
    );
    expect(worksheets).toHaveLength(sheets.length);
    // Chaque partie est déclarée dans les types de contenu, sinon Excel
    // l'ignore — un onglet vide au lieu d'une feuille.
    const types = parts.get('[Content_Types].xml') ?? '';
    for (const name of worksheets) expect(types).toContain(`/${name}`);
  });

  it('type réellement les montants et met les en-têtes en gras', () => {
    const compte = parts.get('xl/worksheets/sheet2.xml') ?? '';
    // Solde courant final : 2364,85 + 647 + 100×3 recettes − 100×4 dépenses.
    expect(compte).toContain('<v>2911.85</v>');
    // Le style 1 (gras) n'est posé que sur la ligne 1 — l'en-tête.
    expect(compte).toContain('<c r="A1" s="1"');
    expect(compte).not.toContain('<c r="A2" s="1"');
  });

  it('préserve les lignes vides et les longueurs inégales du Bilan', () => {
    const bilan = parts.get('xl/worksheets/sheet1.xml') ?? '';
    // Ligne 1 : le titre, une seule cellule — et sans gras, faute d'en-tête.
    expect(bilan).toMatch(/<row r="1"><c r="A1" t="inlineStr">/);
    // Ligne 2 : le séparateur vide, qui occupe bien sa ligne.
    expect(bilan).toContain('<row r="2"/>');
    // Ligne 3 : deux colonnes.
    expect(bilan).toMatch(/<row r="3"><c r="A3"[^>]*>.*<c r="B3"/);
  });
});
