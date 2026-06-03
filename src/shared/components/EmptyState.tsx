import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  Icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ Icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="rounded-2xl bg-[var(--color-primary-soft)] p-4 text-primary">
        <Icon size={28} aria-hidden="true" />
      </div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {children && (
        <p className="max-w-xs text-sm text-[var(--uwh-text-soft)]">
          {children}
        </p>
      )}
      {action}
    </div>
  );
}
