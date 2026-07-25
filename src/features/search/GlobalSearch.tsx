import { useMemo, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  ScrollText,
  Search,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { formatDateShort } from '../../shared/lib/format.ts';
import { useI18n } from '../../i18n/index.ts';

interface Result {
  key: string;
  to: string;
  Icon: LucideIcon;
  primary: string;
  secondary: string;
}

const MAX = 40;

/**
 * Recherche globale (saison active) : adhérents, écritures du journal et
 * événements. Chaque résultat renvoie vers l'écran concerné. Overlay modal.
 */
export function GlobalSearch({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const season = useAppStore(selectActiveSeason);
  const adherents = useAppStore(s => s.data.adherents);
  const entries = useAppStore(s => s.data.entries);
  const clubEvents = useAppStore(s => s.data.clubEvents);
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: Result[] = [];

    for (const a of adherents) {
      if (out.length >= MAX) break;
      if (a.seasonId !== season.id) continue;
      const name = `${a.firstName} ${a.lastName}`;
      if (name.toLowerCase().includes(q)) {
        out.push({
          key: `a:${a.id}`,
          to: '/adherents',
          Icon: Users,
          primary: name,
          secondary: t('search.member'),
        });
      }
    }
    for (const e of entries) {
      if (out.length >= MAX) break;
      if (e.seasonId !== season.id || e.deletedAt) continue;
      if (e.label.toLowerCase().includes(q)) {
        out.push({
          key: `e:${e.id}`,
          to: '/finances/journal',
          Icon: ScrollText,
          primary: e.label,
          secondary: t('search.entry', { date: formatDateShort(e.date) }),
        });
      }
    }
    for (const ev of clubEvents) {
      if (out.length >= MAX) break;
      if (ev.seasonId !== season.id) continue;
      if (ev.title.toLowerCase().includes(q)) {
        out.push({
          key: `c:${ev.id}`,
          to: '/vie-club',
          Icon: CalendarDays,
          primary: ev.title,
          secondary: t('search.event', { date: formatDateShort(ev.date) }),
        });
      }
    }
    return out;
  }, [query, adherents, entries, clubEvents, season.id, t]);

  if (!open) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-[10vh] backdrop-blur-sm no-print"
      onClick={onClose}
      onKeyDown={onKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label={t('search.title')}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-[var(--uwh-surface)] shadow-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--uwh-border)] p-3">
          <Search
            size={18}
            className="shrink-0 text-[var(--uwh-text-soft)]"
            aria-hidden="true"
          />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            aria-label={t('search.term')}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('search.close')}
            className="shrink-0 text-[var(--uwh-text-soft)]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <p className="p-4 text-center text-sm text-[var(--uwh-text-soft)]">
              {t('search.min2')}
            </p>
          ) : results.length === 0 ? (
            <p className="p-4 text-center text-sm text-[var(--uwh-text-soft)]">
              {t('search.noResults', { season: season.label })}
            </p>
          ) : (
            <ul className="flex flex-col">
              {results.map(r => (
                <li key={r.key}>
                  <Link
                    to={r.to}
                    onClick={onClose}
                    className="flex items-center gap-3 rounded-xl p-2 hover:bg-[var(--uwh-surface-2)]"
                  >
                    <r.Icon
                      size={16}
                      className="shrink-0 text-[var(--uwh-text-soft)]"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {r.primary}
                      </span>
                      <span className="block truncate text-xs text-[var(--uwh-text-soft)]">
                        {r.secondary}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
