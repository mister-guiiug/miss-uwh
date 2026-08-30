/**
 * Doublure de `virtual:pwa-register` pour les tests.
 *
 * Le module virtuel n'existe que dans un build servi par vite-plugin-pwa :
 * hors de là il est IRRÉSOLVABLE, et tout test qui monte la bannière de mise à
 * jour échoue à l'import — avant d'avoir rien éprouvé. C'est ce trou qui a
 * laissé `UpdatePrompt` sans aucun test jusqu'ici. Ce double inerte lui donne
 * un corps ; les tests qui s'intéressent au comportement le remplacent par
 * `vi.mock('virtual:pwa-register', …)`.
 */
export function registerSW(_options?: {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegisteredSW?: (
    swUrl: string,
    registration?: ServiceWorkerRegistration
  ) => void;
  onRegisterError?: (error: unknown) => void;
}): (reloadPage?: boolean) => Promise<void> {
  return async () => {};
}
