import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Inter } from 'next/font/google';
import {
  defaultLocale,
  isLocale,
  localeCodes,
  getDictionary,
  type Locale,
} from '@/lib/i18n';
import { site } from '@/lib/site-config';
import { getSiteContent } from '@/lib/content';
import { resolveChannels } from '@/lib/preview/util';
import { BrandLogo } from '@/components/layout/brand-logo';
import { PreviewHeader } from '@/components/preview/preview-header';
import { PreviewFooter } from '@/components/preview/preview-footer';
import { PreviewContactRail } from '@/components/preview/contact-rail';
import { ThreadRail } from '@/components/preview/thread-rail';
import { ScrollChoreography } from '@/components/preview/scroll-choreography';
import '../../globals.css';
import '../preview.css';

/**
 * 「高端动态首页」设计预览的独立根布局。
 *
 * 预览页位于独立的 (preview) 路由组，拥有自己的页头 / 页脚 / 动效总控，
 * 因此**完全不经过**正式站的 SiteHeader / SiteFooter / ContactActions，
 * 正式首页的渲染结果与代码路径都不受影响。
 *
 * 三语言内容与联系方式依旧来自同一套内容层（数据库优先、字典回退），
 * 语言切换、WhatsApp / Email / 电话链接与无障碍语义全部保留。
 */
const inter = Inter({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  // 预览页不参与索引：不进 sitemap、不进导航、不对外链接
  robots: { index: false, follow: false, nocache: true },
  metadataBase: new URL(site.url),
};

export default async function PreviewLocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const l: Locale = isLocale(locale) ? locale : defaultLocale;
  const code = localeCodes[l];
  const t = getDictionary(l);
  const content = await getSiteContent(l);
  const channels = resolveChannels(l, t, content.contacts);

  return (
    <html lang={code} data-preview className={inter.variable}>
      <head>
        {/*
          在首次绘制前标记 JS 可用：预览样式里所有「初始隐藏、滚动后揭示」的状态
          都限定在 [data-js='on'] 之下，这样关闭 JS 时页面不会有任何内容缺失。
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.setAttribute('data-js','on')",
          }}
        />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:border focus:border-navy-900 focus:bg-ivory-50 focus:px-4 focus:py-2 focus:text-sm focus:text-navy-900"
        >
          {t.common.skipToContent}
        </a>

        <PreviewHeader
          locale={l}
          name={content.company.name}
          logo={<BrandLogo locale={l} className="h-7 w-auto shrink-0" />}
          nav={content.nav}
          ctaHref="#inquiry"
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
          locale={l}
          name={content.company.name}
          tagline={content.company.tagline}
          logo={<BrandLogo locale={l} className="h-8 w-auto shrink-0" />}
          nav={content.nav}
          channels={channels}
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
      </body>
    </html>
  );
}
