import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { isDbConfigured } from '@/lib/db';
import { getAdminMessagesForRequest } from '@/lib/admin/i18n';
import { LocaleSwitcher } from '@/components/admin/locale-switcher';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminMessagesForRequest();
  return {
    title: `${t.loginPage.subtitle} · Mizhong Trading Co., Ltd.`,
    description: t.loginPage.subtitle,
    robots: { index: false, follow: false },
  };
}

export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  if (user) redirect('/admin');

  const { t } = await getAdminMessagesForRequest();

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-5 py-12 texture-weave-dark">
      <div className="w-full max-w-sm rounded-2xl border border-navy-800 bg-ivory-50 p-8 shadow-xl shadow-navy-950/30">
        <h1 className="text-lg font-semibold tracking-tight text-navy-900">Mizhong Trading Co., Ltd.</h1>
        <p className="mt-1 text-sm text-muted">{t.loginPage.subtitle}</p>
        <div className="mt-7">
          <LoginForm dbReady={isDbConfigured()} />
        </div>
        <p className="mt-6 text-xs leading-relaxed text-navy-500">
          {t.loginPage.restrictedBefore}
          <code className="mx-1 rounded bg-navy-100 px-1 py-0.5">npm run admin:create</code>
          {t.loginPage.restrictedAfter}
        </p>
        <div className="mt-6 flex justify-center border-t border-navy-100 pt-5">
          <LocaleSwitcher />
        </div>
      </div>
    </div>
  );
}
