import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { EVENT_KINDS, type EventKind } from '../../shared/types/domain.ts';
import { useI18n, type TKey } from '../../i18n/index.ts';
import { Sheet } from '@mister-guiiug/dev-wpa-config/react/sheet';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import {
  SelectField,
  TextField,
} from '@mister-guiiug/dev-wpa-config/react/field';
import { ConfirmDialog } from '@mister-guiiug/dev-wpa-config/react/confirm-dialog';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Gestion des événements de la saison active (TDA, buvette, stage…). */
export function EventsSheet({ open, onClose }: Props) {
  const { t } = useI18n();
  const season = useAppStore(selectActiveSeason);
  // Sélecteur stable (référence inchangée) puis filtrage dans le corps :
  // filtrer DANS le sélecteur renverrait un nouveau tableau à chaque rendu
  // (boucle infinie useSyncExternalStore).
  const allEvents = useAppStore(s => s.data.events);
  const entries = useAppStore(s => s.data.entries);
  const events = allEvents.filter(e => e.seasonId === season.id);
  const addEvent = useAppStore(s => s.addEvent);
  const updateEvent = useAppStore(s => s.updateEvent);
  const deleteEvent = useAppStore(s => s.deleteEvent);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<EventKind>('tournoi');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const attachedCount = (id: string) =>
    entries.filter(e => e.eventId === id && !e.deletedAt).length;
  const pending = events.find(e => e.id === pendingDelete);

  return (
    <Sheet open={open} title={t('finances.events.title')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {events.length === 0 ? (
          <p className="text-sm text-[var(--uwh-text-soft)]">
            {t('finances.events.empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map(ev => (
              <li
                key={ev.id}
                className="flex items-center gap-2 rounded-2xl border border-[var(--uwh-border)] p-2"
              >
                <input
                  value={ev.name}
                  onChange={e => updateEvent(ev.id, { name: e.target.value })}
                  aria-label={t('finances.events.nameAria')}
                  className="min-w-0 flex-1 bg-transparent px-1 text-sm font-medium focus:outline-none"
                />
                <select
                  value={ev.kind}
                  onChange={e =>
                    updateEvent(ev.id, { kind: e.target.value as EventKind })
                  }
                  aria-label={t('finances.events.typeAria')}
                  className="rounded-lg bg-[var(--uwh-surface-2)] px-2 py-1 text-xs"
                >
                  {EVENT_KINDS.map(k => (
                    <option key={k} value={k}>
                      {t(`enums.eventKind.${k}` as TKey)}
                    </option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  aria-label={t('finances.events.deleteAria', {
                    name: ev.name,
                  })}
                  onClick={() => setPendingDelete(ev.id)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <fieldset className="flex flex-col gap-3 rounded-2xl border border-[var(--uwh-border)] p-3">
          <legend className="px-1 text-xs font-semibold text-[var(--uwh-text-soft)]">
            {t('finances.events.newEvent')}
          </legend>
          <TextField
            label={t('common.name')}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('finances.events.namePlaceholder')}
          />
          <SelectField
            label={t('common.type')}
            value={kind}
            onChange={e => setKind(e.target.value as EventKind)}
          >
            {EVENT_KINDS.map(k => (
              <option key={k} value={k}>
                {t(`enums.eventKind.${k}` as TKey)}
              </option>
            ))}
          </SelectField>
          <Button
            block
            disabled={!name.trim()}
            onClick={() => {
              addEvent(name.trim(), kind);
              setName('');
            }}
          >
            {t('finances.events.addEvent')}
          </Button>
        </fieldset>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title={t('finances.events.deleteConfirmTitle', {
          name: pending?.name ?? '',
        })}
        destructive
        confirmLabel={t('common.delete')}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteEvent(pendingDelete);
          setPendingDelete(null);
        }}
      >
        {pending && attachedCount(pending.id) > 0 ? (
          <>
            {t('finances.events.detachBefore', {
              n: attachedCount(pending.id),
            })}
            <strong>{t('finances.events.detachStrong')}</strong>
            {t('finances.events.detachAfter')}
          </>
        ) : (
          <>{t('finances.events.willBeRemoved')}</>
        )}
      </ConfirmDialog>
    </Sheet>
  );
}
