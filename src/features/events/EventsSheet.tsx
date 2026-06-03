import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { EVENT_KINDS, type EventKind } from '../../shared/types/domain.ts';
import { Sheet } from '../../shared/components/Sheet.tsx';
import { Button } from '../../shared/components/Button.tsx';
import { SelectField, TextField } from '../../shared/components/Field.tsx';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog.tsx';

const KIND_LABELS: Record<EventKind, string> = {
  tournoi: 'Tournoi',
  buvette: 'Buvette',
  stage: 'Stage',
  autre: 'Autre',
};

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Gestion des événements de la saison active (TDA, buvette, stage…). */
export function EventsSheet({ open, onClose }: Props) {
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
    <Sheet open={open} title="Événements de la saison" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {events.length === 0 ? (
          <p className="text-sm text-[var(--uwh-text-soft)]">
            Aucun événement. Créez-en un (Tournoi des Arvernes, buvette, stage…)
            pour suivre son résultat net et y rattacher des écritures.
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
                  aria-label="Nom de l'événement"
                  className="min-w-0 flex-1 bg-transparent px-1 text-sm font-medium focus:outline-none"
                />
                <select
                  value={ev.kind}
                  onChange={e =>
                    updateEvent(ev.id, { kind: e.target.value as EventKind })
                  }
                  aria-label="Type d'événement"
                  className="rounded-lg bg-[var(--uwh-surface-2)] px-2 py-1 text-xs"
                >
                  {EVENT_KINDS.map(k => (
                    <option key={k} value={k}>
                      {KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  aria-label={`Supprimer ${ev.name}`}
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
            Nouvel événement
          </legend>
          <TextField
            label="Nom"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Tournoi des Arvernes 2026"
          />
          <SelectField
            label="Type"
            value={kind}
            onChange={e => setKind(e.target.value as EventKind)}
          >
            {EVENT_KINDS.map(k => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
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
            Ajouter l'événement
          </Button>
        </fieldset>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title={`Supprimer « ${pending?.name} » ?`}
        danger
        confirmLabel="Supprimer"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteEvent(pendingDelete)}
      >
        {pending && attachedCount(pending.id) > 0 ? (
          <>
            {attachedCount(pending.id)} écriture(s) y sont rattachées : elles
            seront <strong>détachées</strong> (et non supprimées).
          </>
        ) : (
          <>L'événement sera retiré de la saison.</>
        )}
      </ConfirmDialog>
    </Sheet>
  );
}
