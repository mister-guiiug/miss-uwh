import { registerSW } from 'virtual:pwa-register';
import { UpdatePromptBanner } from '@mister-guiiug/dev-pwa-config/react/update-prompt-banner';

/**
 * Bandeau PWA « mise à jour disponible » : le bandeau du socle, POSÉ.
 *
 * L'app ne garde ici que ce qui lui appartient vraiment :
 *  - `registerSW`, qui ne peut venir que d'elle (le module virtuel
 *    `virtual:pwa-register` n'existe que dans un build Vite + vite-plugin-pwa,
 *    c'est pourquoi le socle l'exige EN PARAMÈTRE et ne l'importe jamais) ;
 *  - le placement : flottant au-dessus de `LensNav` (`bottom-20`), jamais
 *    imprimé.
 *
 * LE TITRE VIENT DU SOCLE, et ne nomme plus l'application. Il disait « Une
 * nouvelle version de Miss UWH est prête. » — juste, mais chaque app du parc
 * avait écrit la sienne : neuf formulations pour la même chose, trois verbes
 * d'action et quatre formes de report. Le titre, les deux boutons, l'état
 * `needRefresh`, l'application effective de la mise à jour et l'habillage
 * `[data-dwc="update-banner"]` viennent désormais tous du même endroit, et
 * suivent la langue via `SocleLabels`.
 */
export function UpdatePrompt() {
  return (
    <UpdatePromptBanner
      snoozeHours={0}
      checkEvery="1h"
      registerSW={registerSW}
      className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-md uwh-rise no-print"
    />
  );
}
