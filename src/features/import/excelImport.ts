/**
 * Lecture d'un classeur Excel (.xlsx) côté navigateur. SheetJS est chargé
 * PARESSEUSEMENT depuis le CDN officiel — il ne fait pas partie du bundle (pas
 * d'impact sur le poids hors ligne ni sur l'audit de dépendances). La migration
 * est une action ponctuelle, en ligne ; le mapping lui-même est pur et testé
 * (cf. compteMapping.ts).
 */
import { mapCompteRows, type ParseResult } from './compteMapping.ts';

interface XlsxModule {
  read: (
    data: ArrayBuffer,
    opts: Record<string, unknown>
  ) => {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  utils: {
    sheet_to_json: (ws: unknown, opts: Record<string, unknown>) => unknown[][];
  };
}

const CDN_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';
let cached: XlsxModule | null = null;

async function loadXlsx(): Promise<XlsxModule> {
  if (cached) return cached;
  const url = CDN_URL; // variable -> import dynamique non résolu à la compilation
  cached = (await import(/* @vite-ignore */ url)) as unknown as XlsxModule;
  return cached;
}

export interface WorkbookParseResult extends ParseResult {
  sheet: string;
  sheets: string[];
}

/** Parse un fichier .xlsx : feuille « Compte » (ou 1re feuille) → écritures. */
export async function parseWorkbookFile(
  file: File
): Promise<WorkbookParseResult> {
  const xlsx = await loadXlsx();
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
