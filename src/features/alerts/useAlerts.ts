import { useAppStore } from '../../store/useAppStore.ts';
import { computeAlerts, type Alert } from './alerts.ts';

/** Alertes « à faire » de la saison active (impayés, échéances licence/CM). */
export function useAlerts(): Alert[] {
  const adherents = useAppStore(s => s.data.adherents);
  const activeSeasonId = useAppStore(s => s.data.activeSeasonId);
  return computeAlerts(adherents, activeSeasonId);
}
