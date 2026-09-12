/**
 * Le bilan de saison en PDF — un FICHIER, pas un dialogue d'impression.
 *
 * CE QUE CE MODULE RÉPARE. Le README annonçait des « exports PDF » ; il n'y en
 * avait pas. Le bouton « PDF » de l'écran Bilan appelait `window.print()` : sur
 * un ordinateur, cela ouvre un dialogue où il faut penser à choisir
 * « Enregistrer au format PDF » ; sur un téléphone — le seul appareil que le
 * trésorier a en main pendant l'assemblée générale — cela ouvre l'aperçu
 * d'impression du navigateur, d'où l'on ne sort avec un fichier joignable à un
 * courriel que par un chemin différent sur chaque plateforme. D'où ce module :
 * des octets PDF, un nom de fichier, et la feuille de partage du système.
 *
 * L'IMPRESSION RESTE. Elle sert à autre chose (imprimer l'écran tel qu'il est,
 * avec sa mise en page @media print) et n'a pas été retirée.
 *
 * GÉNÉRATEUR : `@mister-guiiug/dev-pwa-config/pdf`, zéro dépendance — aucun
 * kilo-octet de librairie PDF n'entre dans le bundle. Le motif (transcription
 * Latin-1, découpe des lignes, pagination A4) est repris de
 * `miss-contraction/src/midwifePdf.ts`, la seule application du parc qui s'en
 * servait.
 *
 * LANGUE : libellés en français, comme les autres exports du club (CSV, XLSX,
 * attestation). Un bilan d'AG est une pièce administrative française ; l'app
 * peut basculer en anglais, pas le document remis au bureau.
 */

import { dateSlug } from '@mister-guiiug/dev-pwa-config/download';
import {
  PAGE,
  PdfContent,
  buildPdf,
  downloadPdf,
  textWidth,
} from '@mister-guiiug/dev-pwa-config/pdf';
import type { ShareData } from '@mister-guiiug/dev-pwa-config/share';
import { shareOrCopy } from '@mister-guiiug/dev-pwa-config/share';
import type { Bilan, BilanLine, EventResult } from '../../shared/lib/engine.ts';

/**
 * Transcriptions Latin-1 des caractères hors WinAnsi que ce bilan produit.
 *
 * Le générateur encode en WinAnsi et remplace par « ? » tout ce qu'il ne sait
 * pas placer. Les accents français n'ont pas besoin de la table (Latin-1 les
 * porte) ; ce qui l'exige vient des SAISIES LIBRES — nom du club, nom d'un
 * événement, nom du trésorier — où l'on trouve apostrophes typographiques,
 * tirets cadratins, ligatures, et le signe moins U+2212 de la convention
 * comptable de l'app si quelqu'un le recopie. Sans cette table, « −44,00 » se
 * lirait « ?44,00 ».
 *
 * L'euro est transcrit « EUR » alors que WinAnsi le connaît (0x80) : le
 * caractère est hors Latin-1, donc illisible dans un test qui relit les octets,
 * et « EUR » est ce que fait déjà `miss-contraction`.
 */
const PDF_CHAR_MAP: Readonly<Record<string, string>> = {
  '−': '-', // U+2212, signe moins de `formatSignedEuro`
  '—': '-',
  '–': '-',
  '’': "'",
  '“': '"',
  '”': '"',
  '…': '...',
  '•': '-',
  œ: 'oe',
  Œ: 'OE',
  '€': 'EUR',
};

/**
 * Les espaces exotiques ramenés à l'espace simple, par CATÉGORIE Unicode
 * plutôt qu'un par un : `Intl` en français sépare les milliers par une espace
 * fine insécable (U+202F) ou insécable (U+00A0) selon la version d'ICU, et un
 * copier-coller en apporte d'autres. Une liste nominative les aurait ratées,
 * et l'espace fine insécable est INVISIBLE dans le code source — donc
 * indébogable à l'œil.
 */
const UNICODE_SPACES = /\p{Zs}/u;

/**
 * Rend une ligne sûre pour l'encodage WinAnsi : Latin-1 conservé, caractères
 * connus transcrits, le reste omis. Un nom de club ou d'événement est saisi
 * librement — il peut contenir n'importe quoi, émoji compris — et un « ? » au
 * milieu d'un bilan d'AG fait plus de dégâts qu'un caractère manquant.
 */
export function toPdfText(text: string): string {
  let out = '';
  for (const ch of text) {
    const mapped = PDF_CHAR_MAP[ch];
    if (mapped != null) {
      out += mapped;
      continue;
    }
    if (UNICODE_SPACES.test(ch)) {
      out += ' ';
      continue;
    }
    if ((ch.codePointAt(0) ?? 0) <= 0xff) out += ch;
  }
  return out;
}

