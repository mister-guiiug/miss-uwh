/**
 * Persistance locale (mode `local`).
 *
 * Choix : **localStorage** plutôt qu'IndexedDB. Le volume reste modeste (un
 * journal saisonnier ≈ quelques centaines d'écritures) ; un snapshot JSON unique
 * est l'unité naturelle pour l'export/import. Les pièces jointes volumineuses
 * passent par Supabase Storage en mode `supabase` (cf. README) ; en local elles
 * sont en data URL et il est conseillé de rester léger. Évolution : bascule vers
 * IndexedDB le jour où l'on stocke beaucoup de pièces jointes — le contrat
 * ci-dessous resterait stable.
 *
 * La mécanique enveloppe versionnée + chaîne de migrations + validation vient de
 * `dev-wpa-config/versioned-store` — promue depuis CE fichier même et son jumeau
 * `miss-genius/src/shared/lib/storage.ts`. Ce module reste la façade de l'app.
 *
 * COMPATIBILITÉ (trois invariants, prouvés par `storage.test.ts` sur des
 * instantanés réels des versions antérieures) :
 *  1. **Données en place.** L'app écrivait la donnée NUE (version interne dans
 *     `data.version`) sous `miss-uwh:data`. Le socle enveloppe (`{v, data}`) et
 *     considère toute valeur sans enveloppe comme v0 : chaque migration est donc
 *     GARDÉE par la version interne (migration de coquille) — un instantané déjà
 *     à jour traverse la chaîne sans transformation ni perte, un v1 reçoit ses
 *     UUID comme avant.
 *  2. **Exports.** `exportData` continue de produire la donnée nue (avec son
 *     `version` interne) : l'ANCIENNE app sait importer les nouveaux fichiers, et
 *     `importData` accepte les fichiers nus déjà téléchargés (v1 ou v2) comme les
 *     enveloppes `{v, data}` du socle. `unwrapSnapshot` étend la garantie à
 *     l'export de secours de l'`ErrorBoundary`, qui lit le stockage sans React.
 *  3. **Contrat.** Mêmes cinq fonctions, mêmes signatures : le store zustand
 *     (`useAppStore`, `storeHelpers`) et l'écran Réglages ne voient rien.
 *
 * Ce que la bascule AJOUTE : copie de côté (`miss-uwh:data.backup-…`) avant
 * toute migration ou perte possible, migration persistée dès le chargement (elle
 * ne tourne plus à chaque démarrage en attendant la première sauvegarde), et
 * jamais de destruction silencieuse — une version inconnue est mise de côté au
 * lieu d'être écrasée à la sauvegarde suivante.
 */
import { createVersionedStore } from '@mister-guiiug/dev-wpa-config/versioned-store';
import type { AppData } from '../types/domain.ts';
import { appDataSchema } from './schema.ts';
import { remapNonUuidSyncIds } from './migrateIds.ts';
import { createInitialData, SCHEMA_VERSION } from './seed.ts';
import { notifyError } from './toasts.ts';
import { translate } from '../../i18n/index.ts';

/** Clé localStorage du snapshot complet (réutilisée par l'export de secours). */
export const STORAGE_KEY = 'miss-uwh:data';

/** Version interne portée par la donnée elle-même (`data.version`). */
function innerVersion(data: unknown): number {
  const v = (data as { version?: unknown } | null)?.version;
  return typeof v === 'number' ? v : 0;
}

/**
 * Migrations indexées par version SOURCE (contrat du socle : chacune monte d'un
 * cran, c'est le magasin qui tient le compte).
 *
 * GARDE DE COQUILLE : les instantanés historiques sont stockés nus — le socle
 * les voit TOUS en v0, quelle que soit leur version interne. Chaque étape ne
 * transforme donc que si la version interne l'exige, et la maintient à jour : le
 * schéma zod l'exige, et c'est elle qui rend les fichiers d'export
 * auto-descriptifs.
 */
