import { cn } from '@/lib/cn';
import { Eyebrow } from './eyebrow';

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'center' | 'left';
  tone?: 'light' | 'dark';
  className?: string;
  id?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  tone = 'light',
  className,
  id,
}: SectionHeadingProps) {
  const dark = tone === 'dark';
  return (
    <div
      className={cn('max-w-2xl', align === 'center' ? 'mx-auto text-center' : 'text-left', className)}
    >
      {eyebrow ? (
        <Eyebrow className={dark ? 'text-copper-300' : undefined}>{eyebrow}</Eyebrow>
      ) : null}
      <h2
        id={id}
        className={cn(
          'mt-3 text-3xl font-semibold tracking-tight sm:text-4xl',
          dark ? 'text-ivory-50' : 'text-navy-900',
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            'mt-4 text-base leading-relaxed',
            dark ? 'text-navy-100' : 'text-muted',
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
