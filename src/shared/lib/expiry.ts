/**
 * Statut d'échéance d'une date (licence, certificat médical…) vis-à-vis
 * d'aujourd'hui :
 *   - `none`    : pas de date renseignée ;
 *   - `expired` : déjà passée ;
 *   - `soon`    : expire dans les `withinDays` jours (30 par défaut) ;
 *   - `ok`      : au-delà.
 * `today` est injectable pour les tests (sinon date du jour).
 */
export type ExpiryStatus = 'none' | 'ok' | 'soon' | 'expired';

export function expiryStatus(
  dateIso: string | undefined,
  withinDays = 30,
  today: Date = new Date()
): ExpiryStatus {
  if (!dateIso) return 'none';
  const d = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 'none';
  const ref = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.floor((d.getTime() - ref.getTime()) / 86_400_000);
  if (diffDays < 0) return 'expired';
  if (diffDays <= withinDays) return 'soon';
  return 'ok';
}

const SEVERITY: Record<ExpiryStatus, number> = {
  none: 0,
  ok: 1,
  soon: 2,
  expired: 3,
};

/** Statut le plus « urgent » parmi plusieurs (expired > soon > ok > none). */
export function worstExpiry(...statuses: ExpiryStatus[]): ExpiryStatus {
  return statuses.reduce<ExpiryStatus>(
    (worst, s) => (SEVERITY[s] > SEVERITY[worst] ? s : worst),
    'none'
  );
}
