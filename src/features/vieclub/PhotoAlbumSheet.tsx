import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import type { PhotoAlbum } from '../../shared/types/domain.ts';
import { Sheet } from '../../shared/components/Sheet.tsx';
import { Button } from '../../shared/components/Button.tsx';
import { TextField } from '../../shared/components/Field.tsx';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog.tsx';

interface Props {
  open: boolean;
  album: PhotoAlbum | null;
  onClose: () => void;
}

export function PhotoAlbumSheet({ open, album, onClose }: Props) {
  const season = useAppStore(selectActiveSeason);
  const addPhotoAlbum = useAppStore(s => s.addPhotoAlbum);
  const updatePhotoAlbum = useAppStore(s => s.updatePhotoAlbum);
  const deletePhotoAlbum = useAppStore(s => s.deletePhotoAlbum);

  const [title, setTitle] = useState(album?.title ?? '');
  const [url, setUrl] = useState(album?.url ?? '');
  const [date, setDate] = useState(album?.date ?? '');
  const [coverUrl, setCoverUrl] = useState(album?.coverUrl ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const titleError = submitted && !title.trim() ? 'Titre requis.' : undefined;
  const urlError = submitted && !url.trim() ? 'Lien requis.' : undefined;

  function save() {
    setSubmitted(true);
    if (!title.trim() || !url.trim()) return;
    const input: Omit<PhotoAlbum, 'id'> = {
      seasonId: album?.seasonId ?? season.id,
      title: title.trim(),
      url: url.trim(),
      date: date || undefined,
      coverUrl: coverUrl.trim() || undefined,
    };
    if (album) updatePhotoAlbum(album.id, input);
    else addPhotoAlbum(input);
    onClose();
  }

  return (
    <Sheet
      open={open}
      title={album ? "Modifier l'album" : 'Nouvel album'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {album && (
            <Button
              variant="danger"
              aria-label="Supprimer"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={18} aria-hidden="true" />
            </Button>
          )}
          <Button block onClick={save}>
            {album ? 'Enregistrer' : 'Ajouter'}
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
          placeholder="Ex. Sortie en mer 2026"
        />
        <TextField
          label="Lien de l'album"
          type="url"
          value={url}
          error={urlError}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://photos.app.goo.gl/…"
        />
        <TextField
          label="Date (optionnel)"
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
        <TextField
          label="Couverture (optionnel)"
          value={coverUrl}
          onChange={e => setCoverUrl(e.target.value)}
          placeholder="URL image de couverture (optionnel)"
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Retirer cet album ?"
        danger
        confirmLabel="Supprimer"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (album) deletePhotoAlbum(album.id);
          onClose();
        }}
      >
        L'album sera retiré de la galerie.
      </ConfirmDialog>
    </Sheet>
  );
}
