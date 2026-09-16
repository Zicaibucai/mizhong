import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { defaultLocale, isLocale, getDictionary, type Locale } from '@/lib/i18n';
import { getBlock, getSiteContent } from '@/lib/content';
import { listProducts } from '@/lib/catalog';
import { getPreviewCopy } from '@/lib/preview/content';
import { inquiryHref, resolveChannels, withLocale } from '@/lib/preview/util';
import { PreviewHero } from '@/components/preview/sections/hero';
import { PreviewAbout } from '@/components/preview/sections/about';
import { PreviewProducts } from '@/components/preview/sections/products';
import { PreviewProcess } from '@/components/preview/sections/process';
import { PreviewQuality } from '@/components/preview/sections/quality';
import { PreviewInquiry } from '@/components/preview/sections/inquiry';

/**
 * 高端动态首页设计预览 —— /zh|en|vi/design-preview
 *
 * 目的：不替换正式首页，先以独立路由交付一个可评审的「Material Intelligence /
 * Editorial Textile」方向：编辑式栅格、超大排版、织纹视觉语言与滚动叙事。
 *
 * 内容来源与正式首页完全一致（数据库优先、字典回退），因此三种语言的文案、
 * 公司资料（name / tagline / about / positioning）与联系方式都是后台的真实内容，
 * 不引入任何未经确认的事实、数据、证书或影像。
 * 产品区读取后台**已发布**的商品；后台还没有已发布商品时退回产品分类概览。
 *
 * 不参与索引：路由不在 sitemap 中、不在导航中，metadata 设置 noindex。
 * 该页面为纯展示预览，不写库、不改动任何现有数据。
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

/** 区块序号：与版面上的编辑式编号一致 */
const SECTION = {
  hero: '01',
  materials: '02',
  about: '03',
  process: '04',
  quality: '05',
  inquiry: '06',
} as const;

/** 首页展示的商品数量上限：版面上是两行编辑式栅格，更多请进入完整目录 */
const FEATURED_LIMIT = 6;

/** 区块里的按钮地址：站内路径补语言前缀，其余（锚点 / 外链）原样保留 */
function blockHref(locale: Locale, raw: string, fallback: string): string {
  const value = (raw ?? '').trim();
  if (value.startsWith('/')) return withLocale(locale, value);
  return fallback;
}

export default async function DesignPreviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const l: Locale = isLocale(locale) ? locale : defaultLocale;
  const t = getDictionary(l);
  const copy = getPreviewCopy(l);
  const content = await getSiteContent(l);

  const hero = getBlock(content, 'hero');
  const products = getBlock(content, 'products');
  const supply = getBlock(content, 'supply');
  const quality = getBlock(content, 'quality');
  const inquiry = getBlock(content, 'inquiry');

  // 只取已发布商品；数据库不可用或暂无商品时返回空数组，产品区退回分类概览
  const catalogueHref = `/${l}/products`;
  const { items: productItems } = await listProducts({ locale: l, page: 1 });
  const featured = productItems.slice(0, FEATURED_LIMIT);

  const channels = resolveChannels(l, t, content.contacts);

  return (
    <>
      {/* 01 —— 电影感首屏 */}
      <PreviewHero
        locale={l}
        eyebrow={t.hero.eyebrow}
        title={hero.title}
        subtitle={hero.subtitle || t.hero.subtitle}
        primaryLabel={hero.ctaLabel || t.hero.ctaPrimary}
        primaryHref={blockHref(l, hero.ctaHref, catalogueHref)}
        secondaryLabel={t.hero.ctaSecondary}
        secondaryHref="#inquiry"
        categories={t.products.categories}
        categoryHref={catalogueHref}
        indexLabel={t.products.eyebrow}
        scrollLabel={t.preview.scroll}
      />

      {/* 02 —— 产品：真实已发布商品，暂无则退回分类概览 */}
      <PreviewProducts
        locale={l}
        index={SECTION.materials}
        eyebrow={t.products.eyebrow}
        title={products.title}
        subtitle={products.subtitle}
        catalogueHref={catalogueHref}
        products={featured}
        categories={t.products.categories}
        copy={copy}
        artworkLabel={t.preview.artwork}
      />

      {/* 03 —— 公司介绍：与正式首页读取同一份后台公司资料 */}
      <PreviewAbout locale={l} index={SECTION.about} company={content.company} />

      {/* 04 —— 采购流程：受控高度的 sticky 时间线 */}
      <PreviewProcess
        locale={l}
        index={SECTION.process}
        eyebrow={t.supply.eyebrow}
        title={supply.title}
        subtitle={supply.subtitle}
        stageLabel={t.preview.stage}
        points={t.supply.points}
        capabilities={t.capabilities.items}
        artworkLabel={t.preview.artwork}
      />

      {/* 05 —— 质量与信任：通用质量流程 + 材料细节 */}
      <PreviewQuality
        locale={l}
        index={SECTION.quality}
        eyebrow={t.quality.eyebrow}
        title={quality.title}
        subtitle={quality.subtitle}
        body={quality.body}
        copy={copy}
        certificatesTitle={t.quality.certificatesTitle}
        certificatesNote={t.quality.certificatesNote}
        artworkLabel={t.preview.artwork}
      />

      {/* 06 —— 全球询盘：联系方式 + 目录入口 + 发起询盘 */}
      <PreviewInquiry
        index={SECTION.inquiry}
        eyebrow={t.inquiry.eyebrow}
        title={inquiry.title}
        subtitle={inquiry.subtitle}
        note={t.inquiry.note}
        channels={channels}
        channelsLabel={t.preview.channels}
        catalogueHref={catalogueHref}
        browseProductsLabel={copy.browseProducts}
        inquiryHref={inquiryHref(channels, copy.inquirySubject)}
        inquiryLabel={t.nav.cta}
        hint={copy.inquiryHint}
      />
    </>
  );
}
