/**
 * Ce que le formulaire d'écriture sait de la lecture des justificatifs SANS
 * charger le module qui lit (`receiptOcr.ts`, importé à la demande) : le
 * résultat attendu, ses erreurs, la reconnaissance d'un PDF, et l'accord donné
 * une fois pour l'envoi au fournisseur d'IA.
 */
import { readRaw, writeRaw } from '@mister-guiiug/dev-pwa-config/storage';
import type { AiSettings, EntrySens } from '../../shared/types/domain.ts';
import { AiError, aiHost, describeAiError } from '../../shared/lib/aiClient.ts';
import type { TKey, Translate } from '../../i18n/index.ts';

/**
 * Ce que l'IA propose pour une écriture. Tout est facultatif : un champ
 * illisible reste vide, et le formulaire garde alors ce qu'il avait.
 */
export interface ReceiptDraft {
  /** Date ISO `yyyy-mm-dd`. */
  date?: string;
  /** Montant TTC, positif, arrondi au centime. */
  amount?: number;
  label?: string;
  sens?: EntrySens;
  /** Un code de catégorie de l'app, cohérent avec `sens`. */
  categoryCode?: string;
  /** Confiance annoncée par le modèle, entre 0 et 1. */
  confidence?: number;
}

export type ReceiptErrorCode =
  'unsupported-type' | 'too-large' | 'image-unreadable' | 'empty';

/** Un justificatif que l'on ne peut pas lire — avant même d'appeler l'IA. */
export class ReceiptError extends Error {
  readonly code: ReceiptErrorCode;

  constructor(code: ReceiptErrorCode, message: string) {
    super(message);
    this.name = 'ReceiptError';
    this.code = code;
  }
}

/** Un PDF, au type déclaré ou, à défaut, à l'extension. */
export function isPdfFile(file: { type: string; name: string }): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

// ── L'accord, une fois par destinataire ──────────────────────────────

const NOTICE_KEY = 'miss-uwh:ocr-notice';

/**
 * À qui le justificatif part : le fournisseur ET l'hôte. Changer l'un ou
 * l'autre — passer d'Anthropic à OpenRouter, pointer un autre point d'accès —
 * redemande l'accord : l'utilisateur a accepté un destinataire, pas tous.
 */
function recipient(ai: AiSettings): string {
  return `${ai.provider}|${aiHost(ai)}`;
}

export function hasAcceptedNotice(ai: AiSettings): boolean {
  return readRaw(NOTICE_KEY) === recipient(ai);
}

/**
 * Retient l'accord sur CET appareil. Préférence d'appareil, pas donnée du club :
 * hors de la sauvegarde et de la synchronisation. Un stockage qui refuse
 * l'écriture ne bloque rien — l'accord sera simplement redemandé.
 */
export function acceptNotice(ai: AiSettings): void {
  writeRaw(NOTICE_KEY, recipient(ai));
}

// ── Les erreurs, traduites ───────────────────────────────────────────

const RECEIPT_ERROR_KEYS: Record<ReceiptErrorCode, TKey> = {
  'unsupported-type': 'finances.receipt.errors.unsupportedType',
  'too-large': 'finances.receipt.errors.tooLarge',
  'image-unreadable': 'finances.receipt.errors.imageUnreadable',
  empty: 'finances.receipt.errors.empty',
};

/** Le message traduit d'un échec de lecture, quelle qu'en soit l'origine. */
export function describeReceiptError(error: unknown, t: Translate): string {
  if (error instanceof ReceiptError) return t(RECEIPT_ERROR_KEYS[error.code]);
  // Un refus HTTP du fournisseur, ici, tient souvent au modèle : il doit
  // accepter les images.
  if (error instanceof AiError && error.code === 'http')
    return t('finances.receipt.errors.http', error.params);
  return describeAiError(error, t) ?? t('finances.receipt.errors.failed');
}
