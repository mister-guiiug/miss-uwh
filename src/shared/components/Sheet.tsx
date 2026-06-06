import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/cn.ts';
import { Button } from './Button.tsx';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /**
   * Barre d'actions épinglée en bas de la feuille : reste TOUJOURS visible
   * même quand le corps défile (essentiel sur mobile pour les formulaires longs).
   */
  footer?: ReactNode;
}

/** Éléments réellement focusables (ordre du DOM) à l'intérieur d'un conteneur. */
function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), ' +
        'select:not([disabled]), textarea:not([disabled]), ' +
        '[tabindex]:not([tabindex="-1"])'
    )
  );
}

/**
 * Feuille modale (bottom sheet mobile). Accessible : role dialog + aria-modal,
 * fermeture par Échap, **focus piégé** dans la feuille (Tab cyclique) et
 * **restauré** sur le déclencheur à la fermeture, scroll de fond verrouillé.
 * En-tête figé, corps défilant, pied d'actions optionnel épinglé.
 */
export function Sheet({ open, title, onClose, children, footer }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Gestion du focus (déps [open] uniquement → ne se relance pas à chaque
  // changement d'identité d'`onClose`, donc ne « vole » jamais le focus en
  // cours de saisie). Mémorise le déclencheur et le restaure à la fermeture.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panel?.focus();
    return () => previouslyFocused?.focus?.();
  }, [open]);

  // Échap, piège de focus (Tab) et verrou du scroll de fond.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = focusablesIn(panel);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center no-print sm:items-center"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="absolute inset-0 bg-black/40 uwh-rise"
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex max-h-[90dvh] w-full flex-col rounded-t-3xl bg-[var(--uwh-surface)] uwh-rise outline-none sm:max-w-lg sm:rounded-3xl"
      >
        {/* En-tête figé */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--uwh-border)] px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <Button variant="ghost" aria-label="Fermer" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </Button>
        </div>

        {/* Corps défilant */}
        <div
          className={cn(
            'flex-1 overflow-y-auto px-5 pt-5',
            footer ? 'pb-5' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))]'
          )}
        >
          {children}
        </div>

        {/* Pied d'actions épinglé (toujours visible) */}
        {footer && (
          <div className="shrink-0 border-t border-[var(--uwh-border)] bg-[var(--uwh-surface)] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
