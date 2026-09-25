/**
 * Lecture d'un justificatif — ticket, facture, reçu — par l'IA « apportez
 * votre clé » déjà configurée pour les exercices (Réglages → Génération IA).
 * Le résultat PRÉ-REMPLIT le formulaire d'écriture : rien n'est jamais
 * enregistré sans que l'utilisateur valide.
 *
 * LA CHAÎNE. Photo → réduite et ré-encodée par le module `image` du socle, ce
 * qui la débarrasse de ses métadonnées (lieu, appareil) avant qu'elle quitte
 * l'appareil → base64 → modèle de vision du fournisseur : bloc `image` chez
 * Anthropic, `image_url` en data URL chez un compatible OpenAI → JSON strict →
 * lecture DÉFENSIVE : bloc de code, « 12,50 € », « 25/09/2026 », champs
 * manquants. Un PDF part tel quel, et seulement chez Anthropic, seul à le lire
 * ici.
 *
 * CHARGÉ À LA DEMANDE (import dynamique depuis le formulaire) : ni ce module ni
 * le traitement d'image n'entrent dans le premier chargement.
 */
import {
  compressImageToMaxBytes,
  type ImageSeams,
} from '@mister-guiiug/dev-pwa-config/image';
import type {
  AiSettings,
  Category,
  EntrySens,
} from '../../shared/types/domain.ts';
import {
  AiError,
  buildAiRequest,
  callAi,
  extractJson,
  type AiPart,
  type AiPrompt,
  type AiRequest,
} from '../../shared/lib/aiClient.ts';
import { round2 } from '../../shared/lib/engine.ts';
import { ReceiptError, isPdfFile, type ReceiptDraft } from './receipt.ts';

/**
 * Côté long visé. Anthropic réduit toute image au-delà de 1 568 px sans rien
 * gagner à la lecture ; OpenAI la ramène de toute façon plus bas. Envoyer plus
 * grand coûterait du réseau mobile pour rien.
 */
export const OCR_MAX_DIMENSION = 1568;

/**
 * Budget d'une image envoyée : 1,5 Mo, soit 2 Mo en base64 — loin des
 * plafonds des fournisseurs (5 Mo chez Anthropic), et raisonnable en 4G. Un
 * ticket à 1 568 px tient sous 600 Ko à la première qualité essayée.
 */
export const OCR_IMAGE_MAX_BYTES = 1.5 * 1024 * 1024;

/** Un PDF part tel quel : au-delà, mieux vaut ne garder que la page utile. */
export const OCR_PDF_MAX_BYTES = 5 * 1024 * 1024;

/** Au-delà, une photo n'est même pas décodée : la mémoire d'un téléphone. */
export const OCR_SOURCE_MAX_BYTES = 30 * 1024 * 1024;

/** La réponse attendue est un petit objet JSON. */
const MAX_TOKENS = 1024;

/** Ce que le modèle reçoit : une image réduite, ou un PDF tel quel. */
export type ReceiptFile =
  | { kind: 'image'; mediaType: string; data: string }
  | { kind: 'pdf'; data: string };

// ── Le prompt ────────────────────────────────────────────────────────

/**
 * Le contrat de sortie, et la liste FERMÉE des catégories de l'app (taxonomie
 * et catégories personnalisées) : le modèle choisit, il n'invente pas.
 */
export function buildReceiptSystemPrompt(
  categories: readonly Category[]
): string {
  const list = categories
    .map(
      c =>
        `${c.code} — ${c.label} (${c.sens === 'recette' ? 'recette' : 'dépense'})`
    )
    .join('\n');
  return [
    "Tu lis des justificatifs comptables (ticket de caisse, facture, reçu, note de frais) pour la trésorerie d'un club associatif de hockey subaquatique.",
    'Réponds STRICTEMENT et UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans bloc Markdown. Schéma : {"date":"AAAA-MM-JJ"|null,"amount":number|null,"label":string|null,"sens":"debit"|"credit"|null,"categoryCode":string|null,"confidence":number}.',
    '- "date" : la date du paiement ou de la facture, au format AAAA-MM-JJ.',
    '- "amount" : le montant TOTAL payé, toutes taxes comprises, positif, en euros, avec un point décimal (ex. 12.5).',
    '- "label" : un libellé court — le fournisseur et l\'objet (ex. « Decathlon — palmes »), 80 caractères au plus.',
    '- "sens" : "debit" si le club paie (achat, facture reçue), "credit" s\'il encaisse (reçu de don, facture émise par le club).',
    `- "categoryCode" : le code de la catégorie la plus probable, choisi EXCLUSIVEMENT dans cette liste, ou null :\n${list}`,
    '- "confidence" : ta confiance globale dans la lecture, entre 0 et 1.',
    "Si une information est illisible ou absente, mets null. N'invente rien.",
  ].join('\n');
}

