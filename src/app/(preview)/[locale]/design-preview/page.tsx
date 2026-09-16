import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { defaultLocale, isLocale, getDictionary, type Locale } from '@/lib/i18n';
import { getBlock, getSiteContent } from '@/lib/content';
import { resolveChannels } from '@/lib/preview/util';
import { PreviewHero } from '@/components/preview/sections/hero';
import { PreviewMaterials } from '@/components/preview/sections/materials';
import { PreviewProcess } from '@/components/preview/sections/process';
import { PreviewQuality } from '@/components/preview/sections/quality';
import { PreviewInquiry } from '@/components/preview/sections/inquiry';

/**
 * 高端动态首页设计预览 —— /zh|en|vi/design-preview
 *
 * 目的：不替换正式首页，先以独立路由交付一个可评审的「Material Intelligence /
 * Editorial Textile」方向：编辑式栅格、超大排版、织纹视觉语言与滚动叙事。
 *
 * 内容来源与正式首页完全一致（数据库优先、字典回退），因此三种语言的文案与
 * 联系方式都是真实内容，不引入任何未经确认的事实、数据、证书或影像。
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
  process: '03',
  quality: '04',
  inquiry: '05',
} as const;

export default async function DesignPreviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const l: Locale = isLocale(locale) ? locale : defaultLocale;
  const t = getDictionary(l);
  const content = await getSiteContent(l);

  const hero = getBlock(content, 'hero');
  const products = getBlock(content, 'products');
  const supply = getBlock(content, 'supply');
  const quality = getBlock(content, 'quality');
  const inquiry = getBlock(content, 'inquiry');

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
        primaryHref={hero.ctaHref || '#products'}
        secondaryLabel={t.hero.ctaSecondary}
        secondaryHref="#inquiry"
        categories={t.products.categories}
        indexLabel={t.products.eyebrow}
        scrollLabel={t.preview.scroll}
      />

      {/* 02 —— 材料分类：编辑式节奏排布 */}
      <PreviewMaterials
        locale={l}
        index={SECTION.materials}
        eyebrow={t.products.eyebrow}
        title={products.title}
        subtitle={products.subtitle}
        ctaLabel={products.ctaLabel || t.products.cta}
        ctaHref={products.ctaHref || '#inquiry'}
        categories={t.products.categories}
        artworkLabel={t.preview.artwork}
      />

      {/* 03 —— 采购流程：sticky 分阶段叙事 */}
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

      {/* 04 —— 质量与信任：材料细节 + 技术标注 */}
      <PreviewQuality
        locale={l}
        index={SECTION.quality}
        eyebrow={t.quality.eyebrow}
        title={quality.title}
        subtitle={quality.subtitle}
        body={quality.body}
        principles={t.quality.principles}
        certificatesTitle={t.quality.certificatesTitle}
        certificatesNote={t.quality.certificatesNote}
        artworkLabel={t.preview.artwork}
      />

      {/* 05 —— 全球询盘 */}
      <PreviewInquiry
        index={SECTION.inquiry}
        eyebrow={t.inquiry.eyebrow}
        title={inquiry.title}
        subtitle={inquiry.subtitle}
        note={t.inquiry.note}
        channels={channels}
        channelsLabel={t.preview.channels}
      />
    </>
  );
}
