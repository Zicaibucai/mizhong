'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useAdminT } from './i18n-provider';

const ITEMS = [
  { href: '/admin', key: 'dashboard' },
  { href: '/admin/company', key: 'company' },
  { href: '/admin/contacts', key: 'contacts' },
  { href: '/admin/navigation', key: 'navigation' },
  { href: '/admin/pages', key: 'pages' },
  { href: '/admin/audit', key: 'audit' },
] as const;

export function AdminNav() {
  const t = useAdminT();
  const pathname = usePathname();

  return (
    <nav aria-label={t.nav.ariaLabel}>
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {ITEMS.map((item) => {
          const active =
            item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="shrink-0 lg:shrink">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-navy-900 font-medium text-ivory-50'
                    : 'text-navy-700 hover:bg-navy-100',
                )}
              >
                {t.nav[item.key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
