/**
 * Force la récupération de la dernière version déployée.
 *
 * Stratégie volontairement « marteau » (action manuelle explicite) :
 *  1. demande au service worker de chercher une mise à jour ;
 *  2. si une nouvelle version attend déjà, on l'active (SKIP_WAITING) ;
 *  3. sinon on désinscrit le SW et on vide le Cache Storage pour garantir un
 *     rechargement depuis le réseau ;
 *  4. on recharge la page.
 *
 * Les données utilisateur (localStorage) ne sont **pas** touchées : seuls les
 * caches d'assets et le service worker sont réinitialisés.
 */
export async function forceUpdate(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();

      // Voie propre : activer un SW déjà en attente.
      const hasWaiting = registrations.some(reg => reg.waiting);
      if (hasWaiting) {
        for (const reg of registrations) {
          reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
        }
      } else {
        // Aucune version en attente : re-téléchargement complet forcé.
        await Promise.all(registrations.map(reg => reg.update()));
        await Promise.all(registrations.map(reg => reg.unregister()));
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(key => caches.delete(key)));
        }
      }
    }
  } catch (err) {
    console.warn('[miss-uwh] forceUpdate', err);
  } finally {
    window.location.reload();
  }
}
