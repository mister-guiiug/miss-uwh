import { useMemo, useState } from 'react';
import { ExternalLink, Plus, Target } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import {
  STRATEGY_PHASE_LABELS,
  type Strategy,
} from '../../shared/types/domain.ts';
import { Button } from '../../shared/components/Button.tsx';
import { Badge } from '../../shared/components/badges.tsx';
import { EmptyState } from '../../shared/components/EmptyState.tsx';
import { StrategySheet } from './StrategySheet.tsx';

/** Bibliothèque de stratégies de jeu (attaque, défense, transitions…). */
export function StrategiesScreen() {
  const season = useAppStore(selectActiveSeason);
  const all = useAppStore(s => s.data.strategies);
  const [editing, setEditing] = useState<Strategy | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = useMemo(
    () =>
      all
        .filter(s => s.seasonId === season.id)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [all, season.id]
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">
          {rows.length} stratégie{rows.length > 1 ? 's' : ''}
        </h2>
        <Button onClick={() => setCreating(true)}>
          <Plus size={18} aria-hidden="true" /> Stratégie
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState Icon={Target} title="Aucune stratégie">
          Constituez la bibliothèque tactique de la saison {season.label}.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map(s => (
            <li key={s.id}>
              <button
                onClick={() => setEditing(s)}
                className="flex w-full items-center gap-3 rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface)] p-3 text-left active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--uwh-text-soft)]">
                    <Badge tone="primary">
                      {STRATEGY_PHASE_LABELS[s.phase]}
                    </Badge>
                    {s.diagramUrl && (
                      <ExternalLink size={11} aria-hidden="true" />
                    )}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <StrategySheet
          open
          strategy={null}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <StrategySheet
          open
          strategy={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
