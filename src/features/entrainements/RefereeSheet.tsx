import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import type { Referee } from '../../shared/types/domain.ts';
import { Sheet } from '../../shared/components/Sheet.tsx';
import { Button } from '../../shared/components/Button.tsx';
import { TextField } from '../../shared/components/Field.tsx';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog.tsx';

interface Props {
  open: boolean;
  referee: Referee | null;
  onClose: () => void;
}

export function RefereeSheet({ open, referee, onClose }: Props) {
  const season = useAppStore(selectActiveSeason);
  const addReferee = useAppStore(s => s.addReferee);
  const updateReferee = useAppStore(s => s.updateReferee);
  const deleteReferee = useAppStore(s => s.deleteReferee);

  const [name, setName] = useState(referee?.name ?? '');
  const [level, setLevel] = useState(referee?.level ?? '');
  const [certifications, setCertifications] = useState(
    referee?.certifications ?? ''
  );
  const [active, setActive] = useState(referee?.active ?? true);
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const nameError = submitted && !name.trim() ? 'Nom requis.' : undefined;

  function save() {
    setSubmitted(true);
    if (!name.trim()) return;
    const input: Omit<Referee, 'id'> = {
      seasonId: referee?.seasonId ?? season.id,
      name: name.trim(),
      level: level.trim() || undefined,
      certifications: certifications.trim() || undefined,
      active,
    };
    if (referee) updateReferee(referee.id, input);
    else addReferee(input);
    onClose();
  }

  return (
    <Sheet
      open={open}
      title={referee ? "Modifier l'arbitre" : 'Nouvel arbitre'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {referee && (
            <Button
              variant="danger"
              aria-label="Supprimer"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={18} aria-hidden="true" />
            </Button>
          )}
          <Button block onClick={save}>
            {referee ? 'Enregistrer' : 'Ajouter'}
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
          placeholder="Ex. Camille Martin"
        />
        <TextField
          label="Niveau (optionnel)"
          value={level}
          onChange={e => setLevel(e.target.value)}
          placeholder="Départemental / Régional / National"
        />
        <TextField
          label="Certifications (optionnel)"
          value={certifications}
          onChange={e => setCertifications(e.target.value)}
        />
        <label className="flex items-center justify-between gap-2 text-sm font-semibold">
          Actif
          <input
            type="checkbox"
            checked={active}
            onChange={e => setActive(e.target.checked)}
          />
        </label>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer cet arbitre ?"
        danger
        confirmLabel="Supprimer"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (referee) deleteReferee(referee.id);
          onClose();
        }}
      >
        L'arbitre sera retiré du registre.
      </ConfirmDialog>
    </Sheet>
  );
}
