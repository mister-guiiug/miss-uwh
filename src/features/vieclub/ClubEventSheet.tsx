import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import {
  CLUB_EVENT_TYPES,
  CLUB_EVENT_TYPE_LABELS,
  type ClubEvent,
  type ClubEventType,
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
  event: ClubEvent | null;
  onClose: () => void;
}

export function ClubEventSheet({ open, event, onClose }: Props) {
  const season = useAppStore(selectActiveSeason);
  const addClubEvent = useAppStore(s => s.addClubEvent);
  const updateClubEvent = useAppStore(s => s.updateClubEvent);
  const deleteClubEvent = useAppStore(s => s.deleteClubEvent);

  const [date, setDate] = useState(
    event?.date ?? new Date().toISOString().slice(0, 10)
  );
  const [title, setTitle] = useState(event?.title ?? '');
  const [type, setType] = useState<ClubEventType>(event?.type ?? 'reunion');
  const [location, setLocation] = useState(event?.location ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const titleError = submitted && !title.trim() ? 'Titre requis.' : undefined;

  function save() {
    setSubmitted(true);
    if (!title.trim()) return;
    const input: Omit<ClubEvent, 'id'> = {
      seasonId: event?.seasonId ?? season.id,
      date,
      title: title.trim(),
      type,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
    };
    if (event) updateClubEvent(event.id, input);
    else addClubEvent(input);
    onClose();
  }

  return (
    <Sheet
      open={open}
      title={event ? "Modifier l'événement" : 'Nouvel événement'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {event && (
            <Button
              variant="danger"
              aria-label="Supprimer"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={18} aria-hidden="true" />
            </Button>
          )}
          <Button block onClick={save}>
            {event ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="Titre"
          value={title}
          error={titleError}
          onChange={e => setTitle(e.target.value)}
          placeholder="Ex. Assemblée générale"
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
          <SelectField
            label="Type"
            value={type}
            onChange={e => setType(e.target.value as ClubEventType)}
          >
            {CLUB_EVENT_TYPES.map(t => (
              <option key={t} value={t}>
                {CLUB_EVENT_TYPE_LABELS[t]}
              </option>
            ))}
          </SelectField>
        </div>
        <TextField
          label="Lieu (optionnel)"
          value={location}
          onChange={e => setLocation(e.target.value)}
        />
        <TextAreaField
          label="Description (optionnel)"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer cet événement ?"
        danger
        confirmLabel="Supprimer"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (event) deleteClubEvent(event.id);
          onClose();
        }}
      >
        L'événement sera retiré de l'agenda.
      </ConfirmDialog>
    </Sheet>
  );
}
