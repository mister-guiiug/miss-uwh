import { type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronRight, X } from 'lucide-react';
import { Badge } from '../../shared/components/badges.tsx';
import type { Alert } from './alerts.ts';

/** Centre d'alertes (overlay) : liste les « à faire » dérivés, chacun cliquable. */
export function NotificationCenter({
  open,
  onClose,
  alerts,
}: {
  open: boolean;
  onClose: () => void;
  alerts: Alert[];
}) {
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
      aria-label="Alertes"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-[var(--uwh-surface)] shadow-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--uwh-border)] p-3">
          <Bell
            size={18}
            className="text-[var(--uwh-text-soft)]"
            aria-hidden="true"
          />
          <h2 className="flex-1 text-sm font-semibold">À faire</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer les alertes"
            className="text-[var(--uwh-text-soft)]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {alerts.length === 0 ? (
            <p className="p-4 text-center text-sm text-[var(--uwh-text-soft)]">
              Rien à signaler — tout est à jour.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {alerts.map(al => (
                <li key={al.id}>
                  <Link
                    to={al.to}
                    onClick={onClose}
                    className="flex items-center gap-3 rounded-xl p-2 hover:bg-[var(--uwh-surface-2)]"
                  >
                    <Badge tone={al.tone}>!</Badge>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {al.title}
                    </span>
                    <ChevronRight
                      size={16}
                      className="shrink-0 text-[var(--uwh-text-soft)]"
                      aria-hidden="true"
                    />
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
