import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '../../auth/useAuth.ts';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { useBilan } from '../../shared/hooks/useBilan.ts';
import {
  accessibleLenses,
  canAccessLens,
  lensById,
} from '../../shared/lib/lenses.ts';
import { expiryStatus, worstExpiry } from '../../shared/lib/expiry.ts';
import { formatEuro } from '../../shared/lib/format.ts';
import { Card } from '../../shared/components/Card.tsx';
import { Badge } from '../../shared/components/badges.tsx';
import { EmptyState } from '../../shared/components/EmptyState.tsx';

/**
 * Carte de synthèse trésorier de la saison active : trésorerie, solde, et
 * « à faire » (cotisations impayées, échéances licence/certificat médical).
 */
function SeasonSummary() {
  const season = useAppStore(selectActiveSeason);
  const adherents = useAppStore(s => s.data.adherents);
  const { bilan } = useBilan();

  const inSeason = adherents.filter(a => a.seasonId === season.id);
  const unpaid = inSeason.filter(a => !a.paid).length;
  const expiring = inSeason.filter(a => {
    const s = worstExpiry(
      expiryStatus(a.licenceExpiry),
      expiryStatus(a.medicalCertExpiry)
    );
    return s === 'soon' || s === 'expired';
  }).length;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold">
          Saison {season.label}
        </h2>
        {season.status === 'cloturee' && (
          <Badge tone="warn">
            <Lock size={12} aria-hidden="true" /> clôturée
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-[var(--uwh-surface-2)] p-3">
          <p className="text-xs text-[var(--uwh-text-soft)]">Trésorerie</p>
          <p className="tnum text-lg font-bold">
            {formatEuro(bilan.tresorerie)}
          </p>
        </div>
        <div className="rounded-2xl bg-[var(--uwh-surface-2)] p-3">
          <p className="text-xs text-[var(--uwh-text-soft)]">Solde créditeur</p>
          <p className="tnum text-lg font-bold">
            {formatEuro(bilan.soldeCrediteur)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {unpaid > 0 && (
          <Link to="/adherents/cotisations">
            <Badge tone="warn">
              {unpaid} cotisation{unpaid > 1 ? 's' : ''} impayée
              {unpaid > 1 ? 's' : ''}
            </Badge>
          </Link>
        )}
        {expiring > 0 && (
          <Link to="/adherents">
            <Badge tone="debit">
              {expiring} échéance{expiring > 1 ? 's' : ''} licence/certificat
            </Badge>
          </Link>
        )}
        {unpaid === 0 && expiring === 0 && (
          <Badge tone="credit">Rien à signaler</Badge>
        )}
      </div>
    </Card>
  );
}

/**
 * Écran d'accueil (lanceur) : synthèse trésorier (si accès Finances) + une carte
 * par espace (« Lens ») accessible. Point d'entrée après onboarding / connexion.
 */
export function HomeLauncher() {
  const { roles } = useAuth();
  const lenses = accessibleLenses(roles);
  const showSummary = canAccessLens(roles, lensById('finances')!);

  if (lenses.length === 0) {
    return (
      <EmptyState Icon={Lock} title="Aucun espace accessible">
        Demandez à un administrateur du club de vous attribuer un rôle.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {showSummary && <SeasonSummary />}

      <div className="grid grid-cols-2 gap-4">
        {lenses.map(lens => (
          <Link
            key={lens.id}
            to={`/${lens.id}`}
            className="block transition-transform active:scale-[0.98]"
          >
            <Card className="flex h-full flex-col gap-3">
              <div
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{
                  background: `color-mix(in srgb, ${lens.accent} 15%, transparent)`,
                  color: lens.accent,
                }}
              >
                <lens.Icon size={26} aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold">
                  {lens.label}
                </h2>
                <p className="mt-1 text-xs text-[var(--uwh-text-soft)]">
                  {lens.description}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
