import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import {
  EXERCISE_CATEGORIES,
  type Exercise,
  type ExerciseCategory,
} from '../../shared/types/domain.ts';
import { Sheet } from '@mister-guiiug/dev-pwa-config/react/sheet';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import {
  SelectField,
  TextAreaField,
  TextField,
} from '@mister-guiiug/dev-pwa-config/react/field';
import { ConfirmDialog } from '@mister-guiiug/dev-pwa-config/react/confirm-dialog';
import { useI18n, type TKey } from '../../i18n/index.ts';

interface Props {
  open: boolean;
  exercise: Exercise | null;
  onClose: () => void;
}

export function ExerciceSheet({ open, exercise, onClose }: Props) {
  const { t } = useI18n();
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

  const nameError =
    submitted && !name.trim()
      ? t('entrainements.exerciceSheet.nameRequired')
      : undefined;

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
      title={
        exercise
          ? t('entrainements.exerciceSheet.editTitle')
          : t('entrainements.exerciceSheet.newTitle')
      }
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {exercise && (
            <Button
              variant="danger"
              aria-label={t('common.delete')}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={18} aria-hidden="true" />
            </Button>
          )}
          <Button block onClick={save}>
            {exercise ? t('common.save') : t('common.add')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label={t('common.name')}
          value={name}
          error={nameError}
          onChange={e => setName(e.target.value)}
          placeholder={t('entrainements.exerciceSheet.namePlaceholder')}
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label={t('common.category')}
            value={category}
            onChange={e => setCategory(e.target.value as ExerciseCategory)}
          >
            {EXERCISE_CATEGORIES.map(c => (
              <option key={c} value={c}>
                {t(`enums.exerciseCategory.${c}` as TKey)}
              </option>
            ))}
          </SelectField>
          <TextField
            label={t('entrainements.exerciceSheet.duration')}
            inputMode="numeric"
            value={durationMin}
            onChange={e => setDurationMin(e.target.value)}
          />
        </div>
        <TextField
          label={t('entrainements.exerciceSheet.level')}
          value={level}
          onChange={e => setLevel(e.target.value)}
        />
        <TextAreaField
          label={t('entrainements.exerciceSheet.description')}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t('entrainements.exerciceSheet.deleteTitle')}
        destructive
        confirmLabel={t('common.delete')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (exercise) deleteExercise(exercise.id);
          onClose();
          setConfirmDelete(false);
        }}
      >
        {t('entrainements.exerciceSheet.deleteBody')}
      </ConfirmDialog>
    </Sheet>
  );
}
