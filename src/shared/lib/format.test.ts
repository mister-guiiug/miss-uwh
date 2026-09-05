/**
 * Le formatage est ce que le trésorier LIT. Ces tests portent sur l'usage
 * (montants du journal, dates de l'audit), pas sur la mécanique `Intl` — celle-
 * là est éprouvée chez `dev-pwa-config/format`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { setDefaultLocale } from '@mister-guiiug/dev-pwa-config/format';
import {
  formatDateShort,
  formatDateTime,
  formatEuro,
  formatSignedEuro,
} from './format.ts';

// La locale par défaut du socle est un état de module, que `createI18n` déplace
// en vrai : chaque test repart du français, celui qu'un club voit par défaut.
beforeEach(() => setDefaultLocale('fr'));

/**
 * `Intl` sépare les milliers d'une espace FINE insécable (U+202F) et détache
 * l'euro d'une insécable (U+00A0). Invisibles dans un test : on les ramène à
 * l'espace ordinaire pour que l'attendu se lise. Un test dédié les épingle.
 */
const lisible = (value: string) => value.replace(/[\u202f\u00a0]/g, ' ');

/** 8 janvier 2026, 16 h 03 — heure LOCALE, donc sans dépendance au fuseau. */
const AUDIT_TS = new Date('2026-01-08T16:03:00').getTime();

describe('montants', () => {
  it('formate un montant en euros à la française', () => {
    expect(lisible(formatEuro(1234.5))).toBe('1 234,50 €');
    expect(lisible(formatEuro(2364.85))).toBe('2 364,85 €');
  });

  it('garde les espaces insécables du français (le montant ne se coupe pas)', () => {
    expect(formatEuro(1234.5)).toBe(`1\u202f234,50\u00a0€`);
  });

  it('honore le réglage `decimals` du club', () => {
    expect(lisible(formatEuro(28341.5, 0))).toBe('28 342 €');
    expect(lisible(formatEuro(14.6666, 3))).toBe('14,667 €');
  });

  it('applique la convention comptable du signe', () => {
    expect(lisible(formatSignedEuro(1219.36))).toBe('+1 219,36 €');
    // U+2212 (signe moins), pas un trait d'union.
    expect(lisible(formatSignedEuro(-44))).toBe('−44,00 €');
    expect(lisible(formatSignedEuro(0))).toBe('0,00 €'); // un solde nul n'a pas de signe
  });

  it('n’affiche rien plutôt qu’un « NaN € » sur un calcul impossible', () => {
    expect(formatEuro(Number.NaN)).toBe('');
    expect(formatSignedEuro(Number.NaN)).toBe('');
  });
});

describe('dates', () => {
  it('formate une date ISO de journal en jour/mois/année', () => {
    expect(formatDateShort('2026-01-12')).toBe('12/01/2026');
  });

  it('lit la date à minuit LOCAL, pas à minuit UTC (pas de décalage d’un jour)', () => {
    // `new Date('2026-01-01')` vaut minuit UTC : à l'ouest de Greenwich, ce
    // serait le 31 décembre — donc l'exercice précédent.
    expect(formatDateShort('2026-01-01')).toBe('01/01/2026');
    expect(formatDateShort('2025-12-31')).toBe('31/12/2025');
  });

  it('rend la saisie telle quelle si ce n’est pas une date', () => {
    expect(formatDateShort('à saisir')).toBe('à saisir');
    expect(formatDateShort('')).toBe('');
  });

  it('formate un horodatage d’audit avec l’heure', () => {
    expect(formatDateTime(AUDIT_TS)).toBe('08/01/2026 16:03');
  });
});

describe('la langue de l’app', () => {
  it('emmène les montants et les dates avec elle', () => {
    expect(lisible(formatEuro(1234.5))).toBe('1 234,50 €');

    // Ce que fait le provider i18n quand le trésorier bascule en anglais
    // (`localeTags: { en: 'en-GB' }` dans `src/i18n`).
    setDefaultLocale('en-GB');

    expect(lisible(formatEuro(1234.5))).toBe('€1,234.50');
    expect(lisible(formatSignedEuro(-44))).toBe('−€44.00');
    // `en-GB` et non `en-US` : le jour reste devant le mois, comme en français.
    expect(formatDateShort('2026-01-12')).toBe('12/01/2026');
  });

  it('rend le français au caractère près une fois revenue', () => {
    setDefaultLocale('en-GB');
    setDefaultLocale('fr');
    expect(formatEuro(1234.5)).toBe(`1\u202f234,50\u00a0€`);
    expect(formatDateShort('2026-01-12')).toBe('12/01/2026');
  });
});
