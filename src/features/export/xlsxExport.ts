/**
 * Export Excel multi-feuilles (.xlsx) — réplique le classeur d'origine (Bilan,
 * Compte, une feuille par catégorie, Evolution). SheetJS chargé à la demande ;
 * préparation des données pure et testée (cf. buildWorkbook.ts).
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
