import type { ReactNode } from 'react';
import { Sheet } from './Sheet.tsx';
import { Button } from './Button.tsx';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <div className="text-sm text-[var(--uwh-text-soft)]">{children}</div>
      <div className="mt-5 flex gap-2">
        <Button variant="secondary" block onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          block
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
