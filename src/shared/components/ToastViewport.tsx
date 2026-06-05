import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useToasts, type ToastTone } from '../lib/toasts.ts';
import { cn } from '../lib/cn.ts';

const TONE_STYLES: Record<ToastTone, string> = {
  error:
    'border-[var(--uwh-debit)] bg-[color-mix(in_srgb,var(--uwh-debit)_14%,var(--uwh-surface))] text-[var(--uwh-text)]',
  success:
    'border-[var(--uwh-credit)] bg-[color-mix(in_srgb,var(--uwh-credit)_14%,var(--uwh-surface))] text-[var(--uwh-text)]',
  info: 'border-[var(--uwh-border)] bg-[var(--uwh-surface)] text-[var(--uwh-text)]',
};

const TONE_ICON = {
  error: AlertTriangle,
  success: CheckCircle2,
  info: Info,
} as const;

const TONE_ICON_COLOR: Record<ToastTone, string> = {
  error: 'text-[var(--uwh-debit)]',
  success: 'text-[var(--uwh-credit)]',
  info: 'text-primary',
};

/**
 * Pile de notifications, ancrée en bas et centrée dans la colonne de l'app.
 * Monté une seule fois (cf. `App.tsx`), hors routeur, pour afficher aussi les
 * messages survenant à l'amorçage (lecture du stockage) ou sur l'écran de login.
 */
export function ToastViewport() {
  const toasts = useToasts(s => s.toasts);
  const dismiss = useToasts(s => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-2xl flex-col gap-2 p-4"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map(toast => {
        const Icon = TONE_ICON[toast.tone];
        return (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
            className={cn(
              'pointer-events-auto flex items-start gap-2.5 rounded-2xl border p-3 shadow-lg',
              TONE_STYLES[toast.tone]
            )}
          >
            <Icon
              size={18}
              className={cn('mt-0.5 shrink-0', TONE_ICON_COLOR[toast.tone])}
              aria-hidden="true"
            />
            <p className="flex-1 text-sm leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Fermer la notification"
              className="-m-1 shrink-0 rounded-full p-1 text-[var(--uwh-text-soft)] hover:text-[var(--uwh-text)]"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
