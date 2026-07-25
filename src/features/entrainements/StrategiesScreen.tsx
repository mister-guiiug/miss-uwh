import { useMemo, useState } from 'react';
import { ExternalLink, Plus, Target } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { type Strategy } from '../../shared/types/domain.ts';
import { Button } from '../../shared/components/Button.tsx';
import { Badge } from '../../shared/components/badges.tsx';
import { EmptyState } from '../../shared/components/EmptyState.tsx';
import { useI18n, type TKey } from '../../i18n/index.ts';
import { StrategySheet } from './StrategySheet.tsx';

/** Bibliothèque de stratégies de jeu (attaque, défense, transitions…). */
export function StrategiesScreen() {
  const { t } = useI18n();
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
          {t('entrainements.strategies.count', { n: rows.length })}
        </h2>
        <Button onClick={() => setCreating(true)}>
          <Plus size={18} aria-hidden="true" />{' '}
          {t('entrainements.strategies.add')}
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          Icon={Target}
          title={t('entrainements.strategies.emptyTitle')}
        >
          {t('entrainements.strategies.emptyBody', { season: season.label })}
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
                      {t(`enums.strategyPhase.${s.phase}` as TKey)}
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
