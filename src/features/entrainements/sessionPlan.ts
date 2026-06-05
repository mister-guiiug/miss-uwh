import type { Exercise, SessionPlanItem } from '../../shared/types/domain.ts';

/**
 * Durée totale planifiée (minutes) d'un plan de séance : pour chaque élément, la
 * durée explicite l'emporte, sinon on retombe sur la durée indicative de
 * l'exercice de la bibliothèque (0 si l'exercice a été supprimé).
 */
export function planTotalMinutes(
  plan: SessionPlanItem[] | undefined,
  exercises: Exercise[]
): number {
  if (!plan?.length) return 0;
  const byId = new Map(exercises.map(e => [e.id, e]));
  return plan.reduce((sum, it) => {
    const dur = it.durationMin ?? byId.get(it.exerciseId)?.durationMin ?? 0;
    return sum + (Number.isFinite(dur) && dur > 0 ? dur : 0);
  }, 0);
}
