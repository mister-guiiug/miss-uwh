import type { ReactNode } from 'react';
import { LabelsProvider } from '@mister-guiiug/dev-wpa-config/react/labels';
import { useI18n } from './index.ts';

/**
 * Branche les libellés internes des composants du socle sur la langue de l'app.
 *
 * POURQUOI. Les composants partagés portent leurs propres textes — « Fermer »
 * sur la croix d'une feuille, « Annuler »/« Supprimer » dans une confirmation.
 * Hors provider ils retombent sur le FRANÇAIS : invisible pour une app
 * monolingue, mais Miss UWH est bilingue, et sans ce branchement une feuille
 * ouverte en anglais garderait une croix étiquetée « Fermer ».
 *
 * Les copies locales lisaient `t('common.close')` directement. Ce provider
 * remplace ces lectures dispersées par un seul point de raccordement.
 */
export function SocleLabels({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  return <LabelsProvider locale={locale}>{children}</LabelsProvider>;
}
