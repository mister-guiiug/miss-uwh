import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { type TrainingSession } from '../../shared/types/domain.ts';
import { Sheet } from '../../shared/components/Sheet.tsx';
import { Button } from '../../shared/components/Button.tsx';
import { SelectField, TextField } from '../../shared/components/Field.tsx';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog.tsx';

interface Props {
  open: boolean;
  session: TrainingSession | null;
  onClose: () => void;
}

export function SeanceSheet({ open, session, onClose }: Props) {
  const season = useAppStore(selectActiveSeason);
  const adherents = useAppStore(s => s.data.adherents);
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

  function toggleAttendance(id: string) {
    setAttendance(ids =>
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
    );
  }

  function save() {
    const input: Omit<TrainingSession, 'id'> = {
      seasonId: session?.seasonId ?? season.id,
      date,
      location: location.trim() || undefined,
      group: group.trim() || undefined,
      coachId: coachId || undefined,
      focus: focus.trim() || undefined,
      attendance,
    };
    if (session) updateTrainingSession(session.id, input);
    else addTrainingSession(input);
    onClose();
  }

  return (
    <Sheet
      open={open}
      title={session ? 'Modifier la séance' : 'Nouvelle séance'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {session && (
            <Button
              variant="danger"
              aria-label="Supprimer"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={18} aria-hidden="true" />
            </Button>
          )}
          <Button block onClick={save}>
            {session ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
          <TextField
            label="Lieu (optionnel)"
            value={location}
            onChange={e => setLocation(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Groupe (optionnel)"
            value={group}
            onChange={e => setGroup(e.target.value)}
            placeholder="Compét / Loisir / Jeunes"
          />
          <SelectField
            label="Encadrant"
            value={coachId}
            onChange={e => setCoachId(e.target.value)}
          >
            <option value="">— Aucun —</option>
            {coaches.map(c => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </SelectField>
        </div>
        <TextField
          label="Thème (optionnel)"
          value={focus}
          onChange={e => setFocus(e.target.value)}
        />

        <fieldset className="rounded-2xl border border-[var(--uwh-border)] p-3">
          <legend className="px-1 text-xs font-semibold text-[var(--uwh-text-soft)]">
            Présences
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
        title="Supprimer cette séance ?"
        danger
        confirmLabel="Supprimer"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (session) deleteTrainingSession(session.id);
          onClose();
        }}
      >
        La séance sera retirée du planning.
      </ConfirmDialog>
    </Sheet>
  );
}
