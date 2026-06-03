/**
 * Lecture d'un classeur Excel (.xlsx) côté navigateur. SheetJS est chargé
 * paresseusement (cf. `shared/lib/sheetjs.ts`). Le mapping lui-même est pur et
 * testé (cf. compteMapping.ts).
 */
import { loadSheetJs } from '../../shared/lib/sheetjs.ts';
import { mapCompteRows, type ParseResult } from './compteMapping.ts';

export interface WorkbookParseResult extends ParseResult {
  sheet: string;
  sheets: string[];
}

/** Parse un fichier .xlsx : feuille « Compte » (ou 1re feuille) → écritures. */
export async function parseWorkbookFile(
  file: File
): Promise<WorkbookParseResult> {
  const xlsx = await loadSheetJs();
  const buf = await file.arrayBuffer();
  const wb = xlsx.read(buf, { cellDates: true });
  const sheet =
    wb.SheetNames.find(n => /compte/i.test(n)) ?? wb.SheetNames[0] ?? '';
  const ws = wb.Sheets[sheet];
  const rows = xlsx.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    blankrows: false,
  });
  return { ...mapCompteRows(rows), sheet, sheets: wb.SheetNames };
}
