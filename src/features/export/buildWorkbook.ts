/**
 * Préparation PURE (testable) du classeur Excel d'export : une feuille Bilan,
 * une feuille Compte (journal soldé), une feuille par catégorie utilisée, et une
 * feuille Evolution multi-saisons. Réplique la structure du classeur d'origine.
 * Les montants sont des NOMBRES (pas des chaînes) → sommes/formules Excel ok.
 *
 * LA STRUCTURE RENDUE EST CELLE DU SOCLE (`XlsxSheet` de
 * `@mister-guiiug/dev-wpa-config/xlsx`), pas une forme maison qu'il faudrait
 * traduire : `xlsxExport.ts` passe le tableau tel quel à `buildXlsx`. Le type
 * est donc IMPORTÉ, pas recopié — le jour où le contrat socle bouge, c'est ici
 * que la compilation le dit.
 *
 * QUI A UN `header` (et donc une ligne en gras) : les feuilles qui commencent
 * VRAIMENT par une ligne d'en-tête — Compte et Evolution. Bilan et les
 * feuilles de catégorie commencent par un TITRE sur une cellule ; le socle
 * prévoit ce cas et demande alors d'omettre `header`, la feuille démarrant
 * directement à sa première ligne.
 */
import type { XlsxSheet } from '@mister-guiiug/dev-wpa-config/xlsx';
import type { JournalEntry, Season } from '../../shared/types/domain.ts';
import { PAYMENT_METHOD_LABELS } from '../../shared/types/domain.ts';
import { CATEGORIES, categoryLabel } from '../../shared/lib/categories.ts';
import {
  computeBilan,
  isActive,
  runningBalances,
  seasonTotals,
} from '../../shared/lib/engine.ts';

/** Une feuille du classeur, au format attendu par `buildXlsx` du socle. */
export type SheetData = XlsxSheet;

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Nom de feuille valide Excel : ≤ 31 car., sans []:*?/\, unique.
 *
 * Le socle assainit AUSSI les noms qu'on lui passe (`sanitizeSheetName`, repris
 * de cette fonction), mais il ne l'expose pas : c'est ici que les noms sont
 * décidés, et son passage est alors sans effet — mêmes caractères interdits,
 * même troncature à 31, même suffixe ` 2`, ` 3`… sur un doublon comparé en
 * minuscules. Le test de bout en bout vérifie que les noms rendus ici
 * ressortent intacts du classeur.
 */
