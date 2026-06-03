/**
 * Rapprochement bancaire — appariement PUR (testable) entre les lignes d'un
 * relevé et les écritures du journal. Un relevé est apparié à une écriture non
 * encore pointée de MÊME montant signé (crédit + / débit −) et de date proche.
 *
 * Le parsing CSV (formats de banques variés) est heuristique et isolé ici aussi.
 */
import type { JournalEntry } from '../../shared/types/domain.ts';
import { isActive, round2, signedAmount } from '../../shared/lib/engine.ts';

/** Ligne de relevé : montant SIGNÉ (+ crédit, − débit). */
export interface BankLine {
  date: string;
  label: string;
  amount: number;
}

export interface BankMatch {
  entryId: string;
  bankIndex: number;
}

export interface MatchResult {
  matches: BankMatch[];
  unmatchedBank: number[];
}

function daysApart(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00`);
  const db = Date.parse(`${b}T00:00:00`);
  if (Number.isNaN(da) || Number.isNaN(db)) return Infinity;
  return Math.abs(da - db) / 86_400_000;
}

/** Apparie les lignes du relevé aux écritures actives non pointées. */
export function matchBankLines(
  bank: BankLine[],
  entries: JournalEntry[],
  windowDays = 5
): MatchResult {
  const used = new Set<string>();
  const candidates = entries.filter(e => isActive(e) && !e.reconciled);
  const matches: BankMatch[] = [];
  const unmatchedBank: number[] = [];

  bank.forEach((line, i) => {
    const target = candidates
      .filter(e => !used.has(e.id) && signedAmount(e) === round2(line.amount))
      .sort(
        (a, b) => daysApart(a.date, line.date) - daysApart(b.date, line.date)
      )[0];
    if (target && daysApart(target.date, line.date) <= windowDays) {
      used.add(target.id);
      matches.push({ entryId: target.id, bankIndex: i });
    } else {
      unmatchedBank.push(i);
    }
  });

  return { matches, unmatchedBank };
}

function toNumber(s: string): number {
  const n = Number(
    s
      .replace(/[^\d,.-]/g, '')
      .replace(/\s/g, '')
      .replace(',', '.')
  );
  return Number.isFinite(n) ? n : 0;
}

function toIso(s: string): string | undefined {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{2})[/.](\d{2})[/.](\d{4})/); // jj/mm/aaaa (FR)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return undefined;
}

/**
 * Parse un CSV de relevé bancaire (séparateur ; ou ,). Détecte les colonnes par
 * en-tête (date / libellé / montant ou débit+crédit). Renvoie des montants signés.
 */
export function parseBankCsv(text: string): BankLine[] {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const sep =
    (lines[0]!.match(/;/g)?.length ?? 0) >= (lines[0]!.match(/,/g)?.length ?? 0)
      ? ';'
      : ',';
  const split = (l: string) =>
    l.split(sep).map(c => c.replace(/^"|"$/g, '').trim());

  const header = split(lines[0]!).map(h => h.toLowerCase());
  const find = (...keys: string[]) =>
    header.findIndex(h => keys.some(k => h.includes(k)));
  const iDate = find('date');
  const iLabel = find('libell', 'label', 'nature', 'opération', 'operation');
  const iAmount = find('montant', 'amount');
  const iDebit = find('débit', 'debit');
  const iCredit = find('crédit', 'credit');
  const hasHeader = iDate >= 0 || iAmount >= 0 || iDebit >= 0;

  const out: BankLine[] = [];
  for (const raw of lines.slice(hasHeader ? 1 : 0)) {
    const c = split(raw);
    const date = toIso(c[iDate >= 0 ? iDate : 0] ?? '');
    if (!date) continue;
    const label = (c[iLabel >= 0 ? iLabel : 1] ?? '').trim();
    let amount = 0;
    if (iAmount >= 0) amount = toNumber(c[iAmount] ?? '');
    else {
      const debit = toNumber(c[iDebit >= 0 ? iDebit : 2] ?? '');
      const credit = toNumber(c[iCredit >= 0 ? iCredit : 3] ?? '');
      amount = credit - debit;
    }
    if (amount === 0) continue;
    out.push({ date, label, amount });
  }
  return out;
}
