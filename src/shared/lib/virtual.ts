/**
 * Fenêtrage (virtualisation) de longues listes en **scroll de page**.
 *
 * La PWA ne possède pas de conteneur scrollable interne : c'est la fenêtre qui
 * défile (cf. `App.tsx` → `<main className="flex-1">`). Le calcul ci-dessous est
 * donc exprimé en coordonnées document : `scrollTop` = `window.scrollY`,
 * `listTop` = position du haut de la liste dans le document.
 *
 * Modèle à **pas constant** : chaque ligne occupe `stride` pixels
 * (hauteur de ligne + interligne). On encadre les lignes rendues par deux
 * espaceurs (`padTop` / `padBottom`) dont la somme avec les lignes visibles vaut
 * toujours exactement `count * stride` → la barre de défilement reste juste.
 *
 * Fonction PURE et déterministe : testée unitairement, sans dépendance au DOM.
 */
export interface WindowRange {
  /** Index de la première ligne rendue (inclus). */
  startIndex: number;
  /** Index juste après la dernière ligne rendue (exclu). */
  endIndex: number;
  /** Hauteur de l'espaceur avant la première ligne rendue (px). */
  padTop: number;
  /** Hauteur de l'espaceur après la dernière ligne rendue (px). */
  padBottom: number;
}

export interface ComputeWindowParams {
  /** Défilement vertical de la page (`window.scrollY`). */
  scrollTop: number;
  /** Hauteur du viewport (`window.innerHeight`). */
  viewportHeight: number;
  /** Position du haut de la liste dans le document (px). */
  listTop: number;
  /** Pas vertical d'une ligne = hauteur + interligne (px, > 0). */
  stride: number;
  /** Nombre total d'éléments. */
  count: number;
  /** Lignes supplémentaires rendues de part et d'autre du viewport. */
  overscan: number;
}

/**
 * Calcule la fenêtre de lignes à rendre pour un viewport donné.
 *
 * Garanties :
 *  - `0 <= startIndex <= endIndex <= count` ;
 *  - `padTop + (endIndex - startIndex) * stride + padBottom === count * stride`
 *    (hauteur totale exacte, donc défilement fidèle) ;
 *  - hors-champ (liste entièrement au-dessus / en dessous du viewport) → fenêtre
 *    vide correctement placée plutôt qu'un rendu erroné.
 */
export function computeWindow(p: ComputeWindowParams): WindowRange {
  const count = Math.max(0, Math.floor(p.count));
  if (count === 0) {
    return { startIndex: 0, endIndex: 0, padTop: 0, padBottom: 0 };
  }
  const stride = p.stride > 0 ? p.stride : 1;
  const overscan = Math.max(0, Math.floor(p.overscan));

  // Décalage du haut du viewport par rapport au haut de la liste.
  const top = p.scrollTop - p.listTop;
  const first = Math.floor(top / stride);
  // +1 pour couvrir une ligne partiellement visible en bas.
  const visibleRows = Math.ceil(p.viewportHeight / stride) + 1;

  const startIndex = clamp(first - overscan, 0, count);
  const endIndex = clamp(first + visibleRows + overscan, startIndex, count);

  return {
    startIndex,
    endIndex,
    padTop: startIndex * stride,
    padBottom: (count - endIndex) * stride,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