const INSTRUCTION = 'Lis ce justificatif et réponds avec le JSON demandé.';

/** Le justificatif D'ABORD, la consigne ensuite : l'ordre que recommande Anthropic. */
export function receiptParts(file: ReceiptFile): AiPart[] {
  const document: AiPart =
    file.kind === 'pdf'
      ? { type: 'pdf', data: file.data }
      : { type: 'image', mediaType: file.mediaType, data: file.data };
  return [document, { type: 'text', text: INSTRUCTION }];
}

export function receiptPrompt(
  file: ReceiptFile,
  categories: readonly Category[]
): AiPrompt {
  return {
    system: buildReceiptSystemPrompt(categories),
    user: receiptParts(file),
    maxTokens: MAX_TOKENS,
  };
}

/** La requête HTTP de lecture, pour le fournisseur configuré. Pure. */
export function buildReceiptRequest(
  ai: AiSettings,
  file: ReceiptFile,
  categories: readonly Category[]
): AiRequest {
  return buildAiRequest(ai, receiptPrompt(file, categories));
}

// ── La lecture défensive de la réponse ───────────────────────────────

/**
 * Un montant, tel qu'un modèle ou un ticket l'écrit : `12.5`, « 12,50 € »,
 * « 1 234,56 », « 1.234,56 », « 1,234.56 », « EUR 45 ». Le DERNIER séparateur
 * rencontré est la décimale quand il y en a deux sortes. Seul, il l'est aussi —
 * sauf suivi d'exactement trois chiffres (« 1.234 ») : un montant en euros n'a
 * jamais trois décimales, c'est un séparateur de milliers. Toujours positif
 * (le sens dit s'il s'agit d'une dépense), au centime.
 */
export function parseAmount(value: unknown): number | undefined {
  if (typeof value === 'number')
    return Number.isFinite(value) && value !== 0
      ? round2(Math.abs(value))
      : undefined;
  if (typeof value !== 'string') return undefined;
  const s = value.replace(/[^\d.,]/g, '');
  if (!/\d/.test(s)) return undefined;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? ',' : '.';
    const thousands = decimal === ',' ? '.' : ',';
    normalized = s.split(thousands).join('').replace(decimal, '.');
  } else if (lastComma >= 0 || lastDot >= 0) {
    const parts = s.split(lastComma >= 0 ? ',' : '.');
    const thousands =
      parts.length > 2 || (parts.length === 2 && parts[1]!.length === 3);
    normalized = thousands ? parts.join('') : parts.join('.');
  } else {
    normalized = s;
  }
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? round2(n) : undefined;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Une date, au format demandé (`2026-09-25`, avec ou sans heure) ou à la
 * française (« 25/09/2026 », « 25.09.26 », « 25-09-2026 »). JOUR/MOIS, jamais
 * mois/jour : un justificatif de club français. Une date qui n'existe pas au
 * calendrier (« 31/02 ») est écartée plutôt que glissée au mois suivant.
 */
export function parseReceiptDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const s = value.trim();
  let y: number;
  let m: number;
  let d: number;
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:$|[T\s])/.exec(s);
  const fr = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})$/.exec(s);
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else if (fr) {
    d = Number(fr[1]);
    m = Number(fr[2]);
    y = Number(fr[3]!.length === 2 ? `20${fr[3]}` : fr[3]);
  } else {
    return undefined;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  )
    return undefined;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Minuscule et sans accents : « Dépense » et « depense » se valent. */
function plain(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

function parseSens(value: unknown): EntrySens | undefined {
  if (typeof value !== 'string') return undefined;
  const v = plain(value);
  if (['debit', 'depense', 'expense', 'sortie'].includes(v)) return 'debit';
  if (['credit', 'recette', 'income', 'entree'].includes(v)) return 'credit';
  return undefined;
}

/** Un code de l'app, même écrit « d8 » ou « D8 — Frais de bouche ». */
function parseCategory(
  value: unknown,
  categories: readonly Category[]
): Category | undefined {
  if (typeof value !== 'string') return undefined;
  const code = /^\s*([A-Za-z0-9-]+)/.exec(value)?.[1]?.toUpperCase();
  return categories.find(c => c.code.toUpperCase() === code);
}

/** Entre 0 et 1 ; un pourcentage (« 85 ») est ramené à 0,85. */
function parseConfidence(value: unknown): number | undefined {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace('%', '').replace(',', '.').trim())
        : Number.NaN;
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.min(1, n > 1 ? n / 100 : n);
}

function parseLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const label = value.replace(/\s+/g, ' ').trim().slice(0, 120);
  return label || undefined;
}

