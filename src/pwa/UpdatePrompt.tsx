import { registerSW } from 'virtual:pwa-register';
import { UpdatePromptBanner } from '@mister-guiiug/dev-pwa-config/react/update-prompt-banner';
import { useI18n } from '../i18n/index.ts';

/**
 * Bandeau PWA « nouvelle version disponible » : le bandeau du socle, POSÉ.
 *
 * L'app ne garde ici que ce qui lui appartient vraiment :
 *  - `registerSW`, qui ne peut venir que d'elle (le module virtuel
 *    `virtual:pwa-register` n'existe que dans un build Vite + vite-plugin-pwa,
 *    c'est pourquoi le socle l'exige EN PARAMÈTRE et ne l'importe jamais) ;
 *  - le titre, qui nomme l'application ;
 *  - le placement : flottant au-dessus de `LensNav` (`bottom-20`), jamais
 *    imprimé.
 *
 * Le reste — l'état `needRefresh`, l'application effective de la mise à jour,
 * la sortie « Plus tard », l'habillage `[data-dwc="update-banner"]` — vient du
 * socle. Les libellés des deux boutons suivent la langue via `SocleLabels`.
 */
export function UpdatePrompt() {
  const { t } = useI18n();

  return (
    <UpdatePromptBanner
      registerSW={registerSW}
      title={t('pwa.ready')}
      className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-md uwh-rise no-print"
    />
  );
}
