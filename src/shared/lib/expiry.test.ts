import { describe, expect, it } from 'vitest';
import { expiryStatus, worstExpiry } from './expiry.ts';

const TODAY = new Date(2026, 0, 15); // 15 janvier 2026

describe('expiryStatus', () => {
  it('renvoie none sans date', () => {
    expect(expiryStatus(undefined, 30, TODAY)).toBe('none');
    expect(expiryStatus('', 30, TODAY)).toBe('none');
  });

  it('renvoie expired pour une date passée', () => {
    expect(expiryStatus('2026-01-14', 30, TODAY)).toBe('expired');
    expect(expiryStatus('2025-09-01', 30, TODAY)).toBe('expired');
  });

  it('renvoie soon dans la fenêtre (bornes incluses)', () => {
    expect(expiryStatus('2026-01-15', 30, TODAY)).toBe('soon'); // aujourd'hui
    expect(expiryStatus('2026-02-14', 30, TODAY)).toBe('soon'); // J+30
  });

  it('renvoie ok au-delà de la fenêtre', () => {
    expect(expiryStatus('2026-02-15', 30, TODAY)).toBe('ok'); // J+31
    expect(expiryStatus('2026-09-01', 30, TODAY)).toBe('ok');
  });

  it('renvoie none pour une date invalide', () => {
    expect(expiryStatus('pas-une-date', 30, TODAY)).toBe('none');
  });
});

describe('worstExpiry', () => {
  it('retient le statut le plus urgent', () => {
    expect(worstExpiry('ok', 'expired', 'soon')).toBe('expired');
    expect(worstExpiry('none', 'soon', 'ok')).toBe('soon');
    expect(worstExpiry('none', 'ok')).toBe('ok');
    expect(worstExpiry('none', 'none')).toBe('none');
  });
});
