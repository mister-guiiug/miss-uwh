import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import {
  CLUB_EVENT_TYPES,
  type ClubEvent,
  type ClubEventType,
} from '../../shared/types/domain.ts';
import { useI18n, type TKey } from '../../i18n/index.ts';
import { Sheet } from '../../shared/components/Sheet.tsx';
import { Button } from '../../shared/components/Button.tsx';
import {
  SelectField,
  TextAreaField,
  TextField,
} from '../../shared/components/Field.tsx';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog.tsx';
import { useZodForm } from '../../shared/hooks/useZodForm.ts';
import {
  clubEventFormSchema,
  type ClubEventFormValues,
} from '../../shared/lib/formSchemas.ts';

interface Props {
  open: boolean;
  event: ClubEvent | null;
  onClose: () => void;
}

export function ClubEventSheet({ open, event, onClose }: Props) {
  const { t } = useI18n();
  const season = useAppStore(selectActiveSeason);
  const addClubEvent = useAppStore(s => s.addClubEvent);
  const updateClubEvent = useAppStore(s => s.updateClubEvent);
  const deleteClubEvent = useAppStore(s => s.deleteClubEvent);

  const initial: ClubEventFormValues = {
    date: event?.date ?? new Date().toISOString().slice(0, 10),
    title: event?.title ?? '',
    type: event?.type ?? 'reunion',
    location: event?.location ?? '',
    description: event?.description ?? '',
  };
  const { values, errors, setValue, submit } = useZodForm(
    clubEventFormSchema,
    initial
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  function save() {
    submit(parsed => {
      const input: Omit<ClubEvent, 'id'> = {
        seasonId: event?.seasonId ?? season.id,
        ...parsed,
      };
      if (event) updateClubEvent(event.id, input);
      else addClubEvent(input);
      onClose();
    });
  }

  return (
    <Sheet
      open={open}
      title={
        event
          ? t('vieclub.clubEventSheet.editTitle')
          : t('vieclub.clubEventSheet.newTitle')
      }
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {event && (
            <Button
              variant="danger"
              aria-label={t('common.delete')}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={18} aria-hidden="true" />
            </Button>
          )}
          <Button block onClick={save}>
            {event ? t('common.save') : t('common.add')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label={t('common.title')}
          value={values.title}
          error={errors.title}
          onChange={e => setValue('title', e.target.value)}
          placeholder={t('vieclub.clubEventSheet.titlePlaceholder')}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t('common.date')}
            type="date"
            value={values.date}
            error={errors.date}
            onChange={e => setValue('date', e.target.value)}
          />
          <SelectField
            label={t('common.type')}
            value={values.type}
            onChange={e => setValue('type', e.target.value as ClubEventType)}
          >
            {CLUB_EVENT_TYPES.map(type => (
              <option key={type} value={type}>
                {t(`enums.clubEventType.${type}` as TKey)}
              </option>
            ))}
          </SelectField>
        </div>
        <TextField
          label={t('vieclub.clubEventSheet.locationOptional')}
          value={values.location}
          onChange={e => setValue('location', e.target.value)}
        />
        <TextAreaField
          label={t('vieclub.clubEventSheet.descriptionOptional')}
          value={values.description}
          onChange={e => setValue('description', e.target.value)}
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t('vieclub.clubEventSheet.confirmDeleteTitle')}
        danger
        confirmLabel={t('common.delete')}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (event) deleteClubEvent(event.id);
          onClose();
        }}
      >
        {t('vieclub.clubEventSheet.confirmDeleteBody')}
      </ConfirmDialog>
    </Sheet>
  );
}
