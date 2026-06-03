import type { EntryInput } from '../../store/useAppStore.ts';
import type { ParsedEntry } from './compteMapping.ts';

/** Transforme les écritures parsées en `EntryInput` pour une saison donnée. */
export function buildEntryInputs(
  parsed: ParsedEntry[],
  seasonId: string
): EntryInput[] {
  return parsed.map(p => ({
    seasonId,
    categoryCode: p.categoryCode,
    date: p.date,
    label: p.label,
    sens: p.sens,
    amount: p.amount,
    method: p.method,
    pieceRef: p.pieceRef,
    invoiceCode: p.invoiceCode,
    observation: p.observation,
  }));
}
