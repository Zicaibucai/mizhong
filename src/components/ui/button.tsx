import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'accent' | 'outline' | 'outlineLight' | 'ghost';
type Size = 'md' | 'lg';

const baseClasses =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2';

const variantClasses: Record<Variant, string> = {
  primary: 'bg-navy-900 text-ivory-50 hover:bg-navy-800 focus-visible:outline-copper-500',
  accent: 'bg-copper-700 text-ivory-50 hover:bg-copper-800 focus-visible:outline-copper-500',
  outline:
    'border border-navy-300 text-navy-900 hover:border-navy-900 hover:bg-navy-50 focus-visible:outline-copper-500',
  outlineLight:
    'border border-ivory-50/40 text-ivory-50 hover:bg-ivory-50/10 focus-visible:outline-copper-300',
  ghost: 'text-navy-700 hover:bg-navy-100 focus-visible:outline-copper-500',
};

const sizeClasses: Record<Size, string> = {
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-[15px]',
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

type ButtonProps =
  | (CommonProps & { href: string } & AnchorHTMLAttributes<HTMLAnchorElement>)
  | (CommonProps & { href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>);

export function Button(props: ButtonProps) {
  const { variant = 'primary', size = 'md', className, children, href, ...rest } = props;
  const classes = cn(baseClasses, variantClasses[variant], sizeClasses[size], className);

  if (href) {
    return (
      <Link href={href} className={classes} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}