const migrations: Record<number, (data: unknown) => unknown> = {
  // 0 -> 1 : squelette pour d'anciens états pré-versionnés.
  0: (data: unknown) =>
    innerVersion(data) >= 1 ? data : { ...(data as object), version: 1 },
  // 1 -> 2 : les entités synchronisables ont une clé primaire `uuid` côté
  // Supabase. Réécrit les ids hérités du seed (« sea_… », « ev_… ») en UUID et
  // propage le remappage aux clés étrangères, sinon la synchronisation échoue
  // (« invalid input syntax for type uuid »).
  1: (data: unknown) =>
    innerVersion(data) >= 2
      ? data
      : { ...remapNonUuidSyncIds(data as object), version: 2 },
};

/**
 * Vrai le temps d'un `importData` (synchrone, donc sans réentrance). La
 * validation est partagée par le chargement et l'import, mais seul le
 * chargement doit prévenir l'utilisateur : à l'import, l'erreur remonte à
 * l'écran Réglages, qui affiche son propre message sur son propre bouton.
 */
let importInProgress = false;

const store = createVersionedStore<AppData>({
  // Préfixe partagé avec `miss-uwh:theme` (anti-FOUC dans index.html) et
  // `miss-uwh:sync…` (file de synchro) ; la clé composée reste la clé
  // historique `miss-uwh:data`.
  store: 'miss-uwh:',
  key: 'data',
  version: SCHEMA_VERSION,
  migrations,
  // Validation injectée : le socle ne dépend pas de zod, l'app lui passe son
  // `schema.parse` (qui lève sur une donnée invalide).
  validate: data => {
    try {
      return appDataSchema.parse(data) as AppData;
    } catch (err) {
      if (!importInProgress) {
        console.warn('[miss-uwh] données invalides, réinitialisation', err);
        notifyError(translate('system.storageCorrupt'));
      }
      throw err;
    }
  },
  seed: createInitialData,
});

/** Lit l'état persisté, migré et validé. Retombe sur le seed si invalide. */
export function loadData(): AppData {
  return store.load();
}

export function saveData(data: AppData): void {
  if (!store.save(data)) {
    console.error('[miss-uwh] écriture du stockage impossible');
    notifyError(translate('system.storageSaveFailed'));
  }
}

/** Efface l'instantané ET ses copies de côté ; `miss-uwh:theme` survit. */
export function clearData(): void {
  store.clear();
}

/**
 * Sérialise pour export (sauvegarde JSON complète). VOLONTAIREMENT la donnée
 * nue, pas l'enveloppe `{v, data}` du socle : le fichier reste importable par
 * les versions antérieures de l'app, et la version interne (`data.version`)
 * suffit à `importData` pour rejouer les migrations demain.
 */
export function exportData(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Parse + migre + valide un JSON importé (fichier nu historique ou enveloppe du
 * socle). N'écrit que si tout a réussi ; lève une erreur lisible sinon.
 */
export function importData(json: string): AppData {
  importInProgress = true;
  try {
    return store.import(json);
  } finally {
    importInProgress = false;
  }
}

/**
 * Rend la donnée NUE d'un instantané lu BRUT dans le stockage — enveloppe
 * `{v, data}` du socle, ou instantané d'avant la bascule, déjà nu. Sert l'export
 * de secours de l'`ErrorBoundary`, qui lit le localStorage sans React ni zod :
 * le fichier téléchargé garde ainsi le format de `exportData` (invariant 2).
 * Devant l'inattendu, rend l'original tel quel — un filet de sécurité n'aggrave
 * pas la situation.
 */
export function unwrapSnapshot(raw: string): string {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      typeof (parsed as { v?: unknown }).v === 'number' &&
      'data' in parsed
    ) {
      return JSON.stringify((parsed as { data: unknown }).data, null, 2);
    }
  } catch {
    /* illisible : mieux vaut livrer l'original que rien du tout */
  }
  return raw;
}
