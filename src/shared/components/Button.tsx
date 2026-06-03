import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn.ts';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold ' +
  'min-h-11 px-5 text-[15px] transition-[transform,background] active:scale-[0.97] ' +
  'disabled:opacity-50 disabled:pointer-events-none select-none';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white shadow-sm shadow-primary/30',
  secondary:
    'bg-[var(--uwh-surface-2)] text-[var(--uwh-text)] border border-[var(--uwh-border)]',
  ghost: 'bg-transparent text-[var(--uwh-text-soft)]',
  danger: 'bg-[var(--uwh-debit)] text-white',
};

export function Button({
  variant = 'primary',
  block,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(base, variants[variant], block && 'w-full', className)}
      {...rest}
    />
  );
}
