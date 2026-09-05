import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import {
  TOURNAMENT_STATUSES,
  type Tournament,
  type TournamentStatus,
} from '../../shared/types/domain.ts';
import { useI18n, type TKey } from '../../i18n/index.ts';
import { Sheet } from '@mister-guiiug/dev-pwa-config/react/sheet';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import {
  SelectField,
  TextAreaField,
  TextField,
} from '@mister-guiiug/dev-pwa-config/react/field';
import { ConfirmDialog } from '@mister-guiiug/dev-pwa-config/react/confirm-dialog';

interface Props {
  open: boolean;
  tournament: Tournament | null;
  onClose: () => void;
}

export function TournamentSheet({ open, tournament, onClose }: Props) {
  const { t } = useI18n();
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

  const nameError =
    submitted && !name.trim()
      ? t('vieclub.tournamentSheet.nameRequired')
      : undefined;

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
      title={
        tournament
          ? t('vieclub.tournamentSheet.editTitle')
          : t('vieclub.tournamentSheet.newTitle')
      }
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {tournament && (
            <Button
              variant="danger"
              aria-label={t('common.delete')}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={18} aria-hidden="true" />
            </Button>
          )}
          <Button block onClick={save}>
            {tournament ? t('common.save') : t('common.add')}
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
          placeholder={t('vieclub.tournamentSheet.namePlaceholder')}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t('common.date')}
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
          <SelectField
            label={t('common.status')}
            value={status}
            onChange={e => setStatus(e.target.value as TournamentStatus)}
          >
            {TOURNAMENT_STATUSES.map(s => (
              <option key={s} value={s}>
                {t(`enums.tournamentStatus.${s}` as TKey)}
              </option>
            ))}
          </SelectField>
        </div>
        <TextField
          label={t('vieclub.tournamentSheet.locationOptional')}
          value={location}
          onChange={e => setLocation(e.target.value)}
        />
        <TextAreaField
          label={t('vieclub.tournamentSheet.notesOptional')}
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t('vieclub.tournamentSheet.confirmDeleteTitle')}
        destructive
        confirmLabel={t('common.delete')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (tournament) deleteTournament(tournament.id);
          onClose();
          setConfirmDelete(false);
        }}
      >
        {t('vieclub.tournamentSheet.confirmDeleteBody')}
      </ConfirmDialog>
    </Sheet>
  );
}
