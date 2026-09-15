import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Inter } from 'next/font/google';
import {
  locales,
  defaultLocale,
  isLocale,
  localeCodes,
  getDictionary,
  type Locale,
} from '@/lib/i18n';
import { site } from '@/lib/site-config';
import { getSiteContent } from '@/lib/content';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import '../../globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  variable: '--font-inter',
  display: 'swap',
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const dynamicParams = false;

/** ISR：后台保存后会通过 revalidatePath 立即刷新，此处作为兜底 */
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const l: Locale = isLocale(locale) ? locale : defaultLocale;
  const code = localeCodes[l];
  const t = getDictionary(l);
  const content = await getSiteContent(l);
  const base = site.url;

  const languages: Record<string, string> = {};
  for (const loc of locales) languages[localeCodes[loc]] = `${base}/${loc}`;
  languages['x-default'] = `${base}/${defaultLocale}`;

  const title =
    content.company.seoTitle || `${content.company.name} ${site.titleSeparator} ${t.meta.title}`;
  const description = content.company.seoDescription || t.meta.description;

  return {
    metadataBase: new URL(base),
    title,
    description,
    alternates: {
      canonical: `${base}/${l}`,
      languages,
    },
    openGraph: {
      type: 'website',
      locale: code,
      url: `${base}/${l}`,
      siteName: content.company.name,
      title,
      description,
      alternateLocale: locales.map((loc) => localeCodes[loc]),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const code = localeCodes[locale];
  const t = getDictionary(locale);
  const content = await getSiteContent(locale);

  return (
    <html lang={code} className={inter.variable}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-navy-900 focus:px-4 focus:py-2 focus:text-sm focus:text-ivory-50"
        >
          {t.common.skipToContent}
        </a>
        <SiteHeader locale={locale} name={content.company.name} nav={content.nav} />
        <main id="main">{children}</main>
        <SiteFooter
          locale={locale}
          company={content.company}
          contacts={content.contacts}
          nav={content.nav}
        />
      </body>
    </html>
  );
}
