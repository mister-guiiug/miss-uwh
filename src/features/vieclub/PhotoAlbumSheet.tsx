import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import type { PhotoAlbum } from '../../shared/types/domain.ts';
import { useI18n } from '../../i18n/index.ts';
import { Sheet } from '@mister-guiiug/dev-wpa-config/react/sheet';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import { TextField } from '@mister-guiiug/dev-wpa-config/react/field';
import { ConfirmDialog } from '@mister-guiiug/dev-wpa-config/react/confirm-dialog';

interface Props {
  open: boolean;
  album: PhotoAlbum | null;
  onClose: () => void;
}

export function PhotoAlbumSheet({ open, album, onClose }: Props) {
  const { t } = useI18n();
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

  const titleError =
    submitted && !title.trim()
      ? t('vieclub.photoAlbumSheet.titleRequired')
      : undefined;
  const urlError =
    submitted && !url.trim()
      ? t('vieclub.photoAlbumSheet.linkRequired')
      : undefined;

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
      title={
        album
          ? t('vieclub.photoAlbumSheet.editTitle')
          : t('vieclub.photoAlbumSheet.newTitle')
      }
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {album && (
            <Button
              variant="danger"
              aria-label={t('common.delete')}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={18} aria-hidden="true" />
            </Button>
          )}
          <Button block onClick={save}>
            {album ? t('common.save') : t('common.add')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label={t('common.title')}
          value={title}
          error={titleError}
          onChange={e => setTitle(e.target.value)}
          placeholder={t('vieclub.photoAlbumSheet.titlePlaceholder')}
        />
        <TextField
          label={t('vieclub.photoAlbumSheet.linkLabel')}
          type="url"
          value={url}
          error={urlError}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://photos.app.goo.gl/…"
        />
        <TextField
          label={t('vieclub.photoAlbumSheet.dateOptional')}
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
        <TextField
          label={t('vieclub.photoAlbumSheet.coverOptional')}
          value={coverUrl}
          onChange={e => setCoverUrl(e.target.value)}
          placeholder={t('vieclub.photoAlbumSheet.coverPlaceholder')}
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t('vieclub.photoAlbumSheet.confirmDeleteTitle')}
        destructive
        confirmLabel={t('common.delete')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (album) deletePhotoAlbum(album.id);
          onClose();
          setConfirmDelete(false);
        }}
      >
        {t('vieclub.photoAlbumSheet.confirmDeleteBody')}
      </ConfirmDialog>
    </Sheet>
  );
}
