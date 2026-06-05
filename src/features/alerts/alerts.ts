/**
 * Calcul des alertes « à faire » du trésorier, dérivées de l'état de la saison
 * active (sans système externe) : cotisations impayées et échéances de licence
 * / certificat médical. Pur et testable (`today` injectable).
 */
import type { Adherent } from '../../shared/types/domain.ts';
import { expiryStatus } from '../../shared/lib/expiry.ts';

export interface Alert {
  id: string;
  tone: 'warn' | 'debit';
  title: string;
  to: string;
}

export function computeAlerts(
  adherents: Adherent[],
  activeSeasonId: string,
  today: Date = new Date()
): Alert[] {
  const inSeason = adherents.filter(a => a.seasonId === activeSeasonId);
  const alerts: Alert[] = [];
  const docs = (a: Adherent) => [a.licenceExpiry, a.medicalCertExpiry];

  const unpaid = inSeason.filter(a => !a.paid).length;
  if (unpaid > 0) {
    alerts.push({
      id: 'unpaid',
      tone: 'warn',
      title: `${unpaid} cotisation${unpaid > 1 ? 's' : ''} impayée${
        unpaid > 1 ? 's' : ''
      }`,
      to: '/adherents/cotisations',
    });
  }

  const expired = inSeason.filter(a =>
    docs(a).some(d => expiryStatus(d, 30, today) === 'expired')
  ).length;
  if (expired > 0) {
    alerts.push({
      id: 'expired',
      tone: 'debit',
      title: `${expired} licence/certificat expiré${expired > 1 ? 's' : ''}`,
      to: '/adherents',
    });
  }

  const soon = inSeason.filter(a =>
    docs(a).some(d => expiryStatus(d, 30, today) === 'soon')
  ).length;
  if (soon > 0) {
    alerts.push({
      id: 'soon',
      tone: 'warn',
      title: `${soon} licence/certificat à renouveler (< 30 j)`,
      to: '/adherents',
    });
  }

  return alerts;
}
