'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const ITEMS = [
  { href: '/admin', label: '控制台' },
  { href: '/admin/company', label: '公司资料' },
  { href: '/admin/contacts', label: '联系方式' },
  { href: '/admin/navigation', label: '导航' },
  { href: '/admin/pages', label: '页面与区块' },
  { href: '/admin/audit', label: '审计记录' },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="后台导航">
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
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
