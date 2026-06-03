/**
 * Migration depuis l'Excel — mapping PUR (testable sans dépendance) des lignes de
 * la feuille « Compte » (le journal) vers des écritures Miss UWH.
 *
 * Colonnes attendues (telles que dans le classeur du club) :
 *   0 ORDRE | 1 DATE | 2 LIBELLE | 3 CODE FACTURE | 4 MODE RGLT | 5 N° PIECE |
 *   6 DEBITS | 7 CREDIT | 8 SOLDE | 9 (vide) | 10 OBS.
 *
 * La catégorie est déduite du préfixe d'ORDRE (« R8 Divers 3 » → R8). La 1re
 * ligne « ANCIEN SOLDE » fournit le reliquat d'ouverture.
 */
import type { EntrySens, PaymentMethod } from '../../shared/types/domain.ts';

export interface ParsedEntry {
  date: string;
  label: string;
  categoryCode: string;
  sens: EntrySens;
  amount: number;
  method: PaymentMethod;
  pieceRef?: string;
  invoiceCode?: string;
  observation?: string;
}

export interface ParseResult {
  openingBalance: number;
  entries: ParsedEntry[];
  warnings: string[];
}

/** Préfixe d'ORDRE → code catégorie. D10–D13 testés AVANT D1–D9. */
const ORDER_RULES: Array<[RegExp, string]> = [
  [/^R1\b/i, 'R1'],
  [/^R2\b/i, 'R2'],
  [/^R3\b/i, 'R3'],
  [/^R4\b/i, 'R4'],
  [/^R5\b/i, 'R5'],
  [/^R6\b/i, 'R6'],
  [/^R7\b/i, 'R7'],
  [/^R8\b/i, 'R8'],
  [/^R9\b/i, 'R9'],
  [/^D10\b/i, 'D10'],
  [/^D11\b/i, 'D11'],
  [/^D12\b/i, 'D12'],
  [/^D13\b/i, 'D13'],
  [/^D1\b/i, 'D1'],
  [/^D2\b/i, 'D2'],
  [/^D3\b/i, 'D3'],
  [/^D4\b/i, 'D4'],
  [/^D5\b/i, 'D5'],
  [/^D6\b/i, 'D6'],
  [/^D7\b/i, 'D7'],
  [/^D8\b/i, 'D8'],
  [/^D9\b/i, 'D9'],
  [/^Formation\b/i, 'D11'],
  [/^Comm\b/i, 'D13'],
];

export function categoryFromOrder(ordre: string): string | undefined {
  const s = ordre.trim();
  for (const [re, code] of ORDER_RULES) if (re.test(s)) return code;
  return undefined;
}

const METHOD_RULES: Array<[RegExp, PaymentMethod]> = [
  [/prlv|prélèv|prelev/i, 'prelevement'],
  [/vrt|vir\b|virement/i, 'virement'],
  [/ch[eè]?q|chq/i, 'cheque'],
  [/helloasso/i, 'helloasso'],
  [/stripe/i, 'stripe'],
  [/sumup/i, 'sumup'],
  [/monetico|tpe|cb\b|carte/i, 'carte'],
  [/esp[eè]ces|cash/i, 'especes'],
];

export function methodFromLabel(raw: unknown): PaymentMethod {
  const s = String(raw ?? '').trim();
  if (!s) return 'autre';
  for (const [re, m] of METHOD_RULES) if (re.test(s)) return m;
  return 'autre';
}

/** Normalise une valeur de date (Date, ISO, ou « 2025-09-10 00:00:00 ») en ISO. */
export function toIsoDate(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value ?? '').trim();
  if (!s) return undefined;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const s = String(value ?? '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\s/g, '')
    .replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Mappe la matrice de la feuille « Compte ». `rows` = lignes (tableaux). */
export function mapCompteRows(rows: unknown[][]): ParseResult {
  const warnings: string[] = [];
  let openingBalance = 0;
  const entries: ParsedEntry[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const ordre = String(row[0] ?? '').trim();
    const label = String(row[2] ?? '').trim();

    // En-tête / lignes vides
    if (!ordre && !label) continue;
    if (/^ordre$/i.test(ordre)) continue;

    // Ligne d'ancien solde → reliquat d'ouverture
    if (/ancien solde/i.test(label) || /ancien solde/i.test(ordre)) {
      openingBalance = toNumber(row[7]) || toNumber(row[8]);
      continue;
    }

    const debit = toNumber(row[6]);
    const credit = toNumber(row[7]);
    if (debit === 0 && credit === 0) continue; // ligne réservée sans montant

    const categoryCode = categoryFromOrder(ordre);
    if (!categoryCode) {
      warnings.push(`Ligne ${i + 1} : catégorie inconnue pour « ${ordre} ».`);
      continue;
    }

    const date = toIsoDate(row[1]);
    if (!date) {
      warnings.push(`Ligne ${i + 1} : date illisible, ligne ignorée.`);
      continue;
    }

    const sens: EntrySens = credit > 0 ? 'credit' : 'debit';
    const amount = credit > 0 ? credit : debit;

    entries.push({
      date,
      label: label || ordre,
      categoryCode,
      sens,
      amount,
      method: methodFromLabel(row[4]),
      invoiceCode: String(row[3] ?? '').trim() || undefined,
      pieceRef: String(row[5] ?? '').trim() || undefined,
      observation: String(row[10] ?? '').trim() || undefined,
    });
  }

  return { openingBalance, entries, warnings };
}
