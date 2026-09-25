/**
 * La MODIFICATION d'une écriture existante, telle qu'elle part vers le serveur :
 * un diff des champs que `update_entry_checked` (0020 + 0021) sait écrire, avec
 * la version que le client a VUE. Pur et sans réseau : le store l'importe pour
 * construire l'opération, la couche de synchro pour l'envoyer et la rejouer.
 *
 * POURQUOI UN DIFF, ET PAS L'ÉCRITURE ENTIÈRE. Après un conflit, « Réappliquer
 * ma modification » doit reposer CE QUE L'UTILISATEUR A CHANGÉ sur la version
 * du serveur. Une copie entière écraserait, en plus, les champs qu'un autre
 * trésorier a modifiés entre-temps — exactement ce que la concurrence optimiste
 * est là pour empêcher. Le prix du diff : deux modifications en attente sur la
 * même écriture doivent FUSIONNER leurs champs (`mergeEntryPatches`), là où la
 * file du socle se contente de remplacer l'entrée de même clé.
 *
 * UNE CLÉ PRÉSENTE S'APPLIQUE, `null` COMPRIS. C'est la sémantique de 0021 :
 * `null` vide un champ facultatif (observation, pièce, événement…). Le diff
 * n'écrit donc jamais `undefined` — qui disparaîtrait d'ailleurs au passage
 * par `localStorage`, où la file est persistée.
 */
import type {
  ComponentBreakdown,
  EntrySens,
  JournalEntry,
  PaymentMethod,
} from '../shared/types/domain.ts';
import type { RemoteOp } from './syncBus.ts';

/** Les champs qu'une modification peut porter — ni plus, ni moins que la RPC. */
export interface EntryPatch {
  label?: string;
  amount?: number;
  categoryCode?: string;
  date?: string;
  sens?: EntrySens;
  method?: PaymentMethod;
  reconciled?: boolean;
  pieceRef?: string | null;
  invoiceCode?: string | null;
  observation?: string | null;
  eventId?: string | null;
  components?: ComponentBreakdown | null;
  deletedAt?: number | null;
}

/** L'opération de la file qui porte une modification. */
export type EntryUpdateOp = Extract<RemoteOp, { kind: 'entry.update' }>;

/** Des composantes vides valent l'absence de composantes. */
function componentsOrNull(c: ComponentBreakdown | undefined) {
  return c && Object.keys(c).length > 0 ? c : null;
}

function sameComponents(
  a: ComponentBreakdown | undefined,
  b: ComponentBreakdown | undefined
): boolean {
  const x = componentsOrNull(a);
  const y = componentsOrNull(b);
  if (x === null || y === null) return x === y;
  const keys = Object.keys(x);
  return (
    keys.length === Object.keys(y).length && keys.every(k => x[k] === y[k])
  );
}

/**
 * Ce qui a changé entre deux états d'une écriture, restreint aux champs que le
 * serveur sait écrire. `reconciledAt` et les pièces jointes n'y sont pas : le
 * premier n'a pas de colonne, les secondes vivent dans leur propre table.
 * `seasonId` non plus : une écriture ne change pas de saison (cf. 0021).
 */
export function entryPatchBetween(
  before: JournalEntry,
  after: JournalEntry
): EntryPatch {
  const patch: EntryPatch = {};
  if (after.label !== before.label) patch.label = after.label;
  if (after.amount !== before.amount) patch.amount = after.amount;
  if (after.categoryCode !== before.categoryCode)
    patch.categoryCode = after.categoryCode;
  if (after.date !== before.date) patch.date = after.date;
  if (after.sens !== before.sens) patch.sens = after.sens;
  if (after.method !== before.method) patch.method = after.method;
  // La colonne est NOT NULL (défaut false) : « non renseigné » vaut « non ».
  if (Boolean(after.reconciled) !== Boolean(before.reconciled))
    patch.reconciled = Boolean(after.reconciled);
  if ((after.pieceRef ?? null) !== (before.pieceRef ?? null))
    patch.pieceRef = after.pieceRef ?? null;
  if ((after.invoiceCode ?? null) !== (before.invoiceCode ?? null))
    patch.invoiceCode = after.invoiceCode ?? null;
  if ((after.observation ?? null) !== (before.observation ?? null))
    patch.observation = after.observation ?? null;
  if ((after.eventId ?? null) !== (before.eventId ?? null))
    patch.eventId = after.eventId ?? null;
  if (!sameComponents(before.components, after.components))
    patch.components = componentsOrNull(after.components);
  if ((after.deletedAt ?? null) !== (before.deletedAt ?? null))
    patch.deletedAt = after.deletedAt ?? null;
  return patch;
}