export interface BilanPdfInput {
  clubName: string;
  /** Trésorier du club, s'il est renseigné (réglages) : signataire du bilan. */
  treasurer?: string;
  bilan: Bilan;
  events: EventResult[];
  /** Masquer les catégories compensées (réglage d'affichage du club). */
  hideCompensated?: boolean;
  /** Date de génération — injectable pour que le test soit reproductible. */
  generatedAt?: Date | number;
}

/** Montant du bilan : deux décimales, séparateur français, unité explicite. */
function euro(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} EUR`;
}

/** Montant signé (résultats, soldes) : le « + » d'un excédent est une information. */
function signedEuro(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${euro(Math.abs(value))}`;
}

/** Les lignes retenues : celles qui portent une écriture ou un montant. */
function shownLines(lines: BilanLine[], hideCompensated: boolean): BilanLine[] {
  return lines.filter(
    l =>
      (l.count > 0 || l.total !== 0) &&
      (!hideCompensated || l.kind !== 'compensee')
  );
}

/** Une ligne du document : un libellé, éventuellement un montant à droite. */
export interface PdfRow {
  label: string;
  value?: string;
  /** Titre de section (gras, précédé d'un filet) ou total (gras). */
  style?: 'title' | 'total' | 'muted';
}

/**
 * LA fonction pure : mêmes données → mêmes lignes. Le test lit ceci, et le
 * PDF n'est que sa mise en page — ce qui évite d'avoir à parser un binaire
 * pour savoir ce qu'on a écrit (le test le fait quand même une fois, sur le
 * fichier réel, parce que c'est le fichier qui part au bureau).
 */
export function buildBilanPdfRows(input: BilanPdfInput): PdfRow[] {
  const { bilan, events } = input;
  const hide = input.hideCompensated ?? false;
  const rows: PdfRow[] = [];

  rows.push({ label: 'Trésorerie', style: 'title' });
  rows.push({
    label: "Reliquat d'ouverture",
    value: euro(bilan.reliquat),
  });
  rows.push({ label: 'Trésorerie de clôture', value: euro(bilan.tresorerie) });
  rows.push({ label: '' });

  rows.push({ label: 'Recettes', style: 'title' });
  const recettes = shownLines(bilan.recettes, hide);
  if (recettes.length === 0)
    rows.push({ label: 'Aucune écriture.', style: 'muted' });
  for (const l of recettes) {
    rows.push({ label: `${l.code} ${l.label}`, value: euro(l.total) });
  }
  rows.push({
    label: 'Total recettes (hors reliquat)',
    value: euro(bilan.totalRecettesHorsReliquat),
    style: 'total',
  });
  rows.push({
    label: 'Total recettes (reliquat inclus)',
    value: euro(bilan.totalRecettes),
    style: 'total',
  });
  rows.push({ label: '' });

  rows.push({ label: 'Dépenses', style: 'title' });
  const depenses = shownLines(bilan.depenses, hide);
  if (depenses.length === 0)
    rows.push({ label: 'Aucune écriture.', style: 'muted' });
  for (const l of depenses) {
    rows.push({ label: `${l.code} ${l.label}`, value: euro(l.total) });
  }
  rows.push({
    label: 'Total dépenses',
    value: euro(bilan.totalDepenses),
    style: 'total',
  });
  rows.push({ label: '' });

  rows.push({ label: 'Résultat de la saison', style: 'title' });
  rows.push({
    label: 'Solde créditeur',
    value: signedEuro(bilan.soldeCrediteur),
    style: 'total',
  });
  rows.push({
    label: "Résultat d'exploitation",
    value: signedEuro(bilan.resultatExploitation),
    style: 'total',
  });

  if (events.length > 0) {
    rows.push({ label: '' });
    rows.push({ label: 'Résultat par événement', style: 'title' });
    for (const ev of events) {
      rows.push({
        label: `${ev.event.name} (+${euro(ev.recettes)} / -${euro(ev.depenses)})`,
        value: signedEuro(ev.net),
      });
    }
  }

  if (input.treasurer) {
    rows.push({ label: '' });
    rows.push({ label: `Trésorier : ${input.treasurer}`, style: 'muted' });
  }

  return rows.map(r => ({
    ...r,
    label: toPdfText(r.label),
    ...(r.value == null ? {} : { value: toPdfText(r.value) }),
  }));
}

const MARGIN_X = 48;
const MARGIN_TOP = 64;
const MARGIN_BOTTOM = 52;
const TITLE_SIZE = 16;
const META_SIZE = 9;
const SECTION_SIZE = 11;
const BODY_SIZE = 10;
const LEADING = 15;
/** Réserve à droite pour la colonne des montants, alignés sur la marge. */
const VALUE_COLUMN = 130;

/** Coupe un libellé trop large pour la colonne de gauche. */
function wrapPdfLine(text: string, size: number, maxWidth: number): string[] {
  if (textWidth(text, size) <= maxWidth) return [text];
  const out: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (current !== '' && textWidth(candidate, size) > maxWidth) {
      out.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current !== '') out.push(current);
  return out;
}

