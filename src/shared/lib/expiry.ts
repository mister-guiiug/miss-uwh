import type { Adherent } from '../types/domain.ts';

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

// ── Les échéances à venir d'une saison (rappels d'agenda) ────────────

/**
 * La nature d'une échéance. Ce sont les deux dates que porte le registre des
 * adhérents (`licenceExpiry`, `medicalCertExpiry`). Les assurances n'en ont
 * PAS : elles n'existent dans l'app que comme composantes tarifaires d'une
 * écriture (R1, D2), sans date d'échéance — rien à rappeler, donc.
 */
export type DeadlineKind = 'licence' | 'medicalCert';

export interface Deadline {
  adherent: Adherent;
  kind: DeadlineKind;
  /** Date ISO `yyyy-mm-dd`. */
  date: string;
}

/**
 * Les échéances À VENIR (aujourd'hui compris) des adhérents d'une saison,
 * triées par date puis par nom. Les échéances passées n'en font pas partie :
 * un rappel ne sonne pas dans le passé, et les alertes de l'app les signalent
 * déjà. Les mêmes adhérents que ces alertes — tous ceux de la saison. Pur :
 * `today` est injectable.
 */
export function upcomingDeadlines(
  adherents: readonly Adherent[],
  seasonId: string,
  today: Date = new Date()
): Deadline[] {
  const out: Deadline[] = [];
  for (const adherent of adherents) {
    if (adherent.seasonId !== seasonId) continue;
    const dates: Array<[DeadlineKind, string | undefined]> = [
      ['licence', adherent.licenceExpiry],
      ['medicalCert', adherent.medicalCertExpiry],
    ];
    for (const [kind, date] of dates) {
      const status = expiryStatus(date, 30, today);
      if (date && (status === 'ok' || status === 'soon'))
        out.push({ adherent, kind, date });
    }
  }
  return out.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      `${a.adherent.lastName} ${a.adherent.firstName}`.localeCompare(
        `${b.adherent.lastName} ${b.adherent.firstName}`,
        'fr'
      ) ||
      a.kind.localeCompare(b.kind)
  );
}
