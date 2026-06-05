import { useMemo, useState } from 'react';
import { Flag, Plus } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import type { Referee } from '../../shared/types/domain.ts';
import { Button } from '../../shared/components/Button.tsx';
import { Badge } from '../../shared/components/badges.tsx';
import { EmptyState } from '../../shared/components/EmptyState.tsx';
import { RefereeSheet } from './RefereeSheet.tsx';

/** Registre des arbitres du club (niveaux, certifications). */
export function ArbitrageScreen() {
  const season = useAppStore(selectActiveSeason);
  const all = useAppStore(s => s.data.referees);
  const [editing, setEditing] = useState<Referee | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = useMemo(
    () =>
      all
        .filter(r => r.seasonId === season.id)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [all, season.id]
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">
          {rows.length} arbitre{rows.length > 1 ? 's' : ''}
        </h2>
        <Button onClick={() => setCreating(true)}>
          <Plus size={18} aria-hidden="true" /> Arbitre
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState Icon={Flag} title="Aucun arbitre">
          Tenez le registre des arbitres de la saison {season.label}.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map(r => (
            <li key={r.id}>
              <button
                onClick={() => setEditing(r)}
                className="flex w-full items-center gap-3 rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface)] p-3 text-left active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {r.name}
                    {!r.active && (
                      <span className="font-normal text-[var(--uwh-text-soft)]">
                        {' '}
                        (inactif)
                      </span>
                    )}
                  </p>
                  {r.level && (
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--uwh-text-soft)]">
                      <Badge tone="primary">{r.level}</Badge>
                    </p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <RefereeSheet open referee={null} onClose={() => setCreating(false)} />
      )}
      {editing && (
        <RefereeSheet open referee={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
