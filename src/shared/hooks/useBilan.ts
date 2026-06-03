import { useMemo } from 'react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import {
  computeBilan,
  eventResults,
  type Bilan,
  type EventResult,
} from '../lib/engine.ts';

/** Bilan + résultats par événement de la saison active (mémoïsés). */
export function useBilan(): { bilan: Bilan; events: EventResult[] } {
  const season = useAppStore(selectActiveSeason);
  const entries = useAppStore(s => s.data.entries);
  const allEvents = useAppStore(s => s.data.events);

  return useMemo(() => {
    const bilan = computeBilan(season, entries);
    const seasonEvents = allEvents.filter(e => e.seasonId === season.id);
    return { bilan, events: eventResults(seasonEvents, entries) };
  }, [season, entries, allEvents]);
}
