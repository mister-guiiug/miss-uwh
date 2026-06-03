/**
 * Exports : CSV (compatible Excel FR, séparateur « ; » + BOM UTF-8) et JSON
 * (sauvegarde complète). Le PDF s'obtient via l'impression de l'écran Bilan
 * (mise en page dédiée @media print) — pas de dépendance lourde embarquée.
 */
import type {
  AppData,
  JournalEntry,
  Season,
} from '../../shared/types/domain.ts';
import { PAYMENT_METHOD_LABELS } from '../../shared/types/domain.ts';
import { categoryLabel } from '../../shared/lib/categories.ts';
import { computeBilan, runningBalances } from '../../shared/lib/engine.ts';
import { exportData } from '../../shared/lib/storage.ts';

/** Marque d'ordre des octets UTF-8 (U+FEFF) — Excel lit alors bien les accents. */
const BOM = String.fromCharCode(0xfeff);

function csvCell(v: string | number): string {
  const s = String(v ?? '');
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Array<Array<string | number>>): string {
  const body = rows.map(r => r.map(csvCell).join(';')).join('\r\n');
  return BOM + body;
}

export function downloadText(
  filename: string,
  mime: string,
  text: string
): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const num = (n: number) => n.toFixed(2).replace('.', ',');

/** Journal complet de la saison, avec solde courant. */
export function exportJournalCsv(
  season: Season,
  allEntries: JournalEntry[]
): void {
  const active = allEntries.filter(
    e => e.seasonId === season.id && !e.deletedAt
  );
  const rows: Array<Array<string | number>> = [
    [
      'Date',
      'Catégorie',
      'Libellé',
      'Mode',
      'N° pièce',
      'Débit',
      'Crédit',
      'Solde',
    ],
  ];
  for (const { entry, solde } of runningBalances(
    active,
    season.openingBalance
  )) {
    rows.push([
      entry.date,
      `${entry.categoryCode} ${categoryLabel(entry.categoryCode)}`,
      entry.label,
      PAYMENT_METHOD_LABELS[entry.method],
      entry.pieceRef ?? '',
      entry.sens === 'debit' ? num(entry.amount) : '',
      entry.sens === 'credit' ? num(entry.amount) : '',
      num(solde),
    ]);
  }
  downloadText(`journal-${season.label}.csv`, 'text/csv', toCsv(rows));
}

/** Synthèse bilan (recettes/dépenses par catégorie + totaux). */
export function exportBilanCsv(
  season: Season,
  allEntries: JournalEntry[]
): void {
  const b = computeBilan(season, allEntries);
  const rows: Array<Array<string | number>> = [
    [`BILAN ${season.label}`, ''],
    ['', ''],
    ['RECETTES', 'Montant €'],
    [`Reliquat d'ouverture`, num(b.reliquat)],
  ];
  for (const l of b.recettes)
    if (l.count > 0) rows.push([`${l.code} ${l.label}`, num(l.total)]);
  rows.push(['Total recettes', num(b.totalRecettes)], ['', '']);
  rows.push(['DÉPENSES', 'Montant €']);
  for (const l of b.depenses)
    if (l.count > 0) rows.push([`${l.code} ${l.label}`, num(l.total)]);
  rows.push(
    ['Total dépenses', num(b.totalDepenses)],
    ['', ''],
    ['Solde créditeur', num(b.soldeCrediteur)],
    [`Résultat d'exploitation`, num(b.resultatExploitation)]
  );
  downloadText(`bilan-${season.label}.csv`, 'text/csv', toCsv(rows));
}

export function exportJsonBackup(data: AppData): void {
  downloadText(
    'miss-uwh-sauvegarde.json',
    'application/json',
    exportData(data)
  );
}
