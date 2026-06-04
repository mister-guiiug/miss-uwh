import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import {
  EXERCISE_CATEGORIES,
  EXERCISE_CATEGORY_LABELS,
  type Exercise,
  type ExerciseCategory,
} from '../../shared/types/domain.ts';
import { Sheet } from '../../shared/components/Sheet.tsx';
import { Button } from '../../shared/components/Button.tsx';
import {
  SelectField,
  TextAreaField,
  TextField,
} from '../../shared/components/Field.tsx';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog.tsx';

interface Props {
  open: boolean;
  exercise: Exercise | null;
  onClose: () => void;
}

export function ExerciceSheet({ open, exercise, onClose }: Props) {
  const season = useAppStore(selectActiveSeason);
  const addExercise = useAppStore(s => s.addExercise);
  const updateExercise = useAppStore(s => s.updateExercise);
  const deleteExercise = useAppStore(s => s.deleteExercise);

  const [name, setName] = useState(exercise?.name ?? '');
  const [category, setCategory] = useState<ExerciseCategory>(
    exercise?.category ?? 'echauffement'
  );
  const [durationMin, setDurationMin] = useState(
    exercise?.durationMin != null ? String(exercise.durationMin) : ''
  );
  const [level, setLevel] = useState(exercise?.level ?? '');
  const [description, setDescription] = useState(exercise?.description ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const nameError = submitted && !name.trim() ? 'Nom requis.' : undefined;

  function save() {
    setSubmitted(true);
    if (!name.trim()) return;
    const duration = Number.parseInt(durationMin, 10);
    const input: Omit<Exercise, 'id'> = {
      seasonId: exercise?.seasonId ?? season.id,
      name: name.trim(),
      category,
      durationMin: Number.isNaN(duration) ? undefined : duration,
      level: level.trim() || undefined,
      description: description.trim() || undefined,
    };
    if (exercise) updateExercise(exercise.id, input);
    else addExercise(input);
    onClose();
  }

  return (
    <Sheet
      open={open}
      title={exercise ? "Modifier l'exercice" : 'Nouvel exercice'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {exercise && (
            <Button
              variant="danger"
              aria-label="Supprimer"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={18} aria-hidden="true" />
            </Button>
          )}
          <Button block onClick={save}>
            {exercise ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="Nom"
          value={name}
          error={nameError}
          onChange={e => setName(e.target.value)}
          placeholder="Ex. Passes en triangle"
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Catégorie"
            value={category}
            onChange={e => setCategory(e.target.value as ExerciseCategory)}
          >
            {EXERCISE_CATEGORIES.map(c => (
              <option key={c} value={c}>
                {EXERCISE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Durée (min)"
            inputMode="numeric"
            value={durationMin}
            onChange={e => setDurationMin(e.target.value)}
          />
        </div>
        <TextField
          label="Niveau (optionnel)"
          value={level}
          onChange={e => setLevel(e.target.value)}
        />
        <TextAreaField
          label="Description (optionnel)"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer cet exercice ?"
        danger
        confirmLabel="Supprimer"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (exercise) deleteExercise(exercise.id);
          onClose();
        }}
      >
        L'exercice sera retiré de la bibliothèque.
      </ConfirmDialog>
    </Sheet>
  );
}
