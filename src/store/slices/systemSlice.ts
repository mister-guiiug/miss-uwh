import { createEmptyData } from '../../shared/lib/seed.ts';
import { clearAll as clearSyncQueue } from '../../backend/syncQueue.ts';
import type { StoreSlice, SystemActions } from '../types.ts';
import { commitAudited, commitPlain } from '../storeHelpers.ts';

/** Synchro, hydratation serveur, audit sécurité libre, import/reset/purge. */
export const createSystemSlice: StoreSlice<SystemActions> = set => ({
  setSyncStatus: status => set({ syncStatus: status }),

  hydrate: data => set({ data: commitPlain(data) }),

  acknowledgeEntryVersion: (id, version) =>
    set(s => {
      const entry = s.data.entries.find(e => e.id === id);
      // Jamais en arrière : un pull a pu apporter, pendant l'envoi, une version
      // plus récente (la modification d'un autre, faite après la nôtre).
      if (!entry || entry.version >= version) return s;
      return {
        data: commitPlain({
          ...s.data,
          entries: s.data.entries.map(e =>
            e.id === id ? { ...e, version } : e
          ),
        }),
      };
    }),

  hydrateEntry: (id, entry) =>
    set(s => {
      const current = s.data.entries.find(e => e.id === id);
      const entries = !entry
        ? s.data.entries.filter(e => e.id !== id)
        : current
          ? s.data.entries.map(e =>
              // Les justificatifs vivent dans leur propre table : la ligne
              // relue n'en porte pas, ceux de l'appareil restent.
              e.id === id ? { ...entry, attachments: current.attachments } : e
            )
          : [...s.data.entries, entry];
      return { data: commitPlain({ ...s.data, entries }) };
    }),

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
