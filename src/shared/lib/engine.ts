/**
 * Moteur comptable — pur, sans effet de bord, entièrement testé.
 *
 * Conventions :
 *  - une écriture crédit augmente le solde, une écriture débit le diminue ;
 *  - le solde courant repart du reliquat d'ouverture (règle 4) ;
 *  - le total d'une catégorie est orienté selon son sens (une recette compte en
 *    positif les crédits nets, une dépense compte en positif les débits nets) ;
 *  - solde créditeur = total recettes (reliquat inclus) − total dépenses (règle 6).
 *    On démontre qu'il est égal à la trésorerie de clôture (reliquat + Σ signés) :
 *    les deux mesures coïncident, les écritures compensées s'annulant des deux côtés.
 *  - le résultat d'exploitation exclut compensées / régularisations / transferts.
 */
import type {
  Category,
  EventLedger,
  JournalEntry,
  Sens,
  Season,
} from '../types/domain.ts';
import { allCategories, categoryByCode } from './categories.ts';

/** Arrondi monétaire à 2 décimales, robuste aux flottants. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Montant signé d'une écriture : crédit positif, débit négatif. */
export function signedAmount(e: JournalEntry): number {
  return e.sens === 'credit' ? e.amount : -e.amount;
}

/** Écriture active = non supprimée logiquement. */
export function isActive(e: JournalEntry): boolean {
  return !e.deletedAt;
}

/** Tri stable : date croissante puis ordre de création. */
export function sortEntries(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.createdAt - b.createdAt;
  });
}

export interface RunningRow {
  entry: JournalEntry;
  solde: number;
}

/** Solde courant après chaque écriture, en partant du reliquat (règle 4). */
export function runningBalances(
  entries: JournalEntry[],
  opening: number
): RunningRow[] {
  const sorted = sortEntries(entries.filter(isActive));
  let solde = round2(opening);
  return sorted.map(entry => {
    solde = round2(solde + signedAmount(entry));
    return { entry, solde };
  });
}

/** Trésorerie de clôture = reliquat + somme des montants signés actifs. */
export function treasury(entries: JournalEntry[], opening: number): number {
  const total = entries
    .filter(isActive)
    .reduce((s, e) => s + signedAmount(e), 0);
  return round2(opening + total);
}

/**
 * Total net d'une catégorie, orienté selon son sens (toujours ≥ 0 en usage
 * normal). Pour une recette : crédits − débits ; pour une dépense : débits −
 * crédits. Une correction inverse peut donc rendre le net négatif (visible).
 */
export function categoryNet(
  code: string,
  entries: JournalEntry[],
  categories: Category[] = allCategories()
): number {
  const cat = categories.find(c => c.code === code) ?? categoryByCode(code);
  const signed = entries
    .filter(e => isActive(e) && e.categoryCode === code)
    .reduce((s, e) => s + signedAmount(e), 0);
  return round2(cat?.sens === 'depense' ? -signed : signed);
}

export interface BilanLine {
  code: string;
  label: string;
  sens: Sens;
  kind: Category['kind'];
  total: number;
  count: number;
  /** « à compléter » si la catégorie n'a aucune écriture (règle 12). */
  status: 'complete' | 'a_completer';
}

function lineFor(cat: Category, entries: JournalEntry[]): BilanLine {
  const own = entries.filter(e => isActive(e) && e.categoryCode === cat.code);
  return {
    code: cat.code,
    label: cat.label,
    sens: cat.sens,
    kind: cat.kind,
    total: categoryNet(cat.code, entries),
    count: own.length,
    status: own.length > 0 ? 'complete' : 'a_completer',
  };
}

export interface Bilan {
  season: Season;
  recettes: BilanLine[];
  depenses: BilanLine[];
  reliquat: number;
  totalRecettesHorsReliquat: number;
  /** Total recettes reliquat inclus (présentation « bilan » du club). */
  totalRecettes: number;
  totalDepenses: number;
  /** Solde créditeur = total recettes − total dépenses (règle 6). */
  soldeCrediteur: number;
  /** Résultat d'exploitation : hors compensées / régularisations / transferts. */
  resultatExploitation: number;
  /** Trésorerie de clôture (reliquat + Σ signés) — candidat au report (règle 7). */
  tresorerie: number;
  compensated: { recettes: number; depenses: number };
}

