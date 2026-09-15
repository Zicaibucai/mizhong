import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../../globals.css';
import { ADMIN_HTML_LANG, getAdminMessagesForRequest } from '@/lib/admin/i18n';
import { AdminI18nProvider } from '@/components/admin/i18n-provider';

const inter = Inter({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  variable: '--font-inter',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminMessagesForRequest();
  return {
    title: `${t.shell.subtitle} · Mizhong Trading Co., Ltd.`,
    description: t.shell.subtitle,
    robots: { index: false, follow: false },
  };
}

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getAdminMessagesForRequest();

  return (
    <html lang={ADMIN_HTML_LANG[locale]} className={inter.variable}>
      <body>
        <AdminI18nProvider locale={locale} messages={t}>
          {children}
        </AdminI18nProvider>
      </body>
    </html>
  );
}
