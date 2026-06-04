import { useMemo, useState } from 'react';
import { CalendarDays, MapPin, Plus } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import {
  CLUB_EVENT_TYPE_LABELS,
  type ClubEvent,
} from '../../shared/types/domain.ts';
import { formatDateShort } from '../../shared/lib/format.ts';
import { Button } from '../../shared/components/Button.tsx';
import { Badge } from '../../shared/components/badges.tsx';
import { EmptyState } from '../../shared/components/EmptyState.tsx';
import { ClubEventSheet } from './ClubEventSheet.tsx';

/** Agenda de la vie du club (réunions, sorties, AG, soirées…). */
export function EvenementsScreen() {
  const season = useAppStore(selectActiveSeason);
  const all = useAppStore(s => s.data.clubEvents);
  const [editing, setEditing] = useState<ClubEvent | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = useMemo(
    () =>
      all
        .filter(e => e.seasonId === season.id)
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    [all, season.id]
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">
          {rows.length} événement{rows.length > 1 ? 's' : ''}
        </h2>
        <Button onClick={() => setCreating(true)}>
          <Plus size={18} aria-hidden="true" /> Événement
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState Icon={CalendarDays} title="Agenda vide">
          Planifiez réunions, sorties, AG et soirées de la saison {season.label}
          .
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map(e => (
            <li key={e.id}>
              <button
                onClick={() => setEditing(e)}
                className="flex w-full items-center gap-3 rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface)] p-3 text-left active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{e.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--uwh-text-soft)]">
                    <Badge tone="primary">
                      {CLUB_EVENT_TYPE_LABELS[e.type]}
                    </Badge>
                    <span>{formatDateShort(e.date)}</span>
                    {e.location && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <MapPin size={11} aria-hidden="true" />
                        <span className="truncate">{e.location}</span>
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
        <ClubEventSheet open event={null} onClose={() => setCreating(false)} />
      )}
      {editing && (
        <ClubEventSheet open event={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
