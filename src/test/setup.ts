// Setup Vitest partagé : jest-dom + stub matchMedia + mocks virtual:pwa-register.
import '@mister-guiiug/dev-pwa-config/vitest-setup';

/*
 * RELAIS TEMPORAIRE — à retirer au prochain socle (dev-pwa-config#303).
 *
 * `URL.createObjectURL` n'existe pas dans jsdom : c'est VITEST qui la fournit,
 * et sa version retrouve l'objet d'implémentation d'un Blob de jsdom en prenant
 * « le premier symbole propre » de l'instance — sa source commente ce passage
 * par « this is cursed ». jsdom 30.0.1 exposait un `Symbol(impl)` ;
 * jsdom 30.1.0 n'en expose plus AUCUN, et l'appel lève
 * `Cannot read properties of undefined (reading '_buffer')`.
 *
 * Ici, cela fait tomber le test de téléchargement du bilan PDF, qui passe par
 * `downloadBlob` du socle : la pile accuse le socle alors que le défaut est
 * dans le harnais. Vitest 5.0.1 est la dernière version publiée — il n'y a pas
 * de correctif à attendre aujourd'hui.
 *
 * La garde durable est posée dans `vitest-setup` du socle ; ce bloc n'est là
 * que le temps de la publication, et il disparaîtra avec la montée de version.
 * Il SONDE plutôt qu'il n'écrase : tester la présence de la méthode ne servirait
 * à rien — elle est bien là, et elle lève.
 */
function urlObjetUtilisable(): boolean {
  if (typeof URL?.createObjectURL !== 'function') return false;
  try {
    const url = URL.createObjectURL(new Blob(['sonde']));
    if (typeof url !== 'string' || !url) return false;
    URL.revokeObjectURL?.(url);
    return true;
  } catch {
    return false;
  }
}

if (!urlObjetUtilisable()) {
  const vivantes = new Map<string, unknown>();
  let compteur = 0;
  URL.createObjectURL = (objet: Blob | MediaSource) => {
    const url = `blob:miss-uwh-test/${++compteur}`;
    vivantes.set(url, objet);
    return url;
  };
  URL.revokeObjectURL = (url: string) => {
    vivantes.delete(url);
  };
}
