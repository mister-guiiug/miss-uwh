import {
  createI18n,
  createTranslator,
} from '@mister-guiiug/dev-pwa-config/react/i18n';
import { messages } from './messages.ts';
import type { Locale, Messages } from './messages.ts';

const STORAGE_KEY = 'uwh_locale';

/**
 * i18n de l'application (FR par défaut, EN complet). Construit une fois au niveau
 * module via le helper partagé `createI18n` : contexte + provider + hook typés.
 * Les clés sont vérifiées à la compilation (dot-notation dérivée du dictionnaire).
 *
 * `createI18n` pose aussi la locale par défaut de `dev-pwa-config/format` : les
 * montants et les dates suivent la langue choisie (cf. `shared/lib/format.ts`).
 * L'anglais est épinglé sur `en-GB` — un club français tient un journal en
 * jour/mois, et `en-US` aurait affiché « 01/12/2026 » pour le 12 janvier.
 */
export const { I18nProvider, useI18n } = createI18n({
  messages,
  locales: ['fr', 'en'],
  fallbackLocale: 'fr',
  localeTags: { en: 'en-GB' },
  storageKey: STORAGE_KEY,
});

export type { Locale, Messages };

/** Union typée des clés de traduction (pour les libellés stockés en données). */
export type TKey = Parameters<ReturnType<typeof useI18n>['t']>[0];

/** Locale courante lue hors React (persistance localStorage). Repli sur `fr`. */
function currentLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'fr' || stored === 'en') return stored;
  } catch {
    /* localStorage indisponible : on ignore */
  }
  return 'fr';
}

/**
 * Traduction HORS composant (code bas-niveau : persistance, couche de sync) —
 * pour les toasts émis sans accès au hook. Lit la locale persistée à chaud.
 */
export function translate(
  key: TKey,
  params?: Record<string, string | number>
): string {
  return createTranslator(messages, currentLocale(), 'fr')(key, params);
}
