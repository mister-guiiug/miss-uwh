import { useLocation } from 'react-router-dom';
import { lensById, type Lens } from '../lib/lenses.ts';

/**
 * Lens actif déduit du 1er segment d'URL. `null` sur le lanceur (`/`) et les
 * routes globales (`/settings`, `/audit`) → le Shell n'affiche alors pas de
 * barre du bas.
 */
export function useActiveLens(): Lens | null {
  const { pathname } = useLocation();
  const segment = pathname.split('/').filter(Boolean)[0];
  return lensById(segment) ?? null;
}
