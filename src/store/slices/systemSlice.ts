import { createEmptyData } from '../../shared/lib/seed.ts';
import { clearAll as clearSyncQueue } from '../../backend/syncQueue.ts';
import type { StoreSlice, SystemActions } from '../types.ts';
import { commitAudited, commitPlain } from '../storeHelpers.ts';

/** Synchro, hydratation serveur, audit sécurité libre, import/reset/purge. */
export const createSystemSlice: StoreSlice<SystemActions> = set => ({
  setSyncStatus: status => set({ syncStatus: status }),

  hydrate: data => set({ data: commitPlain(data) }),

  logSecurity: (action, summary) =>
    set(s => ({
      data: commitAudited(s.data, {
        action,
        category: 'securite',
        target: 'session',
        summary,
      }),
    })),

  replaceData: data =>
    // L'import remplace tout l'état ; on consigne l'opération dans le nouvel
    // état importé (trace conservée même après remplacement).
    set({
      data: commitAudited(data, {
        action: 'data.import',
        category: 'securite',
        target: 'app',
        summary: `Import de données (${data.entries.length} écritures, ${data.seasons.length} saisons).`,
      }),
    }),

  resetAll: (clubName, seasonLabel, opening) =>
    set(() => ({
      data: commitPlain(createEmptyData(clubName, seasonLabel, opening)),
    })),

  wipeLocal: () => {
    // Vide la file de synchro (rien ne doit être rejoué pour un autre compte)
    // puis réinitialise le miroir local. Le prochain login re-pull le serveur.
    clearSyncQueue();
    set({
      data: commitPlain(createEmptyData()),
      syncStatus: { state: 'idle' },
    });
  },
});
