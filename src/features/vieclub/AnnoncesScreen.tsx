import { useMemo, useState } from 'react';
import { Megaphone, Pin, Plus } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import type { Announcement } from '../../shared/types/domain.ts';
import { formatDateShort } from '../../shared/lib/format.ts';
import { Button } from '../../shared/components/Button.tsx';
import { EmptyState } from '../../shared/components/EmptyState.tsx';
import { AnnouncementSheet } from './AnnouncementSheet.tsx';

/** Annonces / actualités / convocations du club (épinglées en tête). */
export function AnnoncesScreen() {
  const season = useAppStore(selectActiveSeason);
  const all = useAppStore(s => s.data.announcements);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = useMemo(
    () =>
      all
        .filter(a => a.seasonId === season.id)
        .sort((a, b) => {
          const pa = a.pinned ? 1 : 0;
          const pb = b.pinned ? 1 : 0;
          if (pa !== pb) return pb - pa;
          return a.date < b.date ? 1 : -1;
        }),
    [all, season.id]
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">
          {rows.length} annonce{rows.length > 1 ? 's' : ''}
        </h2>
        <Button onClick={() => setCreating(true)}>
          <Plus size={18} aria-hidden="true" /> Annonce
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState Icon={Megaphone} title="Aucune annonce">
          Publiez actualités et convocations pour les adhérents.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map(a => (
            <li key={a.id}>
              <button
                onClick={() => setEditing(a)}
                className="flex w-full flex-col gap-1 rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface)] p-3 text-left active:scale-[0.99]"
              >
                <div className="flex items-center gap-2">
                  {a.pinned && (
                    <Pin
                      size={13}
                      className="shrink-0 text-primary"
                      aria-hidden="true"
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {a.title}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--uwh-text-soft)]">
                    {formatDateShort(a.date)}
                  </span>
                </div>
                {a.body && (
                  <p className="line-clamp-2 text-xs text-[var(--uwh-text-soft)]">
                    {a.body}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <AnnouncementSheet
          open
          announcement={null}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <AnnouncementSheet
          open
          announcement={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
