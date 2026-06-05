import { useMemo, useState } from 'react';
import { Images, Pencil, Plus } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import type { PhotoAlbum } from '../../shared/types/domain.ts';
import { formatDateShort } from '../../shared/lib/format.ts';
import { Button } from '../../shared/components/Button.tsx';
import { Card } from '../../shared/components/Card.tsx';
import { EmptyState } from '../../shared/components/EmptyState.tsx';
import { PhotoAlbumSheet } from './PhotoAlbumSheet.tsx';

/** Galerie : albums Google Photos partagés de la saison. */
export function GalerieScreen() {
  const season = useAppStore(selectActiveSeason);
  const all = useAppStore(s => s.data.photoAlbums);
  const [editing, setEditing] = useState<PhotoAlbum | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = useMemo(
    () =>
      all
        .filter(a => a.seasonId === season.id)
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    [all, season.id]
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">
          {rows.length} album{rows.length > 1 ? 's' : ''}
        </h2>
        <Button onClick={() => setCreating(true)}>
          <Plus size={18} aria-hidden="true" /> Album
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState Icon={Images} title="Aucun album">
          Reliez vos albums Google Photos partagés.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {rows.map(album => (
            <a
              key={album.id}
              href={album.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block transition-transform active:scale-[0.98]"
            >
              <Card className="relative flex h-full flex-col gap-2 p-3">
                <button
                  type="button"
                  aria-label="Modifier"
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditing(album);
                  }}
                  className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--uwh-surface-2)] text-[var(--uwh-text-soft)] active:scale-[0.97]"
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
                <div className="aspect-video overflow-hidden rounded-xl">
                  {album.coverUrl ? (
                    <img
                      src={album.coverUrl}
                      alt={album.title}
                      className="h-full w-full rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-xl bg-[var(--uwh-surface-2)] text-[var(--uwh-text-soft)]">
                      <Images size={28} aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {album.title}
                  </p>
                  {album.date && (
                    <p className="text-xs text-[var(--uwh-text-soft)]">
                      {formatDateShort(album.date)}
                    </p>
                  )}
                </div>
              </Card>
            </a>
          ))}
        </div>
      )}

      {creating && (
        <PhotoAlbumSheet open album={null} onClose={() => setCreating(false)} />
      )}
      {editing && (
        <PhotoAlbumSheet
          open
          album={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
