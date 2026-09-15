'use client';

import { createContext, useContext } from 'react';
import type { AdminMessages, AdminUiLocale } from '@/lib/admin/i18n';

interface AdminI18nValue {
  locale: AdminUiLocale;
  t: AdminMessages;
}

const AdminI18nContext = createContext<AdminI18nValue | null>(null);

export function AdminI18nProvider({
  locale,
  messages,
  children,
}: {
  locale: AdminUiLocale;
  messages: AdminMessages;
  children: React.ReactNode;
}) {
  return (
    <AdminI18nContext.Provider value={{ locale, t: messages }}>{children}</AdminI18nContext.Provider>
  );
}

function useAdminI18nValue(): AdminI18nValue {
  const value = useContext(AdminI18nContext);
  if (!value) {
    throw new Error('useAdminT() must be used inside <AdminI18nProvider> (see the admin layout)');
  }
  return value;
}

/** Admin UI messages for the current language */
export function useAdminT(): AdminMessages {
  return useAdminI18nValue().t;
}

/** Admin UI language currently selected */
export function useAdminLocale(): AdminUiLocale {
  return useAdminI18nValue().locale;
}
