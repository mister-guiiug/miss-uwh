/**
 * Export Excel multi-feuilles (.xlsx) — réplique le classeur d'origine (Bilan,
 * Compte, une feuille par catégorie, Evolution). Préparation des données pure
 * et testée (cf. buildWorkbook.ts), écriture par le socle.
 *
 * BASCULÉ SUR `@mister-guiiug/dev-wpa-config/xlsx` (socle 3.24.0). La PR #54
 * avait REFUSÉ cette bascule, et le refus était juste : `buildXlsx` n'écrivait
 * alors qu'UNE feuille, là où cet export en produit au moins trois (Bilan,
 * Compte, Evolution), 19 sur le jeu de démonstration, 30 au maximum — une par
 * catégorie mouvementée du référentiel R1–R9 / D1–D13 et assimilées. Livrer un
 * onglet sur dix-neuf aurait été une régression.
 *
 * 3.24.0 lève exactement ce blocage : `buildXlsx` accepte une feuille OU un
 * tableau de feuilles, et son assainissement des noms d'onglets est repris de
 * `safeSheetName` (ci-contre, buildWorkbook.ts) — d'où sa neutralité sur les
 * noms qu'on lui passe. Le reste du contrat était déjà satisfait : cellules
 * numériques réellement typées (donc sommables), en-tête en gras, lignes de
 * longueurs inégales et lignes vides rendues telles quelles.
 *
 * CE QUE LA BASCULE FAIT GAGNER : SheetJS n'est plus chargé du CDN pour
 * EXPORTER. Le trésorier qui clique « Classeur Excel » ne dépend plus d'un
 * domaine tiers ni du réseau — l'export marche hors ligne. SheetJS reste
 * nécessaire à l'IMPORT, qui LIT des classeurs (cf. shared/lib/sheetjs.ts).
 */
import { buildXlsx, downloadXlsx } from '@mister-guiiug/dev-wpa-config/xlsx';
import type { AppData, Season } from '../../shared/types/domain.ts';
import { buildWorkbookSheets } from './buildWorkbook.ts';

export function exportWorkbookXlsx(data: AppData, season: Season): void {
  const sheets = buildWorkbookSheets(
    data.club.name,
    season,
    data.seasons,
    data.entries
  );
  downloadXlsx(buildXlsx(sheets), `bilan-${season.label}.xlsx`);
}
