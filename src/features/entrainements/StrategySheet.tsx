import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import {
  STRATEGY_PHASES,
  STRATEGY_PHASE_LABELS,
  type Strategy,
  type StrategyPhase,
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
  strategy: Strategy | null;
  onClose: () => void;
}

export function StrategySheet({ open, strategy, onClose }: Props) {
  const season = useAppStore(selectActiveSeason);
  const addStrategy = useAppStore(s => s.addStrategy);
  const updateStrategy = useAppStore(s => s.updateStrategy);
  const deleteStrategy = useAppStore(s => s.deleteStrategy);

  const [name, setName] = useState(strategy?.name ?? '');
  const [phase, setPhase] = useState<StrategyPhase>(
    strategy?.phase ?? 'attaque'
  );
  const [description, setDescription] = useState(strategy?.description ?? '');
  const [diagramUrl, setDiagramUrl] = useState(strategy?.diagramUrl ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const nameError = submitted && !name.trim() ? 'Nom requis.' : undefined;

  function save() {
    setSubmitted(true);
    if (!name.trim()) return;
    const input: Omit<Strategy, 'id'> = {
      seasonId: strategy?.seasonId ?? season.id,
      name: name.trim(),
      phase,
      description: description.trim() || undefined,
      diagramUrl: diagramUrl.trim() || undefined,
    };
    if (strategy) updateStrategy(strategy.id, input);
    else addStrategy(input);
    onClose();
  }

  return (
    <Sheet
      open={open}
      title={strategy ? 'Modifier la stratégie' : 'Nouvelle stratégie'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {strategy && (
            <Button
              variant="danger"
              aria-label="Supprimer"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={18} aria-hidden="true" />
            </Button>
          )}
          <Button block onClick={save}>
            {strategy ? 'Enregistrer' : 'Ajouter'}
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
          placeholder="Ex. Pressing haut"
        />
        <SelectField
          label="Phase"
          value={phase}
          onChange={e => setPhase(e.target.value as StrategyPhase)}
        >
          {STRATEGY_PHASES.map(p => (
            <option key={p} value={p}>
              {STRATEGY_PHASE_LABELS[p]}
            </option>
          ))}
        </SelectField>
        <TextAreaField
          label="Description (optionnel)"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
        <TextField
          label="Schéma (optionnel)"
          value={diagramUrl}
          onChange={e => setDiagramUrl(e.target.value)}
          placeholder="https://… (schéma)"
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer cette stratégie ?"
        danger
        confirmLabel="Supprimer"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (strategy) deleteStrategy(strategy.id);
          onClose();
        }}
      >
        La stratégie sera retirée définitivement.
      </ConfirmDialog>
    </Sheet>
  );
}