export function safeSheetName(raw: string, used: Set<string>): string {
  const base =
    raw
      .replace(/[[\]:*?/\\]/g, ' ')
      .slice(0, 31)
      .trim() || 'Feuille';
  let final = base;
  let i = 2;
  while (used.has(final.toLowerCase())) {
    const suffix = ` ${i++}`;
    final = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(final.toLowerCase());
  return final;
}

export function buildBilanRows(
  season: Season,
  allEntries: JournalEntry[],
  clubName: string
): Array<Array<string | number>> {
  const b = computeBilan(season, allEntries);
  const rows: Array<Array<string | number>> = [
    [`BILAN ${season.label} — ${clubName}`],
    [],
    ['RECETTES', 'Montant € TTC'],
    ['Reliquat exercice précédent', r2(b.reliquat)],
  ];
  for (const l of b.recettes)
    if (l.count > 0) rows.push([`${l.code} ${l.label}`, r2(l.total)]);
  rows.push(['Total recettes', r2(b.totalRecettes)], []);
  rows.push(['DÉPENSES', 'Montant € TTC']);
  for (const l of b.depenses)
    if (l.count > 0) rows.push([`${l.code} ${l.label}`, r2(l.total)]);
  rows.push(
    ['Total dépenses', r2(b.totalDepenses)],
    [],
    ['Solde créditeur', r2(b.soldeCrediteur)],
    ["Résultat d'exploitation", r2(b.resultatExploitation)],
    ['Trésorerie de clôture', r2(b.tresorerie)]
  );
  return rows;
}

/** En-tête de la feuille Compte — passé en `header` au socle, donc en gras. */
export const COMPTE_HEADER = [
  'Date',
  'Libellé',
  'Catégorie',
  'Mode',
  'N° pièce',
  'Code facture',
  'Débit',
  'Crédit',
  'Solde',
  'Observation',
];

/** Lignes du journal soldé, SANS l'en-tête (cf. `COMPTE_HEADER`). */
export function buildCompteRows(
  season: Season,
  allEntries: JournalEntry[]
): Array<Array<string | number>> {
  const active = allEntries.filter(
    e => e.seasonId === season.id && isActive(e)
  );
  const rows: Array<Array<string | number>> = [];
  for (const { entry, solde } of runningBalances(
    active,
    season.openingBalance
  )) {
    rows.push([
      entry.date,
      entry.label,
      `${entry.categoryCode} ${categoryLabel(entry.categoryCode)}`,
      PAYMENT_METHOD_LABELS[entry.method],
      entry.pieceRef ?? '',
      entry.invoiceCode ?? '',
      entry.sens === 'debit' ? r2(entry.amount) : '',
      entry.sens === 'credit' ? r2(entry.amount) : '',
      r2(solde),
      entry.observation ?? '',
    ]);
  }
  return rows;
}

/** En-tête de la feuille Evolution — passé en `header` au socle, donc en gras. */
export const EVOLUTION_HEADER = [
  'Saison',
  'Total recettes',
  'Total dépenses',
  'Solde créditeur',
];

/** Une ligne par saison, SANS l'en-tête (cf. `EVOLUTION_HEADER`). */
export function buildEvolutionRows(
  seasons: Season[],
  allEntries: JournalEntry[]
): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [];
  for (const s of [...seasons].sort((a, b) => (a.label < b.label ? -1 : 1))) {
    const t = seasonTotals(s, allEntries);
    rows.push([s.label, r2(t.recettes), r2(t.depenses), r2(t.solde)]);
  }
  return rows;
}

/** Construit l'ensemble des feuilles du classeur (Bilan, Compte, catégories, Evolution). */
export function buildWorkbookSheets(
  clubName: string,
  season: Season,
  seasons: Season[],
  allEntries: JournalEntry[]
): SheetData[] {
  const used = new Set<string>();
  const active = allEntries.filter(
    e => e.seasonId === season.id && isActive(e)
  );

  const sheets: SheetData[] = [
    // Pas de `header` : le Bilan commence par un TITRE sur une cellule, suivi
    // de lignes vides et de lignes à deux colonnes.
    {
      name: safeSheetName('Bilan', used),
      rows: buildBilanRows(season, allEntries, clubName),
    },
    {
      name: safeSheetName('Compte', used),
      header: COMPTE_HEADER,
      rows: buildCompteRows(season, allEntries),
    },
  ];

  for (const cat of CATEGORIES) {
    const own = active
      .filter(e => e.categoryCode === cat.code)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    if (own.length === 0) continue;
    const rows: Array<Array<string | number>> = [
      [`${cat.code} — ${cat.label}`],
      ['Date', 'Libellé', 'Mode', 'N° pièce', 'Montant'],
    ];
    let total = 0;
    for (const e of own) {
      total += e.amount;
      rows.push([
        e.date,
        e.label,
        PAYMENT_METHOD_LABELS[e.method],
        e.pieceRef ?? '',
        r2(e.amount),
      ]);
    }
    rows.push([], ['Total', '', '', '', r2(total)]);
    // Pas de `header` non plus : la ligne 1 est le titre de la catégorie,
    // l'en-tête ne vient qu'en ligne 2 — et le socle ne met en gras que la
    // PREMIÈRE ligne. Le titre reste en tête, comme dans le classeur d'origine.
    sheets.push({ name: safeSheetName(cat.code, used), rows });
  }

  sheets.push({
    name: safeSheetName('Evolution', used),
    header: EVOLUTION_HEADER,
    rows: buildEvolutionRows(seasons, allEntries),
  });
  return sheets;
}
