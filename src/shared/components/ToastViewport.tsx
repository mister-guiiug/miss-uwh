import { ToastViewport as SocleToastViewport } from '@mister-guiiug/dev-pwa-config/react/toast';
import { setToastsPaused, useToasts } from '../lib/toasts.ts';

/**
 * Pile de notifications, ancrée en bas et centrée dans la colonne de l'app.
 * Montée une seule fois (cf. `App.tsx`), hors routeur, pour afficher aussi les
 * messages survenant à l'amorçage (lecture du stockage) ou sur l'écran de login.
 *
 * L'AFFICHAGE vient de `dev-pwa-config/react/toast` ; la FILE reste dans le
 * magasin zustand de `shared/lib/toasts.ts` — `storage.ts` et la couche de
 * synchro notifient depuis du code sans React, où `useToast()` n'existe pas.
 * Le socle publie sa zone d'affichage seule pour exactement ce cas.
 *
 * CE QUE L'ADOPTION CORRIGE. La copie locale ne montait la région qu'à
 * l'arrivée du premier message (`if (toasts.length === 0) return null`) : un
 * lecteur d'écran n'annonce une insertion que dans une région DÉJÀ présente,
 * donc le message pouvait passer inaperçu — grave pour « sauvegarde locale
 * impossible ». Ici les deux régions (polie et assertive) sont montées en
 * permanence, les messages ne portent aucun rôle propre (pas de double
 * annonce), et le rebours se suspend au survol comme au focus.
 *
 * Habillage : `[data-dwc="toast-*"]` de `components.css`, teinté par le contrat
 * `--dwc-*` de `index.css` (erreur = `--uwh-debit`, succès = `--uwh-credit`).
 */
export function ToastViewport() {
  const toasts = useToasts(s => s.toasts);
  const dismiss = useToasts(s => s.dismiss);

  return (
    <SocleToastViewport
      // Les identifiants du socle sont des chaînes ; les nôtres, des entiers.
      toasts={toasts.map(t => ({
        id: String(t.id),
        message: t.message,
        tone: t.tone,
      }))}
      onDismiss={id => dismiss(Number(id))}
      onPauseChange={setToastsPaused}
    />
  );
}
