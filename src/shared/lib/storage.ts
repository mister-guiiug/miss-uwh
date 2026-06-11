/**
 * Persistance locale (mode `local`).
 *
 * Choix : **localStorage** + enveloppe versionnée + chaîne de migrations +
 * validation zod. Le volume reste modeste (un journal saisonnier ≈ quelques
 * centaines d'écritures) ; un snapshot JSON unique est l'unité naturelle pour
 * l'export/import. Les pièces jointes volumineuses passent par Supabase Storage
 * en mode `supabase` (cf. README) ; en local elles sont en data URL et il est
 * conseillé de rester léger.
 *
 * Évolution : bascule vers IndexedDB le jour où l'on stocke beaucoup de pièces
 * jointes — le contrat `loadData/saveData/exportData/importData` resterait stable.
 */
import type { AppData } from '../types/domain.ts';
import { appDataSchema } from './schema.ts';
import { remapNonUuidSyncIds } from './migrateIds.ts';
import { createInitialData, SCHEMA_VERSION } from './seed.ts';
import { notifyError } from './toasts.ts';

/** Clé localStorage du snapshot complet (réutilisée par l'export de secours). */
export const STORAGE_KEY = 'miss-uwh:data';

/** Migrations indexées par version *source*. Chacune monte d'un cran. */
const migrations: Record<number, (data: unknown) => unknown> = {
  // 0 -> 1 : squelette pour d'anciens états pré-versionnés.
  0: (data: unknown) => ({ ...(data as object), version: 1 }),
  // 1 -> 2 : les entités synchronisables ont une clé primaire `uuid` côté
  // Supabase. Réécrit les ids hérités du seed (« sea_… », « ev_… ») en UUID et
  // propage le remappage aux clés étrangères, sinon la synchronisation échoue
  // (« invalid input syntax for type uuid »).
  1: (data: unknown) => ({
    ...remapNonUuidSyncIds(data as object),
    version: 2,
  }),
};

function runMigrations(raw: unknown): unknown {
  let data = raw as { version?: number };
  let version = typeof data.version === 'number' ? data.version : 0;
  while (version < SCHEMA_VERSION && migrations[version]) {
    data = migrations[version](data) as { version?: number };
    version = typeof data.version === 'number' ? data.version : version + 1;
  }
  return data;
}

/** Lit l'état persisté, migré et validé. Retombe sur le seed si invalide. */
export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialData();
    const migrated = runMigrations(JSON.parse(raw));
    const parsed = appDataSchema.safeParse(migrated);
    if (!parsed.success) {
      console.warn(
        '[miss-uwh] données invalides, réinitialisation',
        parsed.error
      );
      notifyError(
        'Données locales illisibles : l’application a démarré sur une base vierge. Vos anciennes données restent sur l’appareil tant que vous n’enregistrez pas.'
      );
      return createInitialData();
    }
    return parsed.data as AppData;
  } catch (err) {
    console.warn('[miss-uwh] lecture du stockage impossible', err);
    return createInitialData();
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('[miss-uwh] écriture du stockage impossible', err);
    notifyError(
      'Sauvegarde locale impossible (stockage plein ou indisponible). Exportez vos données pour ne rien perdre.'
    );
  }
}

export function clearData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
}

/** Sérialise pour export (sauvegarde JSON complète). */
export function exportData(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

/** Parse + valide un JSON importé. Lève une erreur lisible si invalide. */
export function importData(json: string): AppData {
  const migrated = runMigrations(JSON.parse(json));
  const parsed = appDataSchema.safeParse(migrated);
  if (!parsed.success) {
    throw new Error(
      'Fichier invalide : le format ne correspond pas à Miss UWH.'
    );
  }
  return parsed.data as AppData;
}
