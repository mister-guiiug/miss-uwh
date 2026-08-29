import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import {
  STRATEGY_PHASES,
  type Strategy,
  type StrategyPhase,
} from '../../shared/types/domain.ts';
import { Sheet } from '@mister-guiiug/dev-wpa-config/react/sheet';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import {
  SelectField,
  TextAreaField,
  TextField,
} from '@mister-guiiug/dev-wpa-config/react/field';
import { ConfirmDialog } from '@mister-guiiug/dev-wpa-config/react/confirm-dialog';
import { useI18n, type TKey } from '../../i18n/index.ts';

interface Props {
  open: boolean;
  strategy: Strategy | null;
  onClose: () => void;
}

export function StrategySheet({ open, strategy, onClose }: Props) {
  const { t } = useI18n();
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

  const nameError =
    submitted && !name.trim()
      ? t('entrainements.strategySheet.nameRequired')
      : undefined;

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
      title={
        strategy
          ? t('entrainements.strategySheet.editTitle')
          : t('entrainements.strategySheet.newTitle')
      }
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {strategy && (
            <Button
              variant="danger"
              aria-label={t('common.delete')}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={18} aria-hidden="true" />
            </Button>
          )}
          <Button block onClick={save}>
            {strategy ? t('common.save') : t('common.add')}
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
          placeholder={t('entrainements.strategySheet.namePlaceholder')}
        />
        <SelectField
          label={t('entrainements.strategySheet.phase')}
          value={phase}
          onChange={e => setPhase(e.target.value as StrategyPhase)}
        >
          {STRATEGY_PHASES.map(p => (
            <option key={p} value={p}>
              {t(`enums.strategyPhase.${p}` as TKey)}
            </option>
          ))}
        </SelectField>
        <TextAreaField
          label={t('entrainements.strategySheet.description')}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
        <TextField
          label={t('entrainements.strategySheet.diagram')}
          value={diagramUrl}
          onChange={e => setDiagramUrl(e.target.value)}
          placeholder={t('entrainements.strategySheet.diagramPlaceholder')}
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t('entrainements.strategySheet.deleteTitle')}
        destructive
        confirmLabel={t('common.delete')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (strategy) deleteStrategy(strategy.id);
          onClose();
          setConfirmDelete(false);
        }}
      >
        {t('entrainements.strategySheet.deleteBody')}
      </ConfirmDialog>
    </Sheet>
  );
}
