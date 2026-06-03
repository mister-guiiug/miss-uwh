import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../lib/cn.ts';

const controlClass =
  'w-full min-h-11 rounded-2xl bg-[var(--uwh-surface-2)] border border-[var(--uwh-border)] ' +
  'px-4 text-[16px] text-[var(--uwh-text)] placeholder:text-[var(--uwh-text-soft)] ' +
  'focus:border-primary';

interface FieldShellProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

function FieldShell({ id, label, hint, error, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-[var(--uwh-text-soft)]">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-xs text-[var(--uwh-debit)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}

interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id'
> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextField({ label, hint, error, ...rest }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        className={cn(controlClass, error && 'border-[var(--uwh-debit)]')}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error ? `${id}-error` : hint ? `${id}-hint` : undefined
        }
        {...rest}
      />
    </FieldShell>
  );
}

interface SelectFieldProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'id'
> {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function SelectField({
  label,
  hint,
  error,
  children,
  ...rest
}: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        className={cn(controlClass, error && 'border-[var(--uwh-debit)]')}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}

interface TextAreaFieldProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'id'
> {
  label: string;
  hint?: string;
}

export function TextAreaField({ label, hint, ...rest }: TextAreaFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint}>
      <textarea
        id={id}
        className={cn(controlClass, 'min-h-20 py-2')}
        {...rest}
      />
    </FieldShell>
  );
}
