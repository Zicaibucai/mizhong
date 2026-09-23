import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Inter } from 'next/font/google';
import {
  locales,
  defaultLocale,
  isLocale,
  localeCodes,
  localeDirs,
  getDictionary,
  type Locale,
} from '@/lib/i18n';
import { site } from '@/lib/site-config';
import { getSiteContent } from '@/lib/content';
import { organizationJsonLd, websiteJsonLd } from '@/lib/structured-data';
import { companyName } from '@/lib/site-config';
import { withLocale } from '@/lib/href';
import { resolveChannels } from '@/lib/preview/util';
import { BrandLogo } from '@/components/layout/brand-logo';
import { PreviewHeader } from '@/components/preview/preview-header';
import { PreviewFooter } from '@/components/preview/preview-footer';
import { PreviewContactRail } from '@/components/preview/contact-rail';
import { ThreadRail } from '@/components/preview/thread-rail';
import { ScrollChoreography } from '@/components/preview/scroll-choreography';
import '../../globals.css';
import '../../(preview)/preview.css';

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

  /**
   * 子页面标题统一追加品牌。
   *
   * 原先 `title` 是一个纯字符串，Next 不做任何拼接 —— 结果商品页的标题就是
   * 「圆形垫边」、目录页就是「产品目录」，**全站除首页外没有一处含公司名**：
   * 搜品牌名搜不到，页面标题之间也几乎没有区别（2026-09-22 修）。
   * `default` 给未自行设置标题的页面（首页等）；`template` 只作用于设了标题的子页面。
   */
  const titleTemplate = `%s ${site.titleSeparator} ${content.company.name}`;

  return {
    metadataBase: new URL(base),
    title: { default: title, template: titleTemplate },
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
  const channels = resolveChannels(locale, t, content.contacts);

  // 导航地址统一补语言前缀：内容层里是 `/products` 这类与语言无关的写法，
  // 直接交给浏览器会落到 middleware 的 308，并被带到默认语言 zh ——
  // 于是 /en 与 /vi 的访客点「产品」会掉回中文站。
  // 页头、移动端菜单与页脚共用这一份结果，判断只在这里做一次。
  const nav = content.nav.map((item) => ({
    ...item,
    // 产品、搜索和详情内页没有首页区块；锚点导航统一回到当前语言首页。
    href: item.href.startsWith('#') ? `/${locale}${item.href}` : withLocale(locale, item.href),
  }));

  /**
   * 结构化数据：声明「这个站点属于哪家公司」。
   *
   * 之前全站只有商品页有 Product 结构化数据，没有 Organization —— 搜索引擎
   * 没有依据把 htd123.com 与「米众新材料」这个实体对上，品牌名检索因此更吃亏。
   * 只写已知为真的字段：没有地址就不写 address，没有外链就不写 sameAs。
   */
  const structuredData = [
    organizationJsonLd({
      locale,
      url: site.url,
      name: content.company.name,
      legalName: companyName(locale),
      contacts: content.contacts,
    }),
    websiteJsonLd({ locale, url: site.url, name: content.company.name }),
  ];

  return (
    <html lang={code} dir={localeDirs[locale]} data-preview className={inter.variable}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-navy-900 focus:px-4 focus:py-2 focus:text-sm focus:text-ivory-50"
        >
          {t.common.skipToContent}
        </a>
        <PreviewHeader
          locale={locale}
          name={content.company.name}
          logo={<BrandLogo locale={locale} className="h-9 w-auto shrink-0" />}
          nav={nav}
          ctaHref={`/${locale}#inquiry`}
          homeHref={`/${locale}`}
          labels={{
            menu: t.nav.menu,
            close: t.nav.close,
            mobileNav: t.nav.mobile,
            primaryNav: t.nav.primary,
            lang: t.lang.label,
            cta: t.nav.cta,
          }}
        />
        <main id="main">{children}</main>
        <PreviewFooter
          locale={locale}
          name={content.company.name}
          tagline={content.company.tagline}
          logo={<BrandLogo locale={locale} className="h-12 w-auto shrink-0" />}
          nav={nav}
          channels={channels}
          homeLanguages
          labels={{
            company: t.footer.companyTitle,
            contact: t.footer.contactTitle,
            language: t.lang.label,
            copyright: t.footer.copyright,
          }}
        />
        <PreviewContactRail channels={channels} />
        <ThreadRail />
        <ScrollChoreography />
        {structuredData.map((data, index) => (
          <script
            key={index}
            type="application/ld+json"
            // 与商品页同一套转义：JSON 里的 `<` 一律写成 <，避免提前闭合 script
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
          />
        ))}
      </body>
    </html>
  );
}
