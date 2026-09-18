'use client';

import Link from 'next/link';
import type { AdminUser } from '@/lib/auth/session';
import { formatMessage } from '@/lib/admin/i18n';
import { AdminNav } from './admin-nav';
import { LocaleSwitcher } from './locale-switcher';
import { LogoutButton } from './logout-button';
import { useAdminT } from './i18n-provider';

export function AdminShell({
  user,
  children,
  pendingTranslations = 0,
}: {
  user: AdminUser;
  children: React.ReactNode;
  /** 「应急发布过、多语言还没补齐」的内容条数 */
  pendingTranslations?: number;
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
          {/*
            常驻警告条：只要还有内容停在「只发布了中文」的状态就一直显示。
            补齐任务跑完（自动或手动）之后它自己会消失 —— 判断依据是发布记录，
            不是另存的标记，所以不会出现「补齐了但警告还挂着」。
          */}
          {pendingTranslations > 0 ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-300 bg-amber-100 px-5 py-2 text-xs text-amber-900">
              <span className="font-semibold">{t.emergency.statusPending}</span>
              <span>
                {pendingTranslations === 1
                  ? t.emergency.pendingBarOne
                  : formatMessage(t.emergency.pendingBarMany, { count: pendingTranslations })}
              </span>
              <Link href="/admin/sync" className="ml-auto underline underline-offset-2">
                {t.emergency.pendingBarAction} →
              </Link>
            </div>
          ) : null}

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
