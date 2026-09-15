'use client';

import { useEffect, useRef, useState } from 'react';
import { CloseIcon, MenuIcon } from '@/components/ui/icons';

interface NavItem {
  label: string;
  href: string;
}

interface MobileMenuProps {
  navItems: NavItem[];
  ctaLabel: string;
  ctaHref: string;
  menuLabel: string;
  closeLabel: string;
  navLabel: string;
}

export function MobileMenu({
  navItems,
  ctaLabel,
  ctaHref,
  menuLabel,
  closeLabel,
  navLabel,
}: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      panelRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onClick(event: MouseEvent) {
      const target = event.target as Node;
      const insidePanel = panelRef.current?.contains(target);
      const insideButton = buttonRef.current?.contains(target);
      if (!insidePanel && !insideButton) setOpen(false);
    }

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? closeLabel : menuLabel}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-navy-900 transition-colors hover:bg-navy-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
      >
        {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
      </button>

      {open ? (
        <div
          ref={panelRef}
          id="mobile-nav"
          className="absolute inset-x-0 top-full border-b border-navy-100 bg-ivory-50 px-5 pb-8 pt-2 shadow-lg shadow-navy-900/10"
        >
          <nav aria-label={navLabel}>
            <ul className="space-y-1">
              {navItems.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-3 text-lg font-medium text-navy-900 transition-colors hover:bg-ivory-100"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
            <a
              href={ctaHref}
              onClick={() => setOpen(false)}
              className="mt-4 flex h-12 items-center justify-center rounded-full bg-navy-900 px-6 text-sm font-medium text-ivory-50"
            >
              {ctaLabel}
            </a>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
