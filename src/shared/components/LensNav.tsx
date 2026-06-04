import { NavLink } from 'react-router-dom';
import { cn } from '../lib/cn.ts';
import type { Lens } from '../lib/lenses.ts';

/**
 * Barre de navigation du bas, pilotée par la config du lens actif. Couleur
 * active = accent du lens (style inline ; Tailwind v4 ne génère pas de classes
 * dynamiques). Zones tactiles ≥ 44px.
 */
export function LensNav({ lens }: { lens: Lens }) {
  return (
    <nav
      aria-label={`Navigation ${lens.label}`}
      className="sticky bottom-0 z-30 border-t border-[var(--uwh-border)] bg-[var(--uwh-surface)]/95 backdrop-blur pb-[env(safe-area-inset-bottom)] no-print"
    >
      <ul className="mx-auto flex max-w-2xl items-stretch justify-around">
        {lens.tabs.map(tab => {
          const to = `/${lens.id}${tab.to ? `/${tab.to}` : ''}`;
          return (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={tab.end ?? tab.to === ''}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-semibold',
                    !isActive && 'text-[var(--uwh-text-soft)]'
                  )
                }
                style={({ isActive }) =>
                  isActive ? { color: lens.accent } : undefined
                }
              >
                {({ isActive }) => (
                  <>
                    <tab.Icon
                      size={22}
                      strokeWidth={isActive ? 2.4 : 2}
                      aria-hidden="true"
                    />
                    <span>{tab.label}</span>
                    {isActive && <span className="sr-only">(page active)</span>}
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
