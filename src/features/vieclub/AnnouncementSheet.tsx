import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import type { Announcement } from '../../shared/types/domain.ts';
import { useI18n } from '../../i18n/index.ts';
import { Sheet } from '@mister-guiiug/dev-wpa-config/react/sheet';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import {
  TextAreaField,
  TextField,
} from '@mister-guiiug/dev-wpa-config/react/field';
import { ConfirmDialog } from '@mister-guiiug/dev-wpa-config/react/confirm-dialog';

interface Props {
  open: boolean;
  announcement: Announcement | null;
  onClose: () => void;
}

export function AnnouncementSheet({ open, announcement, onClose }: Props) {
  const { t } = useI18n();
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

  const titleError =
    submitted && !title.trim()
      ? t('vieclub.announcementSheet.titleRequired')
      : undefined;

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
      title={
        announcement
          ? t('vieclub.announcementSheet.editTitle')
          : t('vieclub.announcementSheet.newTitle')
      }
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {announcement && (
            <Button
              variant="danger"
              aria-label={t('common.delete')}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={18} aria-hidden="true" />
            </Button>
          )}
          <Button block onClick={save}>
            {announcement
              ? t('common.save')
              : t('vieclub.announcementSheet.publish')}
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
          placeholder={t('vieclub.announcementSheet.titlePlaceholder')}
        />
        <TextField
          label={t('common.date')}
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
        <TextAreaField
          label={t('vieclub.announcementSheet.message')}
          value={body}
          onChange={e => setBody(e.target.value)}
        />
        <label className="flex items-center justify-between gap-2 text-sm font-semibold">
          {t('vieclub.announcementSheet.pinToTop')}
          <input
            type="checkbox"
            checked={pinned}
            onChange={e => setPinned(e.target.checked)}
          />
        </label>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t('vieclub.announcementSheet.confirmDeleteTitle')}
        destructive
        confirmLabel={t('common.delete')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (announcement) deleteAnnouncement(announcement.id);
          onClose();
          setConfirmDelete(false);
        }}
      >
        {t('vieclub.announcementSheet.confirmDeleteBody')}
      </ConfirmDialog>
    </Sheet>
  );
}
