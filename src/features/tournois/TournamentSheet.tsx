import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import {
  TOURNAMENT_STATUSES,
  TOURNAMENT_STATUS_LABELS,
  type Tournament,
  type TournamentStatus,
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
  tournament: Tournament | null;
  onClose: () => void;
}

export function TournamentSheet({ open, tournament, onClose }: Props) {
  const season = useAppStore(selectActiveSeason);
  const addTournament = useAppStore(s => s.addTournament);
  const updateTournament = useAppStore(s => s.updateTournament);
  const deleteTournament = useAppStore(s => s.deleteTournament);

  const [name, setName] = useState(tournament?.name ?? '');
  const [date, setDate] = useState(
    tournament?.date ?? new Date().toISOString().slice(0, 10)
  );
  const [location, setLocation] = useState(tournament?.location ?? '');
  const [status, setStatus] = useState<TournamentStatus>(
    tournament?.status ?? 'prevu'
  );
  const [notes, setNotes] = useState(tournament?.notes ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const nameError = submitted && !name.trim() ? 'Nom requis.' : undefined;

  function save() {
    setSubmitted(true);
    if (!name.trim()) return;
    const input: Omit<Tournament, 'id'> = {
      seasonId: tournament?.seasonId ?? season.id,
      name: name.trim(),
      date,
      location: location.trim() || undefined,
      status,
      notes: notes.trim() || undefined,
    };
    if (tournament) updateTournament(tournament.id, input);
    else addTournament(input);
    onClose();
  }

  return (
    <Sheet
      open={open}
      title={tournament ? 'Modifier le tournoi' : 'Nouveau tournoi'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {tournament && (
            <Button
              variant="danger"
              aria-label="Supprimer"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={18} aria-hidden="true" />
            </Button>
          )}
          <Button block onClick={save}>
            {tournament ? 'Enregistrer' : 'Ajouter'}
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
          placeholder="Ex. Tournoi de printemps"
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
          <SelectField
            label="Statut"
            value={status}
            onChange={e => setStatus(e.target.value as TournamentStatus)}
          >
            {TOURNAMENT_STATUSES.map(s => (
              <option key={s} value={s}>
                {TOURNAMENT_STATUS_LABELS[s]}
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
          label="Notes (optionnel)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer ce tournoi ?"
        danger
        confirmLabel="Supprimer"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (tournament) deleteTournament(tournament.id);
          onClose();
        }}
      >
        Le tournoi sera retiré de la liste.
      </ConfirmDialog>
    </Sheet>
  );
}
