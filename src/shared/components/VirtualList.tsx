import type { ReactNode } from 'react';
import { useWindowList } from '../hooks/useWindowList.ts';

interface VirtualListProps<T> {
  /** Données déjà filtrées / triées, dans l'ordre d'affichage. */
  items: T[];
  /** Clé stable d'un élément (pour `key`). */
  getKey: (item: T, index: number) => string;
  /** Rendu du **contenu** d'une ligne (la balise `<li>` est fournie par ce composant). */
  children: (item: T, index: number) => ReactNode;
  /** Hauteur de ligne estimée (px), affinée par mesure réelle. */
  estimateRowHeight: number;
  /** Interligne entre deux lignes (px). Défaut 6 (≈ `gap-1.5`). */
  gap?: number;
  /** Lignes hors-champ rendues de part et d'autre. */
  overscan?: number;
  /**
   * Seuil de virtualisation : en-deçà, la liste est rendue intégralement
   * (comportement identique à l'existant, coût nul). Au-delà, fenêtrage.
   */
  threshold?: number;
  /** Libellé ARIA du `<ul>`. */
  ariaLabel?: string;
  /** Classes supplémentaires sur le `<ul>`. */
  className?: string;
}

/**
 * Liste virtualisée en **scroll de page** : ne monte que les lignes proches du
 * viewport, ce qui garde l'app fluide même avec des milliers d'écritures.
 *
 * Hypothèse : lignes de **hauteur uniforme** (le pas est auto-calibré sur la 1ʳᵉ
 * ligne). Pour des hauteurs très variables, préférer une liste classique.
 */
export function VirtualList<T>({
  items,
  getKey,
  children,
  estimateRowHeight,
  gap = 6,
  overscan = 6,
  threshold = 40,
  ariaLabel,
  className,
}: VirtualListProps<T>) {
  const virtualize = items.length > threshold;
  const { listRef, measureRef, range } = useWindowList<HTMLUListElement>(
    items.length,
    { estimateRowHeight, gap, overscan, enabled: virtualize }
  );

  // Petite liste : rendu intégral, layout flex classique (gap réel).
  if (!virtualize) {
    return (
      <ul
        aria-label={ariaLabel}
        className={`flex flex-col ${className ?? ''}`}
        style={{ gap }}
      >
        {items.map((item, index) => (
          <li key={getKey(item, index)}>{children(item, index)}</li>
        ))}
      </ul>
    );
  }

  // Grande liste : fenêtrage. Les espaceurs (padding) reconstituent la hauteur
  // totale ; chaque ligne porte son interligne en `margin-bottom`.
  const slice = items.slice(range.startIndex, range.endIndex);
  return (
    <ul
      ref={listRef}
      aria-label={ariaLabel}
      className={className}
      style={{ paddingTop: range.padTop, paddingBottom: range.padBottom }}
    >
      {slice.map((item, i) => {
        const index = range.startIndex + i;
        return (
          <li
            key={getKey(item, index)}
            ref={index === range.startIndex ? measureRef : undefined}
            style={{ marginBottom: gap }}
          >
            {children(item, index)}
          </li>
        );
      })}
    </ul>
  );
}
