import { useMemo, useState } from 'react';
import { CalendarClock, ListChecks, Plus, Target, Users } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { type TrainingSession } from '../../shared/types/domain.ts';
import { formatDateShort } from '../../shared/lib/format.ts';
import { Button } from '../../shared/components/Button.tsx';
import { Badge } from '../../shared/components/badges.tsx';
import { EmptyState } from '../../shared/components/EmptyState.tsx';
import { SeanceSheet } from './SeanceSheet.tsx';
import { planTotalMinutes } from './sessionPlan.ts';

/** Planning des séances d'entraînement et suivi des présences. */
export function SeancesScreen() {
  const season = useAppStore(selectActiveSeason);
  const all = useAppStore(s => s.data.trainingSessions);
  const exercises = useAppStore(s => s.data.exercises);
  const [editing, setEditing] = useState<TrainingSession | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = useMemo(
    () =>
      all
        .filter(s => s.seasonId === season.id)
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    [all, season.id]
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">
          {rows.length} séance{rows.length > 1 ? 's' : ''}
        </h2>
        <Button onClick={() => setCreating(true)}>
          <Plus size={18} aria-hidden="true" /> Séance
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState Icon={CalendarClock} title="Aucune séance">
          Planifiez les entraînements et leurs présences pour la saison{' '}
          {season.label}.
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
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                    <span>{formatDateShort(s.date)}</span>
                    {s.group && <Badge tone="primary">{s.group}</Badge>}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--uwh-text-soft)]">
                    {s.focus && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <Target size={11} aria-hidden="true" />
                        <span className="truncate">{s.focus}</span>
                      </span>
                    )}
                    {s.plan && s.plan.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <ListChecks size={11} aria-hidden="true" />
                        {s.plan.length} exo{s.plan.length > 1 ? 's' : ''}
                        {planTotalMinutes(s.plan, exercises) > 0 &&
                          ` · ${planTotalMinutes(s.plan, exercises)} min`}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Users size={11} aria-hidden="true" />
                      {s.attendance.length} présent
                      {s.attendance.length > 1 ? 's' : ''}
                    </span>
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <SeanceSheet open session={null} onClose={() => setCreating(false)} />
      )}
      {editing && (
        <SeanceSheet open session={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
