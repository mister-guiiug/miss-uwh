import type { Adherent, Guardian } from '../../shared/types/domain.ts';
import type { AdherentActions, StoreSlice } from '../types.ts';
import { makeCrud } from '../crudFactory.ts';

/** Registre des adhérents et de leurs tuteurs/contacts. */
export const createAdherentSlice: StoreSlice<AdherentActions> = set => {
  const adherent = makeCrud<Adherent>(set, {
    get: d => d.adherents,
    replace: (d, adherents) => ({ ...d, adherents }),
    auditAction: 'adherent.create',
    auditTarget: 'adherent',
    summary: a => `Adhérent « ${a.firstName} ${a.lastName} » ajouté.`,
    upsertOp: a => ({ kind: 'adherent.upsert', adherent: a }),
    deleteOp: id => ({ kind: 'adherent.delete', id }),
    // Le serveur supprime les tuteurs en cascade (FK) ; on reflète localement.
    cascadeDelete: (d, id) => ({
      ...d,
      guardians: d.guardians.filter(g => g.memberId !== id),
    }),
  });

  const guardian = makeCrud<Guardian>(set, {
    get: d => d.guardians,
    replace: (d, guardians) => ({ ...d, guardians }),
    auditAction: 'guardian.create',
    auditTarget: 'guardian',
    summary: g => `Tuteur/contact « ${g.name} » ajouté.`,
    upsertOp: g => ({ kind: 'guardian.upsert', guardian: g }),
    deleteOp: id => ({ kind: 'guardian.delete', id }),
  });

  return {
    addAdherent: adherent.add,
    updateAdherent: adherent.update,
    deleteAdherent: adherent.remove,
    addGuardian: guardian.add,
    updateGuardian: guardian.update,
    deleteGuardian: guardian.remove,
  };
};
