import { useCallback, useEffect, useRef, useState } from 'react';
import { computeWindow, type WindowRange } from '../lib/virtual.ts';

export interface UseWindowListOptions {
  /** Hauteur de ligne estimée (px), affinée par mesure de la 1ʳᵉ ligne rendue. */
  estimateRowHeight: number;
  /** Interligne entre deux lignes (px). */
  gap?: number;
  /** Lignes supplémentaires rendues hors viewport (anti-flash au scroll). */
  overscan?: number;
  /** Désactive le fenêtrage (petites listes) : aucun écouteur n'est posé. */
  enabled?: boolean;
}

export interface UseWindowListResult<E extends HTMLElement> {
  /** À poser sur le conteneur `<ul>` de la liste. */
  listRef: React.RefObject<E | null>;
  /** À poser sur la **première** ligne rendue pour auto-calibrer la hauteur. */
  measureRef: (node: HTMLElement | null) => void;
  /** Fenêtre courante { startIndex, endIndex, padTop, padBottom }. */
  range: WindowRange;
}

/**
 * Virtualisation d'une liste en **scroll de page**. Ne rend que les lignes
 * proches du viewport ; le reste est remplacé par deux espaceurs.
 *
 * - mesure la 1ʳᵉ ligne réelle pour connaître la hauteur exacte (police, zoom) ;
 * - recalcule au scroll / resize via `requestAnimationFrame` (throttling) ;
 * - `enabled: false` → aucun écouteur (coût nul sur les petites listes).
 */
export function useWindowList<E extends HTMLElement>(
  count: number,
  opts: UseWindowListOptions
): UseWindowListResult<E> {
  const { estimateRowHeight, gap = 0, overscan = 6, enabled = true } = opts;
  const listRef = useRef<E | null>(null);
  const rowHeightRef = useRef(estimateRowHeight);

  // Première fenêtre (avant tout effet) : un viewport raisonnable de lignes pour
  // éviter un premier paint vide ; corrigée dès le 1ᵉʳ rAF par `recompute`.
  const [range, setRange] = useState<WindowRange>(() => ({
    startIndex: 0,
    endIndex: Math.min(
      count,
      Math.ceil(800 / (estimateRowHeight + gap)) + overscan * 2 + 4
    ),
    padTop: 0,
    padBottom: 0,
  }));

  const recompute = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const scrollTop = window.scrollY;
    const next = computeWindow({
      scrollTop,
      viewportHeight: window.innerHeight,
      listTop: rect.top + scrollTop,
      stride: rowHeightRef.current + gap,
      count,
      overscan,
    });
    setRange(prev =>
      prev.startIndex === next.startIndex &&
      prev.endIndex === next.endIndex &&
      prev.padTop === next.padTop &&
      prev.padBottom === next.padBottom
        ? prev
        : next
    );
  }, [count, gap, overscan]);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        recompute();
      });
    };
    recompute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled, recompute]);

  const measureRef = useCallback(
    (node: HTMLElement | null) => {
      if (!node) return;
      const h = node.getBoundingClientRect().height;
      if (h > 0 && Math.abs(h - rowHeightRef.current) > 0.5) {
        rowHeightRef.current = h;
        recompute();
      }
    },
    [recompute]
  );

  return { listRef, measureRef, range };
}
