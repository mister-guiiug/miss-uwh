/**
 * Store applicatif (Zustand) — source de vérité unique de l'état persisté.
 *
 * Composé de slices par domaine (cf. `./slices/`). Invariants (défense en
 * profondeur, complétée côté serveur par les politiques RLS Supabase) :
 *  - toute mutation persiste via `commitAudited`/`commitPlain` (un seul point
 *    de persistance, cf. `storeHelpers.ts`) ;
 *  - toute mutation significative écrit une entrée d'audit (règles 13–14) ;
 *  - une écriture rattachée à une saison CLÔTURÉE est verrouillée tant que la
 *    saison n'est pas rouverte (règle « clôture avec verrouillage ») ;
 *  - les suppressions d'écritures sont LOGIQUES (`deletedAt`), jamais physiques.
 */
import { create } from 'zustand';
import type { JournalEntry, Season } from '../shared/types/domain.ts';
import { setCustomCategories } from '../shared/lib/categories.ts';
import { loadData } from '../shared/lib/storage.ts';
import type { AppState } from './types.ts';
import { createMetaSlice } from './slices/metaSlice.ts';
import { createSeasonSlice } from './slices/seasonSlice.ts';
import { createFinanceSlice } from './slices/financeSlice.ts';
import { createEntriesSlice } from './slices/entriesSlice.ts';
import { createAdherentSlice } from './slices/adherentSlice.ts';
import { createTrainingSlice } from './slices/trainingSlice.ts';
import { createVieClubSlice } from './slices/vieClubSlice.ts';
import { createSystemSlice } from './slices/systemSlice.ts';

// API ré-exportée (compat. des imports existants à travers l'app).
export { setCurrentActor } from './storeHelpers.ts';
export type { AppState, EntryInput, SyncStatus } from './types.ts';

export const useAppStore = create<AppState>((set, get, store) => {
  const initial = loadData();
  // Synchronise le registre de catégories dès l'init (avant tout commit).
  setCustomCategories(initial.customCategories);

  return {
    data: initial,
    syncStatus: { state: 'idle' },
    ...createMetaSlice(set, get, store),
    ...createSeasonSlice(set, get, store),
    ...createFinanceSlice(set, get, store),
    ...createEntriesSlice(set, get, store),
    ...createAdherentSlice(set, get, store),
    ...createTrainingSlice(set, get, store),
    ...createVieClubSlice(set, get, store),
    ...createSystemSlice(set, get, store),
  };
});

/** Sélecteur : saison active (toujours définie). */
export function selectActiveSeason(s: AppState): Season {
  return (
    s.data.seasons.find(x => x.id === s.data.activeSeasonId) ??
    s.data.seasons[0]!
  );
}

/** Sélecteur : écritures actives de la saison active. */
export function selectActiveEntries(s: AppState): JournalEntry[] {
  const sid = s.data.activeSeasonId;
  return s.data.entries.filter(e => e.seasonId === sid && !e.deletedAt);
}
