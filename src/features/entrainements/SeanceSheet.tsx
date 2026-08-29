import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Trash2, X } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import {
  type SessionPlanItem,
  type TrainingSession,
} from '../../shared/types/domain.ts';
import { Sheet } from '@mister-guiiug/dev-wpa-config/react/sheet';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import {
  SelectField,
  TextField,
} from '@mister-guiiug/dev-wpa-config/react/field';
import { ConfirmDialog } from '@mister-guiiug/dev-wpa-config/react/confirm-dialog';
import { useI18n } from '../../i18n/index.ts';
import { planTotalMinutes } from './sessionPlan.ts';

interface Props {
  open: boolean;
  session: TrainingSession | null;
  onClose: () => void;
}

export function SeanceSheet({ open, session, onClose }: Props) {
  const { t } = useI18n();
  const season = useAppStore(selectActiveSeason);
  const adherents = useAppStore(s => s.data.adherents);
  const allExercises = useAppStore(s => s.data.exercises);
  const addTrainingSession = useAppStore(s => s.addTrainingSession);
  const updateTrainingSession = useAppStore(s => s.updateTrainingSession);
  const deleteTrainingSession = useAppStore(s => s.deleteTrainingSession);

  const [date, setDate] = useState(
    session?.date ?? new Date().toISOString().slice(0, 10)
  );
  const [location, setLocation] = useState(session?.location ?? '');
  const [group, setGroup] = useState(session?.group ?? '');
  const [coachId, setCoachId] = useState(session?.coachId ?? '');
  const [focus, setFocus] = useState(session?.focus ?? '');
  const [plan, setPlan] = useState<SessionPlanItem[]>(session?.plan ?? []);
  const [attendance, setAttendance] = useState<string[]>(
    session?.attendance ?? []
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const members = useMemo(
    () => adherents.filter(a => a.seasonId === season.id),
    [adherents, season.id]
  );
  const coaches = useMemo(
    () => members.filter(a => a.roles?.includes('encadrant')),
    [members]
  );
  const exercises = useMemo(
    () => allExercises.filter(e => e.seasonId === season.id),
    [allExercises, season.id]
  );
  const exerciseById = useMemo(
    () => new Map(exercises.map(e => [e.id, e])),
    [exercises]
  );
  const planTotal = planTotalMinutes(plan, exercises);

  function toggleAttendance(id: string) {
    setAttendance(ids =>
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
    );
  }

  function addToPlan(exerciseId: string) {
    const ex = exerciseById.get(exerciseId);
    setPlan(p => [...p, { exerciseId, durationMin: ex?.durationMin }]);
  }
  function removeFromPlan(i: number) {
    setPlan(p => p.filter((_, idx) => idx !== i));
  }
  function movePlan(i: number, dir: -1 | 1) {
    setPlan(p => {
      const j = i + dir;
      if (j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }
  function patchPlan(i: number, patch: Partial<SessionPlanItem>) {
    setPlan(p => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function save() {
    const input: Omit<TrainingSession, 'id'> = {
      seasonId: session?.seasonId ?? season.id,
      date,
      location: location.trim() || undefined,
      group: group.trim() || undefined,
      coachId: coachId || undefined,
      focus: focus.trim() || undefined,
      plan,
      attendance,
    };
    if (session) updateTrainingSession(session.id, input);
    else addTrainingSession(input);
    onClose();
  }

  return (
    <Sheet
      open={open}
      title={
        session
          ? t('entrainements.seanceSheet.editTitle')
          : t('entrainements.seanceSheet.newTitle')
      }
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {session && (
            <Button
              variant="danger"
              aria-label={t('common.delete')}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={18} aria-hidden="true" />
            </Button>
          )}
          <Button block onClick={save}>
            {session ? t('common.save') : t('common.add')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t('common.date')}
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
          <TextField
            label={t('entrainements.seanceSheet.location')}
            value={location}
            onChange={e => setLocation(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t('entrainements.seanceSheet.group')}
            value={group}
            onChange={e => setGroup(e.target.value)}
            placeholder={t('entrainements.seanceSheet.groupPlaceholder')}
          />
          <SelectField
            label={t('entrainements.seanceSheet.coach')}
            value={coachId}
            onChange={e => setCoachId(e.target.value)}
          >
            <option value="">
              {t('entrainements.seanceSheet.noneOption')}
            </option>
            {coaches.map(c => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </SelectField>
        </div>
        <TextField
          label={t('entrainements.seanceSheet.focus')}
          value={focus}
          onChange={e => setFocus(e.target.value)}
        />

        <fieldset className="rounded-2xl border border-[var(--uwh-border)] p-3">
          <legend className="px-1 text-xs font-semibold text-[var(--uwh-text-soft)]">
            {t('entrainements.seanceSheet.plan')}
            {planTotal > 0 ? ` · ${planTotal} min` : ''}
          </legend>
          {exercises.length === 0 ? (
            <p className="text-xs text-[var(--uwh-text-soft)]">
              {t('entrainements.seanceSheet.noExercises')}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {plan.length > 0 && (
                <ol className="flex flex-col gap-2">
                  {plan.map((it, i) => {
                    const ex = exerciseById.get(it.exerciseId);
                    return (
                      <li
                        key={i}
                        className="rounded-xl border border-[var(--uwh-border)] p-2"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                            {i + 1}.{' '}
                            {ex?.name ??
                              t('entrainements.seanceSheet.deletedExercise')}
                          </span>
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            aria-label={t(
                              'entrainements.seanceSheet.durationAria'
                            )}
                            value={it.durationMin ?? ''}
                            placeholder={`${ex?.durationMin ?? 0}`}
                            onChange={e => {
                              const n = Number.parseInt(e.target.value, 10);
                              patchPlan(i, {
                                durationMin: Number.isNaN(n) ? undefined : n,
                              });
                            }}
                            className="tnum w-14 rounded-lg border border-[var(--uwh-border)] bg-[var(--uwh-surface-2)] px-2 py-1 text-sm"
                          />
                          <span className="text-xs text-[var(--uwh-text-soft)]">
                            min
                          </span>
                          <button
                            type="button"
                            aria-label={t('entrainements.seanceSheet.moveUp')}
                            disabled={i === 0}
                            onClick={() => movePlan(i, -1)}
                            className="text-[var(--uwh-text-soft)] disabled:opacity-30"
                          >
                            <ChevronUp size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={t('entrainements.seanceSheet.moveDown')}
                            disabled={i === plan.length - 1}
                            onClick={() => movePlan(i, 1)}
                            className="text-[var(--uwh-text-soft)] disabled:opacity-30"
                          >
                            <ChevronDown size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={t(
                              'entrainements.seanceSheet.removeFromPlan'
                            )}
                            onClick={() => removeFromPlan(i)}
                            className="text-[var(--uwh-debit)]"
                          >
                            <X size={16} aria-hidden="true" />
                          </button>
                        </div>
                        <input
                          value={it.notes ?? ''}
                          onChange={e =>
                            patchPlan(i, { notes: e.target.value })
                          }
                          placeholder={t(
                            'entrainements.seanceSheet.notePlaceholder'
                          )}
                          aria-label={t('entrainements.seanceSheet.noteAria')}
                          className="mt-1.5 w-full rounded-lg bg-[var(--uwh-surface-2)] px-2 py-1 text-xs"
                        />
                      </li>
                    );
                  })}
                </ol>
              )}
              <select
                value=""
                aria-label={t('entrainements.seanceSheet.addExerciseAria')}
                onChange={e => {
                  if (e.target.value) addToPlan(e.target.value);
                }}
                className="min-h-10 rounded-xl border border-[var(--uwh-border)] bg-[var(--uwh-surface-2)] px-3 text-sm"
              >
                <option value="">
                  {t('entrainements.seanceSheet.addExerciseOption')}
                </option>
                {exercises.map(ex => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                    {ex.durationMin ? ` (${ex.durationMin} min)` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </fieldset>

        <fieldset className="rounded-2xl border border-[var(--uwh-border)] p-3">
          <legend className="px-1 text-xs font-semibold text-[var(--uwh-text-soft)]">
            {t('entrainements.seanceSheet.attendance')}
          </legend>
          <div className="flex flex-wrap gap-2">
            {members.map(m => {
              const on = attendance.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleAttendance(m.id)}
                  className={`min-h-9 rounded-full px-3 text-sm font-semibold ${
                    on
                      ? 'bg-primary text-white'
                      : 'bg-[var(--uwh-surface-2)] text-[var(--uwh-text-soft)]'
                  }`}
                >
                  {m.firstName} {m.lastName}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t('entrainements.seanceSheet.deleteTitle')}
        destructive
        confirmLabel={t('common.delete')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (session) deleteTrainingSession(session.id);
          onClose();
          setConfirmDelete(false);
        }}
      >
        {t('entrainements.seanceSheet.deleteBody')}
      </ConfirmDialog>
    </Sheet>
  );
}
