import { useMemo, useState } from 'react';
import { Clock, Dumbbell, Plus, Sparkles } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import {
  EXERCISE_CATEGORY_LABELS,
  type Exercise,
} from '../../shared/types/domain.ts';
import { Button } from '../../shared/components/Button.tsx';
import { Badge } from '../../shared/components/badges.tsx';
import { EmptyState } from '../../shared/components/EmptyState.tsx';
import { ExerciceSheet } from './ExerciceSheet.tsx';
import { AiGenerateSheet } from './AiGenerateSheet.tsx';

/** Bibliothèque d'exercices (drills) réutilisables en séance. */
export function ExercicesScreen() {
  const season = useAppStore(selectActiveSeason);
  const all = useAppStore(s => s.data.exercises);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);

  const rows = useMemo(
    () =>
      all
        .filter(e => e.seasonId === season.id)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [all, season.id]
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">
          {rows.length} exercice{rows.length > 1 ? 's' : ''}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setGenerating(true)}>
            <Sparkles size={18} aria-hidden="true" /> IA
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus size={18} aria-hidden="true" /> Exercice
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState Icon={Dumbbell} title="Bibliothèque vide">
          Constituez votre catalogue d'exercices pour la saison {season.label}.
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
                  <p className="truncate text-sm font-semibold">{e.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--uwh-text-soft)]">
                    <Badge tone="primary">
                      {EXERCISE_CATEGORY_LABELS[e.category]}
                    </Badge>
                    {e.durationMin != null && (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} aria-hidden="true" />
                        {e.durationMin} min
                      </span>
                    )}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <AiGenerateSheet open={generating} onClose={() => setGenerating(false)} />

      {creating && (
        <ExerciceSheet
          open
          exercise={null}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <ExerciceSheet
          open
          exercise={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