const EXPLOITATION = new Set<Category['kind']>(['exploitation']);

/** Agrège le bilan d'une saison (règle 5). */
export function computeBilan(
  season: Season,
  allEntries: JournalEntry[],
  categories: Category[] = allCategories()
): Bilan {
  const entries = allEntries.filter(
    e => e.seasonId === season.id && isActive(e)
  );
  const recettes = categories
    .filter(c => c.sens === 'recette')
    .map(c => lineFor(c, entries));
  const depenses = categories
    .filter(c => c.sens === 'depense')
    .map(c => lineFor(c, entries));

  const sumLines = (lines: BilanLine[]) =>
    round2(lines.reduce((s, l) => s + l.total, 0));
  const sumKind = (
    lines: BilanLine[],
    keep: (k: Category['kind']) => boolean
  ) => round2(lines.filter(l => keep(l.kind)).reduce((s, l) => s + l.total, 0));

  const reliquat = round2(season.openingBalance);
  const totalRecettesHorsReliquat = sumLines(recettes);
  const totalRecettes = round2(reliquat + totalRecettesHorsReliquat);
  const totalDepenses = sumLines(depenses);
  const soldeCrediteur = round2(totalRecettes - totalDepenses);

  const recettesExpl = sumKind(recettes, k => EXPLOITATION.has(k));
  const depensesExpl = sumKind(depenses, k => EXPLOITATION.has(k));
  const resultatExploitation = round2(recettesExpl - depensesExpl);

  return {
    season,
    recettes,
    depenses,
    reliquat,
    totalRecettesHorsReliquat,
    totalRecettes,
    totalDepenses,
    soldeCrediteur,
    resultatExploitation,
    tresorerie: treasury(entries, reliquat),
    compensated: {
      recettes: sumKind(recettes, k => k === 'compensee'),
      depenses: sumKind(depenses, k => k === 'compensee'),
    },
  };
}

export interface EventResult {
  event: EventLedger;
  recettes: number;
  depenses: number;
  net: number;
  count: number;
}

/** Résultat net par événement (règle 10) : recettes − dépenses rattachées. */
export function eventResults(
  events: EventLedger[],
  allEntries: JournalEntry[]
): EventResult[] {
  return events.map(event => {
    const own = allEntries.filter(e => isActive(e) && e.eventId === event.id);
    const recettes = round2(
      own.filter(e => e.sens === 'credit').reduce((s, e) => s + e.amount, 0)
    );
    const depenses = round2(
      own.filter(e => e.sens === 'debit').reduce((s, e) => s + e.amount, 0)
    );
    return {
      event,
      recettes,
      depenses,
      net: round2(recettes - depenses),
      count: own.length,
    };
  });
}

export interface SeasonTotals {
  recettes: number;
  depenses: number;
  solde: number;
}

/**
 * Totaux d'une saison pour la synthèse d'évolution : utilise `season.summary`
 * (saisons historiques sans journal détaillé) sinon agrège depuis les écritures.
 * `recettes` inclut le reliquat (présentation « bilan ») ; `solde = recettes −
 * dépenses`.
 */
export function seasonTotals(
  season: Season,
  allEntries: JournalEntry[]
): SeasonTotals {
  if (season.summary) {
    const recettes = round2(season.summary.totalRecettes);
    const depenses = round2(season.summary.totalDepenses);
    return { recettes, depenses, solde: round2(recettes - depenses) };
  }
  const b = computeBilan(season, allEntries);
  return {
    recettes: b.totalRecettes,
    depenses: b.totalDepenses,
    solde: b.soldeCrediteur,
  };
}

/** Valide la cohérence des composantes : somme = montant (tolérance 1 cent). */
export function componentsMatchAmount(entry: JournalEntry): boolean {
  if (!entry.components) return true;
  const sum = Object.values(entry.components).reduce((s, v) => s + (v || 0), 0);
  return Math.abs(round2(sum) - round2(entry.amount)) <= 0.01;
}
