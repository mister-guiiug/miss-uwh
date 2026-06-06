import type {
  Exercise,
  Referee,
  Strategy,
  TrainingSession,
} from '../../shared/types/domain.ts';
import type { StoreSlice, TrainingActions } from '../types.ts';
import { makeCrud } from '../crudFactory.ts';

/** Entraînements : séances, exercices, stratégies, arbitres. */
export const createTrainingSlice: StoreSlice<TrainingActions> = set => {
  const session = makeCrud<TrainingSession>(set, {
    get: d => d.trainingSessions,
    replace: (d, trainingSessions) => ({ ...d, trainingSessions }),
    auditAction: 'session.create',
    auditTarget: 'session',
    summary: s => `Séance du ${s.date} ajoutée.`,
    upsertOp: s => ({ kind: 'session.upsert', session: s }),
    deleteOp: id => ({ kind: 'session.delete', id }),
  });

  const exercise = makeCrud<Exercise>(set, {
    get: d => d.exercises,
    replace: (d, exercises) => ({ ...d, exercises }),
    auditAction: 'exercise.create',
    auditTarget: 'exercise',
    summary: e => `Exercice « ${e.name} » ajouté.`,
    upsertOp: e => ({ kind: 'exercise.upsert', exercise: e }),
    deleteOp: id => ({ kind: 'exercise.delete', id }),
  });

  const strategy = makeCrud<Strategy>(set, {
    get: d => d.strategies,
    replace: (d, strategies) => ({ ...d, strategies }),
    auditAction: 'strategy.create',
    auditTarget: 'strategy',
    summary: st => `Stratégie « ${st.name} » ajoutée.`,
    upsertOp: st => ({ kind: 'strategy.upsert', strategy: st }),
    deleteOp: id => ({ kind: 'strategy.delete', id }),
  });

  const referee = makeCrud<Referee>(set, {
    get: d => d.referees,
    replace: (d, referees) => ({ ...d, referees }),
    auditAction: 'referee.create',
    auditTarget: 'referee',
    summary: r => `Arbitre « ${r.name} » ajouté.`,
    upsertOp: r => ({ kind: 'referee.upsert', referee: r }),
    deleteOp: id => ({ kind: 'referee.delete', id }),
  });

  return {
    addTrainingSession: session.add,
    updateTrainingSession: session.update,
    deleteTrainingSession: session.remove,
    addExercise: exercise.add,
    updateExercise: exercise.update,
    deleteExercise: exercise.remove,
    addStrategy: strategy.add,
    updateStrategy: strategy.update,
    deleteStrategy: strategy.remove,
    addReferee: referee.add,
    updateReferee: referee.update,
    deleteReferee: referee.remove,
  };
};
