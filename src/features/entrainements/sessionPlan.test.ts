import { describe, expect, it } from 'vitest';
import type { Exercise, SessionPlanItem } from '../../shared/types/domain.ts';
import { planTotalMinutes } from './sessionPlan.ts';

const ex = (id: string, durationMin?: number): Exercise => ({
  id,
  seasonId: 's1',
  name: id,
  category: 'technique',
  durationMin,
});

describe('planTotalMinutes', () => {
  const exercises = [ex('e1', 10), ex('e2', 20), ex('e3')];

  it('renvoie 0 pour un plan vide', () => {
    expect(planTotalMinutes(undefined, exercises)).toBe(0);
    expect(planTotalMinutes([], exercises)).toBe(0);
  });

  it('utilise la durée explicite sinon celle de l’exercice', () => {
    const plan: SessionPlanItem[] = [
      { exerciseId: 'e1' }, // 10 (défaut exercice)
      { exerciseId: 'e2', durationMin: 5 }, // 5 (explicite)
      { exerciseId: 'e3', durationMin: 15 }, // 15 (exercice sans durée)
    ];
    expect(planTotalMinutes(plan, exercises)).toBe(30);
  });

  it('ignore les exercices supprimés / durées invalides', () => {
    const plan: SessionPlanItem[] = [
      { exerciseId: 'inconnu' }, // 0
      { exerciseId: 'e1', durationMin: -5 }, // ignoré
      { exerciseId: 'e2' }, // 20
    ];
    expect(planTotalMinutes(plan, exercises)).toBe(20);
  });
});
