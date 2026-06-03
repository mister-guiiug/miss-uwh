/**
 * Palette de couleurs stable pour les graphiques (donuts par catégorie). Chaque
 * code de catégorie reçoit une couleur déterministe (par index dans CATEGORIES),
 * pour une lecture cohérente d'un écran/saison à l'autre.
 */
import { CATEGORIES } from './categories.ts';

const PALETTE = [
  '#2f5b8f', // bleu profond
  '#f2c811', // jaune
  '#1f9d55', // vert
  '#7c5fbf', // violet
  '#3aa6b9', // cyan
  '#e8833a', // orange
  '#6b89b3', // bleu-gris
  '#9ccb3b', // lime
  '#d9534f', // rouge
  '#c06fb8', // rose
  '#0ea5e9', // sky
  '#14b8a6', // teal
  '#a3762a', // brun
  '#8b5cf6', // indigo
  '#ec4899', // magenta
  '#64748b', // ardoise
];

const INDEX = new Map(CATEGORIES.map((c, i) => [c.code, i]));

export function categoryColor(code: string): string {
  const i = INDEX.get(code) ?? 0;
  return PALETTE[i % PALETTE.length]!;
}
