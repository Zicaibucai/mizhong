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
import { withLocale } from '@/lib/href';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { ContactActions } from '@/components/layout/contact-actions';
import '../../globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  variable: '--font-inter',
  display: 'swap',
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/**
 * 允许按需生成未知语言段。
 *
 * 这里刻意 **不** 设置 `dynamicParams = false`：
 * 与 ISR（下面的 revalidate）同时使用时，一次增量重新生成会覆盖构建期的预渲染产物并丢失
 * `x-nextjs-prerender` 标记，Next 随后判定该路径「未预渲染」，在 dynamicParams=false 下直接
 * 抛出 NoFallbackError 并返回 404——整站会因此长时间不可用。
 * 非法语言由布局里的 isLocale() 判断后走 notFound()，不需要依赖路由层的这道限制。
 */
export const dynamicParams = true;

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

  // 导航地址统一补语言前缀：内容层里是 `/products` 这类与语言无关的写法，
  // 直接交给浏览器会落到 middleware 的 308，并被带到默认语言 zh ——
  // 于是 /en 与 /vi 的访客点「产品」会掉回中文站。
  // 页头、移动端菜单与页脚共用这一份结果，判断只在这里做一次。
  const nav = content.nav.map((item) => ({ ...item, href: withLocale(locale, item.href) }));

  return (
    <html lang={code} className={inter.variable}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-navy-900 focus:px-4 focus:py-2 focus:text-sm focus:text-ivory-50"
        >
          {t.common.skipToContent}
        </a>
        <SiteHeader locale={locale} name={content.company.name} nav={nav} />
        <main id="main">{children}</main>
        <SiteFooter
          locale={locale}
          company={content.company}
          contacts={content.contacts}
          nav={nav}
        />
        <ContactActions locale={locale} contacts={content.contacts} />
      </body>
    </html>
  );
}
