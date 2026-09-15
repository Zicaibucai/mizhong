'use client';

import Link from 'next/link';
import type { AdminUser } from '@/lib/auth/session';
import { AdminNav } from './admin-nav';
import { LocaleSwitcher } from './locale-switcher';
import { LogoutButton } from './logout-button';
import { useAdminT } from './i18n-provider';

export function AdminShell({
  user,
  children,
}: {
  user: AdminUser;
  children: React.ReactNode;
}) {
  const t = useAdminT();

  return (
    <div className="min-h-screen bg-ivory-50">
      <div className="mx-auto flex max-w-[1440px] flex-col lg:flex-row">
        <aside className="border-b border-navy-200 bg-white px-4 py-4 lg:min-h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <Link href="/admin" className="block">
            <span className="block text-sm font-semibold tracking-tight text-navy-900">
              Mizhong Trading Co., Ltd.
            </span>
            <span className="mt-0.5 block text-xs text-muted">{t.shell.subtitle}</span>
          </Link>
          <div className="mt-5">
            <AdminNav />
          </div>
          <div className="mt-6 hidden border-t border-navy-100 pt-4 lg:block">
            <Link
              href="/zh"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted underline-offset-4 hover:text-navy-800 hover:underline"
            >
              {t.shell.viewPublicSite}
            </Link>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex h-14 items-center justify-between gap-4 border-b border-navy-200 bg-white px-5">
            <span className="text-sm font-medium text-navy-800">{t.shell.headerTitle}</span>
            <div className="flex items-center gap-3">
              <LocaleSwitcher />
              <span className="hidden text-xs text-muted sm:inline">{user.email}</span>
              <LogoutButton />
            </div>
          </header>
          <main className="px-5 py-8 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
