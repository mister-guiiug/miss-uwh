import { useMemo, useState } from 'react';
import { MapPin, Plus, Trophy } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import {
  TOURNAMENT_STATUS_LABELS,
  type Tournament,
} from '../../shared/types/domain.ts';
import { formatDateShort } from '../../shared/lib/format.ts';
import { Button } from '../../shared/components/Button.tsx';
import { Badge } from '../../shared/components/badges.tsx';
import { EmptyState } from '../../shared/components/EmptyState.tsx';
import { TournamentSheet } from './TournamentSheet.tsx';

/** Tournois de la saison (prévus, en cours, terminés). */
export function TournamentsScreen() {
  const season = useAppStore(selectActiveSeason);
  const all = useAppStore(s => s.data.tournaments);
  const [editing, setEditing] = useState<Tournament | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = useMemo(
    () =>
      all
        .filter(a => a.seasonId === season.id)
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    [all, season.id]
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">
          {rows.length} tournoi{rows.length > 1 ? 's' : ''}
        </h2>
        <Button onClick={() => setCreating(true)}>
          <Plus size={18} aria-hidden="true" /> Tournoi
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState Icon={Trophy} title="Aucun tournoi">
          Planifiez les tournois de la saison {season.label}.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map(t => (
            <li key={t.id}>
              <button
                onClick={() => setEditing(t)}
                className="flex w-full items-center gap-3 rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface)] p-3 text-left active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--uwh-text-soft)]">
                    <Badge tone="primary">
                      {TOURNAMENT_STATUS_LABELS[t.status]}
                    </Badge>
                    <span>{formatDateShort(t.date)}</span>
                    {t.location && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <MapPin size={11} aria-hidden="true" />
                        <span className="truncate">{t.location}</span>
                      </span>
                    )}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <TournamentSheet
          open
          tournament={null}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <TournamentSheet
          open
          tournament={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
