'use client';

import { useFormStatus } from 'react-dom';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-navy-800">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

const controlClasses =
  'block w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-navy-300 focus:border-copper-500 focus:outline-none focus:ring-2 focus:ring-copper-500/30';

export function TextInput({
  name,
  defaultValue,
  placeholder,
  type = 'text',
  required,
  autoComplete,
  id,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  id?: string;
}) {
  return (
    <input
      id={id ?? name}
      name={name}
      type={type}
      required={required}
      autoComplete={autoComplete}
      placeholder={placeholder}
      defaultValue={defaultValue}
      className={controlClasses}
    />
  );
}

export function TextArea({
  name,
  defaultValue,
  rows = 4,
  placeholder,
  id,
}: {
  name: string;
  defaultValue?: string;
  rows?: number;
  placeholder?: string;
  id?: string;
}) {
  return (
    <textarea
      id={id ?? name}
      name={name}
      rows={rows}
      placeholder={placeholder}
      defaultValue={defaultValue}
      className={controlClasses}
    />
  );
}

export function Select({
  name,
  defaultValue,
  options,
  id,
}: {
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  id?: string;
}) {
  return (
    <select id={id ?? name} name={name} defaultValue={defaultValue} className={controlClasses}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({
  name,
  defaultChecked,
  label,
  id,
}: {
  name: string;
  defaultChecked?: boolean;
  label: string;
  id?: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-navy-800">
      <input
        id={id ?? name}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        value="on"
        className="h-4 w-4 rounded border-navy-300 text-copper-600 focus:ring-copper-500"
      />
      {label}
    </label>
  );
}

export function SubmitButton({
  children,
  pendingText,
  variant = 'primary',
  className,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
}) {
  const { pending } = useFormStatus();
  const variants = {
    primary: 'bg-navy-900 text-ivory-50 hover:bg-navy-800',
    secondary: 'border border-navy-300 text-navy-900 hover:bg-navy-50',
    danger: 'border border-red-300 text-red-700 hover:bg-red-50',
  } as const;

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500',
        variants[variant],
        className,
      )}
    >
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

export function Alert({ kind, children }: { kind: 'success' | 'error' | 'info'; children: ReactNode }) {
  const styles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-navy-200 bg-navy-50 text-navy-700',
  } as const;

  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={cn('rounded-lg border px-4 py-3 text-sm', styles[kind])}>
      {children}
    </div>
  );
}

export function LocaleSection({
  title,
  children,
  open,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details open={open} className="rounded-xl border border-navy-200 bg-white">
      <summary className="cursor-pointer select-none px-5 py-3.5 text-sm font-semibold text-navy-900">
        {title}
      </summary>
      <div className="space-y-4 border-t border-navy-100 px-5 py-5">{children}</div>
    </details>
  );
}
