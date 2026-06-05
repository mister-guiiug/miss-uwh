import { describe, expect, it } from 'vitest';
import { computeWindow } from './virtual.ts';

/** Hauteur totale attendue = padTop + lignes rendues + padBottom. */
function totalHeight(
  r: ReturnType<typeof computeWindow>,
  stride: number
): number {
  return r.padTop + (r.endIndex - r.startIndex) * stride + r.padBottom;
}

describe('computeWindow', () => {
  const base = {
    viewportHeight: 600,
    listTop: 100,
    stride: 60, // 10 lignes par viewport
    count: 1000,
    overscan: 4,
  };

  it('rend le haut de la liste au repos (page non défilée)', () => {
    const r = computeWindow({ ...base, scrollTop: 0 });
    expect(r.startIndex).toBe(0);
    // first = floor((0-100)/60) = -2 ; visibleRows = ceil(600/60)+1 = 11
    // endIndex = clamp(-2 + 11 + 4) = 13
    expect(r.endIndex).toBe(13);
    expect(r.padTop).toBe(0);
  });

  it('fenêtre au milieu avec overscan symétrique', () => {
    // scrollTop tel que top = 6000 → first = 100
    const r = computeWindow({ ...base, scrollTop: 100 + 6000 });
    expect(r.startIndex).toBe(100 - 4); // 96
    expect(r.endIndex).toBe(100 + 11 + 4); // 115
    expect(r.padTop).toBe(96 * 60);
  });

  it('clampe en fin de liste sans déborder', () => {
    const r = computeWindow({ ...base, scrollTop: 100 + 1000 * 60 });
    expect(r.endIndex).toBe(1000);
    expect(r.startIndex).toBeLessThanOrEqual(1000);
    expect(r.padBottom).toBe(0);
  });

  it('liste entièrement au-dessus du viewport → fenêtre vide en haut', () => {
    // On a défilé très loin au-delà de la liste.
    const r = computeWindow({ ...base, scrollTop: 100 + 5000 * 60 });
    expect(r.startIndex).toBe(1000);
    expect(r.endIndex).toBe(1000);
    expect(r.padBottom).toBe(0);
    expect(r.padTop).toBe(1000 * 60);
  });

  it('hauteur totale toujours exacte (= count * stride)', () => {
    for (const scrollTop of [0, 500, 6000, 60000, 600000]) {
      const r = computeWindow({ ...base, scrollTop });
      expect(totalHeight(r, base.stride)).toBe(base.count * base.stride);
    }
  });

  it('petite liste : tout rendu, aucun espaceur', () => {
    const r = computeWindow({ ...base, count: 5, scrollTop: 0 });
    expect(r.startIndex).toBe(0);
    expect(r.endIndex).toBe(5);
    expect(r.padTop).toBe(0);
    expect(r.padBottom).toBe(0);
  });

  it('liste vide → fenêtre nulle', () => {
    const r = computeWindow({ ...base, count: 0, scrollTop: 1234 });
    expect(r).toEqual({ startIndex: 0, endIndex: 0, padTop: 0, padBottom: 0 });
  });

  it('stride invalide (0) ne divise jamais par zéro', () => {
    const r = computeWindow({ ...base, stride: 0, scrollTop: 0 });
    expect(Number.isFinite(r.endIndex)).toBe(true);
    expect(r.endIndex).toBeGreaterThan(r.startIndex);
  });

  it('overscan nul : fenêtre serrée sur le viewport', () => {
    const r = computeWindow({
      ...base,
      overscan: 0,
      scrollTop: 100 + 6000,
    });
    expect(r.startIndex).toBe(100);
    expect(r.endIndex).toBe(100 + 11);
  });
});
