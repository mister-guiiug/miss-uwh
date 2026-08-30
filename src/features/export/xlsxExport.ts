/**
 * Export Excel multi-feuilles (.xlsx) — réplique le classeur d'origine (Bilan,
 * Compte, une feuille par catégorie, Evolution). SheetJS chargé à la demande ;
 * préparation des données pure et testée (cf. buildWorkbook.ts).
 *
 * POURQUOI PAS `@mister-guiiug/dev-wpa-config/xlsx` (socle 3.23.0), QUI VISE
 * POURTANT CE FICHIER. Le module socle écrit un classeur MONO-FEUILLE :
 * `buildXlsx({ name, header, rows })` n'émet qu'un `xl/worksheets/sheet1.xml`,
 * un seul `<sheet>` dans `workbook.xml` et un seul `Override` de type de
 * contenu — il n'y a pas de paramètre pour en ajouter. Or cet export produit
 * AU MOINS trois onglets (Bilan, Compte, Evolution) et un de plus par
 * catégorie mouvementée : 19 sur le jeu de démonstration, 30 au maximum
 * (les 27 catégories du référentiel R1–R9 / D1–D13 et assimilées). Le
 * bouton le promet noir sur blanc — « Classeur Excel multi-feuilles » — et le
 * trésorier navigue d'onglet en onglet pour justifier une ligne. Basculer, ce
 * serait livrer un onglet sur dix-neuf : une régression, pas une adoption.
 *
 * LE JOUR OÙ LE SOCLE SAURA ÉCRIRE PLUSIEURS FEUILLES, la bascule tiendra en
 * dix lignes : `buildWorkbookSheets` rend déjà des `SheetData[]` de chaînes et
 * de nombres — pas une formule, pas un format de cellule, pas une largeur de
 * colonne, pas une date typée. Tout le reste du contrat socle est satisfait.
 */
import type { AppData, Season } from '../../shared/types/domain.ts';
import { loadSheetJs } from '../../shared/lib/sheetjs.ts';
import { buildWorkbookSheets } from './buildWorkbook.ts';

export async function exportWorkbookXlsx(
  data: AppData,
  season: Season
): Promise<void> {
  const xlsx = await loadSheetJs();
  const sheets = buildWorkbookSheets(
    data.club.name,
    season,
    data.seasons,
    data.entries
  );
  const wb = xlsx.utils.book_new();
  for (const s of sheets) {
    const ws = xlsx.utils.aoa_to_sheet(s.rows);
    xlsx.utils.book_append_sheet(wb, ws, s.name);
  }
  const out = xlsx.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bilan-${season.label}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
