import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '../../auth/useAuth.ts';
import { accessibleLenses } from '../../shared/lib/lenses.ts';
import { Card } from '../../shared/components/Card.tsx';
import { EmptyState } from '../../shared/components/EmptyState.tsx';

/**
 * Écran d'accueil (lanceur) : une carte par espace (« Lens ») accessible à
 * l'utilisateur. Point d'entrée de l'app après onboarding / connexion.
 */
export function HomeLauncher() {
  const { roles } = useAuth();
  const lenses = accessibleLenses(roles);

  if (lenses.length === 0) {
    return (
      <EmptyState Icon={Lock} title="Aucun espace accessible">
        Demandez à un administrateur du club de vous attribuer un rôle.
      </EmptyState>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 p-4">
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
              <h2 className="font-display text-base font-bold">{lens.label}</h2>
              <p className="mt-1 text-xs text-[var(--uwh-text-soft)]">
                {lens.description}
              </p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