/**
 * La réponse du modèle, lue défensivement : un objet JSON au besoin extrait
 * d'un bloc de code, des clés françaises tolérées, chaque champ vérifié. Une
 * catégorie inconnue, ou qui contredit le sens lu, est écartée : l'utilisateur
 * la choisira. Rien de lisible du tout — ni date, ni montant, ni libellé —
 * est une erreur, pas un formulaire vide.
 */
export function parseReceipt(
  text: string,
  categories: readonly Category[]
): ReceiptDraft {
  const parsed = extractJson(text);
  const raw = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!raw || typeof raw !== 'object')
    throw new AiError(
      'unreadable',
      'Réponse IA illisible (objet JSON attendu).'
    );
  const r = raw as Record<string, unknown>;
  const first = (...keys: string[]) =>
    keys.map(k => r[k]).find(v => v !== undefined && v !== null && v !== '');

  const date = parseReceiptDate(first('date'));
  const amount = parseAmount(first('amount', 'montant', 'total'));
  const label = parseLabel(first('label', 'libelle', 'libellé'));
  const readSens = parseSens(first('sens', 'direction'));
  const category = parseCategory(
    first(
      'categoryCode',
      'category_code',
      'categorie',
      'catégorie',
      'category'
    ),
    categories
  );
  const categorySens: EntrySens | undefined = category
    ? category.sens === 'depense'
      ? 'debit'
      : 'credit'
    : undefined;
  const categoryCode =
    category && (!readSens || readSens === categorySens)
      ? category.code
      : undefined;
  const sens = readSens ?? categorySens;
  const confidence = parseConfidence(first('confidence', 'confiance'));

  if (date === undefined && amount === undefined && label === undefined)
    throw new ReceiptError('empty', 'Rien de lisible sur ce justificatif.');

  return {
    ...(date !== undefined ? { date } : {}),
    ...(amount !== undefined ? { amount } : {}),
    ...(label !== undefined ? { label } : {}),
    ...(sens !== undefined ? { sens } : {}),
    ...(categoryCode !== undefined ? { categoryCode } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
  };
}

// ── Préparation du fichier, et lecture ───────────────────────────────

/** Le contenu d'un fichier en base64, sans le préfixe `data:`. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      resolve(url.slice(url.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Le fichier tel qu'il partira. `seams` : les coutures du module `image` du
 * socle, fournies par les tests seuls (pas de canvas sous jsdom). Une image est TOUJOURS ré-encodée par
 * `compressImageToMaxBytes`, qui enchaîne la géométrie de `fitWithin` (jamais
 * agrandie, rapport conservé) et le passage par canvas de `stripImageMetadata` :
 * EXIF, GPS et numéro de série disparaissent par construction. Un seul
 * décodage — appeler `stripImageMetadata` d'abord décoderait deux fois pour le
 * même résultat.
 */
export async function prepareReceiptFile(
  file: File,
  seams?: ImageSeams
): Promise<ReceiptFile> {
  if (isPdfFile(file)) {
    if (file.size > OCR_PDF_MAX_BYTES)
      throw new ReceiptError('too-large', 'PDF trop lourd pour être lu.');
    return { kind: 'pdf', data: await blobToBase64(file) };
  }
  const image =
    file.type.startsWith('image/') ||
    /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(file.name);
  if (!image)
    throw new ReceiptError('unsupported-type', 'Format non pris en charge.');
  if (file.size > OCR_SOURCE_MAX_BYTES)
    throw new ReceiptError('too-large', 'Photo trop lourde pour être lue.');
  let reduced: File;
  try {
    reduced = await compressImageToMaxBytes(file, OCR_IMAGE_MAX_BYTES, {
      maxDimension: OCR_MAX_DIMENSION,
      ...seams,
    });
  } catch {
    throw new ReceiptError(
      'image-unreadable',
      'Impossible de lire cette image.'
    );
  }
  return {
    kind: 'image',
    mediaType: reduced.type || 'image/jpeg',
    data: await blobToBase64(reduced),
  };
}

/**
 * Lit un justificatif avec le fournisseur configuré. Un PDF chez un
 * fournisseur qui ne le lit pas est refusé AVANT toute préparation, et donc
 * avant tout envoi.
 */
export async function readReceipt(
  file: File,
  ai: AiSettings,
  categories: readonly Category[],
  options: { signal?: AbortSignal; seams?: ImageSeams } = {}
): Promise<ReceiptDraft> {
  if (isPdfFile(file) && ai.provider !== 'anthropic')
    throw new AiError(
      'pdf-unsupported',
      'Ce fournisseur ne lit pas les PDF : seul Claude (Anthropic) le fait ici.'
    );
  const prepared = await prepareReceiptFile(file, options.seams);
  const text = await callAi(
    ai,
    receiptPrompt(prepared, categories),
    options.signal
  );
  return parseReceipt(text, categories);
}
