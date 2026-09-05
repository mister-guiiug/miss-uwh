/**
 * Chargeur SheetJS partagé — pour l'IMPORT Excel, et lui seul depuis la
 * bascule de l'export sur `@mister-guiiug/dev-pwa-config/xlsx` (socle 3.24.0).
 * Chargé PARESSEUSEMENT depuis le CDN officiel — hors bundle (pas d'impact
 * hors ligne ni sur l'audit de dépendances) : plus rien ne l'appelle tant que
 * l'utilisateur n'ouvre pas l'écran d'import, action ponctuelle et en ligne.
 *
 * TOUJOURS LÀ, POUR UNE SEULE RAISON DÉSORMAIS : l'import LIT des classeurs
 * (`read`, `sheet_to_json`) et le module socle ne sait qu'en ÉCRIRE. Ce n'est
 * pas une omission de sa part mais son périmètre annoncé — analyser du XLSX
 * arbitraire (formats de dates, cellules fusionnées, formules, feuilles
 * héritées d'une décennie de classeurs du club) est un autre métier que
 * produire un fichier qu'on maîtrise de bout en bout.
 *
 * L'interface ci-dessous ne déclare QUE ce que l'import consomme :
 * `write`/`aoa_to_sheet`/`book_new`/`book_append_sheet` ont disparu avec
 * l'export. Ce qui reste ici est ce qui reste à remplacer.
 */
export interface SheetJs {
  read: (
    data: ArrayBuffer,
    opts: Record<string, unknown>
  ) => { SheetNames: string[]; Sheets: Record<string, unknown> };
  utils: {
    sheet_to_json: (ws: unknown, opts: Record<string, unknown>) => unknown[][];
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
