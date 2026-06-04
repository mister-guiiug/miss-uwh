import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import type { Announcement } from '../../shared/types/domain.ts';
import { Sheet } from '../../shared/components/Sheet.tsx';
import { Button } from '../../shared/components/Button.tsx';
import { TextAreaField, TextField } from '../../shared/components/Field.tsx';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog.tsx';

interface Props {
  open: boolean;
  announcement: Announcement | null;
  onClose: () => void;
}

export function AnnouncementSheet({ open, announcement, onClose }: Props) {
  const season = useAppStore(selectActiveSeason);
  const addAnnouncement = useAppStore(s => s.addAnnouncement);
  const updateAnnouncement = useAppStore(s => s.updateAnnouncement);
  const deleteAnnouncement = useAppStore(s => s.deleteAnnouncement);

  const [date, setDate] = useState(
    announcement?.date ?? new Date().toISOString().slice(0, 10)
  );
  const [title, setTitle] = useState(announcement?.title ?? '');
  const [body, setBody] = useState(announcement?.body ?? '');
  const [pinned, setPinned] = useState(announcement?.pinned ?? false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const titleError = submitted && !title.trim() ? 'Titre requis.' : undefined;

  function save() {
    setSubmitted(true);
    if (!title.trim()) return;
    const input: Omit<Announcement, 'id'> = {
      seasonId: announcement?.seasonId ?? season.id,
      date,
      title: title.trim(),
      body: body.trim(),
      pinned,
    };
    if (announcement) updateAnnouncement(announcement.id, input);
    else addAnnouncement(input);
    onClose();
  }

  return (
    <Sheet
      open={open}
      title={announcement ? "Modifier l'annonce" : 'Nouvelle annonce'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {announcement && (
            <Button
              variant="danger"
              aria-label="Supprimer"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={18} aria-hidden="true" />
            </Button>
          )}
          <Button block onClick={save}>
            {announcement ? 'Enregistrer' : 'Publier'}
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
          placeholder="Ex. Reprise des entraînements"
        />
        <TextField
          label="Date"
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
        <TextAreaField
          label="Message"
          value={body}
          onChange={e => setBody(e.target.value)}
        />
        <label className="flex items-center justify-between gap-2 text-sm font-semibold">
          Épingler en haut
          <input
            type="checkbox"
            checked={pinned}
            onChange={e => setPinned(e.target.checked)}
          />
        </label>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer cette annonce ?"
        danger
        confirmLabel="Supprimer"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (announcement) deleteAnnouncement(announcement.id);
          onClose();
        }}
      >
        L'annonce sera retirée définitivement.
      </ConfirmDialog>
    </Sheet>
  );
}
