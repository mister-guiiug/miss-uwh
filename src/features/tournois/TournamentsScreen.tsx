import { useMemo, useState } from 'react';
import { MapPin, Plus, Trophy } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { type Tournament } from '../../shared/types/domain.ts';
import { useI18n, type TKey } from '../../i18n/index.ts';
import { formatDateShort } from '../../shared/lib/format.ts';
import { Button } from '../../shared/components/Button.tsx';
import { Badge } from '../../shared/components/badges.tsx';
import { EmptyState } from '../../shared/components/EmptyState.tsx';
import { TournamentSheet } from './TournamentSheet.tsx';

/** Tournois de la saison (prévus, en cours, terminés). */
export function TournamentsScreen() {
  const { t } = useI18n();
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
          {t('vieclub.tournois.count', { n: rows.length })}
        </h2>
        <Button onClick={() => setCreating(true)}>
          <Plus size={18} aria-hidden="true" />{' '}
          {t('vieclub.tournois.addButton')}
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState Icon={Trophy} title={t('vieclub.tournois.emptyTitle')}>
          {t('vieclub.tournois.emptyBody', { season: season.label })}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map(tournament => (
            <li key={tournament.id}>
              <button
                onClick={() => setEditing(tournament)}
                className="flex w-full items-center gap-3 rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface)] p-3 text-left active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {tournament.name}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--uwh-text-soft)]">
                    <Badge tone="primary">
                      {t(`enums.tournamentStatus.${tournament.status}` as TKey)}
                    </Badge>
                    <span>{formatDateShort(tournament.date)}</span>
                    {tournament.location && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <MapPin size={11} aria-hidden="true" />
                        <span className="truncate">{tournament.location}</span>
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
