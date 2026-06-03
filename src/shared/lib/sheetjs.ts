/**
 * Chargeur SheetJS partagé (import ET export Excel). Chargé PARESSEUSEMENT depuis
 * le CDN officiel — hors bundle (pas d'impact hors ligne ni sur l'audit de
 * dépendances). Les opérations Excel sont des actions ponctuelles, en ligne.
 */
export interface SheetJs {
  read: (
    data: ArrayBuffer,
    opts: Record<string, unknown>
  ) => { SheetNames: string[]; Sheets: Record<string, unknown> };
  write: (wb: unknown, opts: Record<string, unknown>) => ArrayBuffer;
  utils: {
    sheet_to_json: (ws: unknown, opts: Record<string, unknown>) => unknown[][];
    aoa_to_sheet: (rows: Array<Array<string | number>>) => unknown;
    book_new: () => unknown;
    book_append_sheet: (wb: unknown, ws: unknown, name: string) => void;
  };
}

const CDN_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';
let cached: SheetJs | null = null;

export async function loadSheetJs(): Promise<SheetJs> {
  if (cached) return cached;
  const url = CDN_URL; // variable → import dynamique non résolu à la compilation
  cached = (await import(/* @vite-ignore */ url)) as unknown as SheetJs;
  return cached;
}