export function isEmptyPatch(patch: EntryPatch): boolean {
  return Object.keys(patch).length === 0;
}

/**
 * Deux modifications de la même écriture n'en font qu'une : les champs de la
 * plus récente l'emportent, ceux de l'ancienne qu'elle ne touche pas restent.
 * L'ORDRE compte — l'appelant passe la plus ancienne en premier.
 */
export function mergeEntryPatches(
  older: EntryPatch,
  newer: EntryPatch
): EntryPatch {
  return { ...older, ...newer };
}

/** Pose un patch sur une écriture (relecture du serveur + ma modification). */
export function applyEntryPatch(
  entry: JournalEntry,
  patch: EntryPatch
): JournalEntry {
  const next: JournalEntry = { ...entry };
  if (patch.label !== undefined) next.label = patch.label;
  if (patch.amount !== undefined) next.amount = patch.amount;
  if (patch.categoryCode !== undefined) next.categoryCode = patch.categoryCode;
  if (patch.date !== undefined) next.date = patch.date;
  if (patch.sens !== undefined) next.sens = patch.sens;
  if (patch.method !== undefined) next.method = patch.method;
  if (patch.reconciled !== undefined) next.reconciled = patch.reconciled;
  if (patch.pieceRef !== undefined) next.pieceRef = patch.pieceRef ?? undefined;
  if (patch.invoiceCode !== undefined)
    next.invoiceCode = patch.invoiceCode ?? undefined;
  if (patch.observation !== undefined)
    next.observation = patch.observation ?? undefined;
  if (patch.eventId !== undefined) next.eventId = patch.eventId ?? undefined;
  if (patch.components !== undefined)
    next.components = patch.components ?? undefined;
  if (patch.deletedAt !== undefined)
    next.deletedAt = patch.deletedAt ?? undefined;
  return next;
}

/**
 * L'opération à mettre en file pour une modification locale, ou `null` si rien
 * de ce que le serveur connaît n'a changé (un pointage local seul, un
 * enregistrement sans modification). `expectedVersion` est la version VUE avant
 * la modification : la RPC refusera (40001) si le serveur a bougé depuis.
 */
export function entryUpdateOp(
  before: JournalEntry,
  after: JournalEntry
): EntryUpdateOp | null {
  const patch = entryPatchBetween(before, after);
  if (isEmptyPatch(patch)) return null;
  return {
    kind: 'entry.update',
    id: after.id,
    label: after.label,
    expectedVersion: before.version,
    patch,
  };
}

// ── Les deux refus que la récupération sait traiter ──────────────────

/**
 * `conflict` : l'écriture a changé sur le serveur depuis la version vue (40001).
 * `forbidden` : elle est invisible, ou hors des droits de l'appelant (42501).
 */
export type EntryRejection = 'conflict' | 'forbidden';

const SQLSTATE: Record<EntryRejection, string> = {
  conflict: '40001',
  forbidden: '42501',
};

/** La raison d'un refus d'après le SQLSTATE rendu par PostgREST. */
export function entryRejectionFromCode(
  code: string | undefined
): EntryRejection | null {
  if (code === SQLSTATE.conflict) return 'conflict';
  if (code === SQLSTATE.forbidden) return 'forbidden';
  return null;
}

/**
 * Refus DÉFINITIF d'une modification : la file ne le rejoue pas (cf.
 * `syncQueue.ts`), il attend une décision. Le SQLSTATE entre en tête du
 * message, parce que le message est TOUT ce qui survit d'une erreur dans une
 * lettre morte persistée (`lastError`) : c'est lui que relit
 * `entryRejectionOf` après un rechargement.
 */
export class EntryWriteRejected extends Error {
  readonly reason: EntryRejection;

  constructor(reason: EntryRejection, serverMessage: string) {
    super(`[${SQLSTATE[reason]}] ${serverMessage}`);
    this.name = 'EntryWriteRejected';
    this.reason = reason;
  }
}

/** La raison d'un refus, relue dans le `lastError` d'une lettre morte. */
export function entryRejectionOf(
  lastError: string | undefined
): EntryRejection | null {
  const match = /^\[(\d{5})\]/.exec(lastError ?? '');
  return entryRejectionFromCode(match?.[1]);
}
