import type { ReactNode } from 'react';
import { cn } from '../lib/cn.ts';
import { formatSignedEuro } from '../lib/format.ts';

type Tone = 'neutral' | 'credit' | 'debit' | 'warn' | 'primary';

const tones: Record<Tone, string> = {
  neutral: 'bg-[var(--uwh-surface-2)] text-[var(--uwh-text-soft)]',
  credit:
    'bg-[color-mix(in_srgb,var(--uwh-credit)_15%,transparent)] text-[var(--uwh-credit)]',
  debit:
    'bg-[color-mix(in_srgb,var(--uwh-debit)_15%,transparent)] text-[var(--uwh-debit)]',
  warn: 'bg-[color-mix(in_srgb,var(--uwh-warn)_18%,transparent)] text-[var(--uwh-warn)]',
  primary: 'bg-[var(--color-primary-soft)] text-primary',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Montant coloré selon le sens (crédit vert / débit rouge), signe optionnel. */
export function Money({
  value,
  signed = false,
  decimals = 2,
  className,
}: {
  value: number;
  signed?: boolean;
  decimals?: number;
  className?: string;
}) {
  const tone =
    value > 0
      ? 'text-[var(--uwh-credit)]'
      : value < 0
        ? 'text-[var(--uwh-debit)]'
        : '';
  return (
    <span className={cn('tnum font-semibold', signed && tone, className)}>
      {signed
        ? formatSignedEuro(value, decimals)
        : value.toLocaleString('fr-FR', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })}
    </span>
  );
}
