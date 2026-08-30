/**
 * Formatage comptable : montants en euros, dates du journal.
 *
 * La MÉCANIQUE vient de `dev-wpa-config/format` — instances `Intl` mémorisées
 * (elles coûtent cher, et une liste d'écritures en construisait une par ligne),
 * dates invalides absorbées, et surtout une locale par défaut DÉPLAÇABLE.
 *
 * LOCALE : plus de `'fr-FR'` en dur. Le socle formate avec `getDefaultLocale()`,
 * que `createI18n` déplace à chaque changement de langue (cf. `src/i18n`). Un
 * trésorier qui passe l'app en anglais voit désormais ses montants et ses dates
 * suivre — jusqu'ici seuls les libellés changeaient. En français, la sortie est
 * inchangée au caractère près (`Intl` traite `'fr'` exactement comme `'fr-FR'`).
 *
 * NE RESTENT ICI que les formateurs sans équivalent dans le socle, parce qu'ils
 * portent une règle MÉTIER :
 *  - `formatEuro` honore le réglage `settings.decimals` du club (0 à 3), que
 *    `formatCurrency` du socle ne prend pas en paramètre ;
 *  - `formatSignedEuro` applique la convention comptable (« + » explicite, signe
 *    moins typographique U+2212, rien du tout sur un solde nul) ;
 *  - `formatDateShort` lit une date de journal ISO (`YYYY-MM-DD`) et la ramène à
 *    MINUIT LOCAL : `new Date('2026-01-12')` vaut minuit UTC, donc la VEILLE
 *    pour un fuseau à l'ouest de Greenwich.
 */
import {
  formatDate as formatDateIntl,
  formatDateTime as formatDateTimeIntl,
  formatNumber,
} from '@mister-guiiug/dev-wpa-config/format';

/** Jour/mois/année en chiffres — le format compact des journaux. */
const NUMERIC_DAY: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
};

/** Montant en euros, à la précision réglée par le club (`settings.decimals`). */
export function formatEuro(value: number, decimals = 2): string {
  return formatNumber(value, undefined, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Montant signé lisible : +1 219,36 € / −44,00 € / 0,00 € sans signe. */
export function formatSignedEuro(value: number, decimals = 2): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${formatEuro(Math.abs(value), decimals)}`;
}

/**
 * Date ISO du journal (`2026-01-12`) → `12/01/2026`. Rend la chaîne d'origine
 * si elle n'est pas une date : dans un journal comptable, mieux vaut afficher
 * une saisie douteuse que la faire disparaître.
 */
export function formatDateShort(iso: string): string {
  return formatDateIntl(`${iso}T00:00:00`, undefined, NUMERIC_DAY) || iso;
}

/** Horodatage d'audit (ms) → `12/01/2026 14:03`. */
export function formatDateTime(ts: number): string {
  return formatDateTimeIntl(ts, undefined, NUMERIC_DAY);
}
