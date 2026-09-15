import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'text-xs font-semibold uppercase tracking-[0.22em] text-copper-700',
        className,
      )}
    >
      {children}
    </span>
  );
}
