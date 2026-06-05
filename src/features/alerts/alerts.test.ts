import { describe, expect, it } from 'vitest';
import type { Adherent } from '../../shared/types/domain.ts';
import { computeAlerts } from './alerts.ts';

const TODAY = new Date(2026, 0, 15); // 15 janvier 2026

const adh = (over: Partial<Adherent>): Adherent => ({
  id: Math.random().toString(36).slice(2),
  seasonId: 's1',
  firstName: 'A',
  lastName: 'B',
  category: 'adulte',
  amount: 100,
  paid: true,
  ...over,
});

describe('computeAlerts', () => {
  it('aucune alerte si tout est en ordre', () => {
    expect(computeAlerts([adh({})], 's1', TODAY)).toEqual([]);
  });

  it('compte les cotisations impayées de la saison active', () => {
    const a = computeAlerts(
      [
        adh({ paid: false }),
        adh({ paid: false }),
        adh({ seasonId: 's2', paid: false }),
      ],
      's1',
      TODAY
    );
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ id: 'unpaid', to: '/adherents/cotisations' });
    expect(a[0]!.title).toContain('2 cotisations impayées');
  });

  it('distingue documents expirés et bientôt expirés', () => {
    const a = computeAlerts(
      [
        adh({ licenceExpiry: '2025-12-01' }), // expiré
        adh({ medicalCertExpiry: '2026-02-01' }), // < 30 j
      ],
      's1',
      TODAY
    );
    const ids = a.map(x => x.id);
    expect(ids).toContain('expired');
    expect(ids).toContain('soon');
  });
});
