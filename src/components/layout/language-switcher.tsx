'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { locales, localeNames, type Locale } from '@/lib/i18n';
import { ChevronDownIcon, GlobeIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

export function LanguageSwitcher({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 计算切换到某语言后的等价路径（去掉当前 locale 前缀后重新拼接）
  function pathFor(locale: Locale): string {
    const segments = pathname.split('/').filter(Boolean);
    if ((locales as readonly string[]).includes(segments[0] ?? '')) segments.shift();
    const rest = segments.join('/');
    return rest ? `/${locale}/${rest}` : `/${locale}`;
  }

  useEffect(() => {
    if (!open) return;

    function onClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="language-menu"
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-navy-700 transition-colors hover:bg-navy-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
      >
        <GlobeIcon className="h-4 w-4" />
        <span>{localeNames[current]}</span>
        <ChevronDownIcon className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <nav
          id="language-menu"
          aria-label={label}
          className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-navy-100 bg-white py-1 shadow-lg shadow-navy-900/5"
        >
          <ul>
            {locales.map((locale) => (
              <li key={locale}>
                <Link
                  href={pathFor(locale)}
                  lang={locale}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'block px-4 py-2.5 text-sm transition-colors hover:bg-ivory-100',
                    locale === current ? 'font-semibold text-copper-600' : 'text-navy-800',
                  )}
                >
                  {localeNames[locale]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
