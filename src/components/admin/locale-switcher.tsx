'use client';

import { useRouter } from 'next/navigation';
import { ADMIN_LOCALE_COOKIE, ADMIN_UI_LOCALES, type AdminUiLocale } from '@/lib/admin/i18n';
import { useAdminLocale, useAdminT } from './i18n-provider';
import { cn } from '@/lib/cn';

/**
 * "English" and "中文" are the language's own names, so they are intentionally the only
 * Chinese characters outside of the `zh` message dictionary.
 */
const OPTION_LABELS: Record<AdminUiLocale, string> = {
  en: 'English',
  zh: '中文',
};

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function LocaleSwitcher() {
  const t = useAdminT();
  const active = useAdminLocale();
  const router = useRouter();

  function select(locale: AdminUiLocale) {
    if (locale === active) return;
    document.cookie = `${ADMIN_LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
    router.refresh();
  }

  return (
    <div
      role="group"
      aria-label={t.localeSwitcher.label}
      className="inline-flex shrink-0 items-center rounded-full border border-navy-200 bg-navy-50 p-0.5"
    >
      {ADMIN_UI_LOCALES.map((locale) => {
        const isActive = locale === active;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => select(locale)}
            aria-pressed={isActive}
            aria-current={isActive ? 'true' : undefined}
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500',
              isActive ? 'bg-navy-900 text-ivory-50' : 'text-navy-600 hover:bg-navy-100',
            )}
          >
            {OPTION_LABELS[locale]}
          </button>
        );
      })}
    </div>
  );
}
