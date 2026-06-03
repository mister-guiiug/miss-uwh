import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn.ts';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] bg-[var(--uwh-surface)] border border-[var(--uwh-border)] p-4 shadow-sm shadow-black/[0.03]',
        className
      )}
      {...rest}
    />
  );
}