/** Date de génération, en toutes lettres approximatives et sûres en WinAnsi. */
function generatedLabel(at: Date | number | undefined): string {
  const d = at == null ? new Date() : new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Met en page le bilan sur autant de pages A4 que nécessaire. */
export function renderBilanPdf(input: BilanPdfInput): Uint8Array {
  const rows = buildBilanPdfRows(input);
  const right = PAGE.w - MARGIN_X;
  const labelWidth = right - MARGIN_X - VALUE_COLUMN;

  const pages: PdfContent[] = [];
  let page = new PdfContent();
  pages.push(page);
  let y = MARGIN_TOP;

  page.text(MARGIN_X, y, TITLE_SIZE, toPdfText(input.clubName), { bold: true });
  y += 18;
  page.text(
    MARGIN_X,
    y,
    META_SIZE,
    toPdfText(
      `Bilan de la saison ${input.bilan.season.label} - édité le ${generatedLabel(input.generatedAt)}`
    ),
    { color: [0.4, 0.4, 0.4] }
  );
  y += 8;
  page.line(MARGIN_X, y, right, y, 0.8, 0.75);
  y += 22;

  for (const row of rows) {
    if (row.label === '') {
      y += LEADING / 2;
      continue;
    }
    const size = row.style === 'title' ? SECTION_SIZE : BODY_SIZE;
    const bold = row.style === 'title' || row.style === 'total';
    const color: [number, number, number] | undefined =
      row.style === 'muted' ? [0.4, 0.4, 0.4] : undefined;

    for (const [i, chunk] of wrapPdfLine(
      row.label,
      size,
      row.value == null ? right - MARGIN_X : labelWidth
    ).entries()) {
      if (y > PAGE.h - MARGIN_BOTTOM) {
        page = new PdfContent();
        pages.push(page);
        y = MARGIN_TOP;
      }
      page.text(MARGIN_X, y, size, chunk, {
        bold,
        ...(color ? { color } : {}),
      });
      // Le montant est posé sur la PREMIÈRE ligne du libellé : sur un libellé
      // replié, l'aligner sur la dernière le décrocherait de son intitulé.
      if (i === 0 && row.value != null) {
        page.text(right - textWidth(row.value, size), y, size, row.value, {
          bold,
        });
      }
      y += LEADING;
    }
  }

  return buildPdf(pages);
}

/** `bilan-2025-2026-AAAA-MM-JJ.pdf` — la saison, puis le jour d'édition. */
export function bilanPdfFilename(input: BilanPdfInput): string {
  const season = input.bilan.season.label.replace(/[^\w-]+/g, '-');
  return `bilan-${season}-${dateSlug(input.generatedAt)}.pdf`;
}

export type BilanPdfOutcome = 'shared' | 'cancelled' | 'downloaded' | 'failed';

/**
 * Partage le bilan en PDF ; à défaut, le télécharge.
 *
 * `shareOrCopy` du socle passe son argument TEL QUEL à `navigator.share` — son
 * type `ShareData` (titre/texte/URL) est simplement antérieur au partage de
 * fichiers, d'où l'intersection ci-dessous plutôt qu'une conversion forcée.
 * Ce qu'on lui doit vraiment est ailleurs : il distingue l'annulation d'un
 * échec, et une annulation ne doit RIEN déclencher — surtout pas un
 * téléchargement dont personne n'a voulu.
 *
 * `canShare` est EXIGÉ, pas seulement consulté : sans lui, impossible de
 * savoir si la plateforme accepte les fichiers, et `navigator.share({files})`
 * y lèverait — `shareOrCopy` copierait alors le texte dans le presse-papiers,
 * ce qui n'est pas ce que le trésorier a demandé. Tous les navigateurs qui
 * partagent des fichiers exposent `canShare`.
 */
export async function shareOrDownloadBilanPdf(
  input: BilanPdfInput
): Promise<BilanPdfOutcome> {
  const bytes = renderBilanPdf(input);
  const filename = bilanPdfFilename(input);
  const title = `Bilan ${input.bilan.season.label} - ${input.clubName}`;

  const nav = globalThis.navigator as
    (Navigator & { canShare?: (data?: unknown) => boolean }) | undefined;

  if (typeof nav?.share === 'function' && typeof File === 'function') {
    const file = new File([bytes as BlobPart], filename, {
      type: 'application/pdf',
    });
    if (nav.canShare?.({ files: [file] })) {
      const payload: ShareData & { files: File[] } = { title, files: [file] };
      const result = await shareOrCopy(payload);
      if (result === 'shared' || result === 'cancelled') return result;
    }
  }

  return downloadPdf(bytes, filename) ? 'downloaded' : 'failed';
}
