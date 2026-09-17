import { getDictionary, type Locale } from '@/lib/i18n';
import { getBlock, getSiteContent } from '@/lib/content';
import { listProducts } from '@/lib/catalog';
import { getPreviewCopy } from '@/lib/preview/content';
import { inquiryHref, resolveChannels, withLocale } from '@/lib/preview/util';
import { PreviewHero } from './sections/hero';
import { PreviewAbout } from './sections/about';
import { PreviewProducts } from './sections/products';
import { PreviewProcess } from './sections/process';
import { PreviewQuality } from './sections/quality';
import { PreviewInquiry } from './sections/inquiry';

/**
 * Preview 2.0 的唯一首页实现。
 *
 * 正式首页与 /design-preview 共用这一组件，避免评审版与上线版长期分叉。
 * 页面只读取现有内容、已发布商品和真实联系方式，不虚构产能、证书或客户数据。
 */

const SECTION = {
  hero: '01',
  materials: '02',
  about: '03',
  process: '04',
  quality: '05',
  inquiry: '06',
} as const;

const FEATURED_LIMIT = 6;

function blockHref(locale: Locale, raw: string, fallback: string): string {
  const value = (raw ?? '').trim();
  if (value.startsWith('/')) return withLocale(locale, value);
  return fallback;
}

export async function PreviewHome({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const copy = getPreviewCopy(locale);
  const content = await getSiteContent(locale);

  const hero = getBlock(content, 'hero');
  const products = getBlock(content, 'products');
  const supply = getBlock(content, 'supply');
  const quality = getBlock(content, 'quality');
  const inquiry = getBlock(content, 'inquiry');

  const catalogueHref = `/${locale}/products`;
  const { items } = await listProducts({ locale, page: 1 });
  const channels = resolveChannels(locale, t, content.contacts);

  return (
    <>
      <PreviewHero
        locale={locale}
        eyebrow={t.hero.eyebrow}
        title={hero.title}
        subtitle={hero.subtitle || t.hero.subtitle}
        primaryLabel={hero.ctaLabel || t.hero.ctaPrimary}
        primaryHref={blockHref(locale, hero.ctaHref, catalogueHref)}
        secondaryLabel={t.hero.ctaSecondary}
        secondaryHref="#inquiry"
        categories={t.products.categories}
        categoryHref={catalogueHref}
        indexLabel={t.products.eyebrow}
        scrollLabel={t.preview.scroll}
      />

      <PreviewProducts
        locale={locale}
        index={SECTION.materials}
        eyebrow={t.products.eyebrow}
        title={products.title}
        subtitle={products.subtitle}
        catalogueHref={catalogueHref}
        products={items.slice(0, FEATURED_LIMIT)}
        categories={t.products.categories}
        copy={copy}
        artworkLabel={t.preview.artwork}
      />

      <PreviewAbout locale={locale} index={SECTION.about} company={content.company} />

      <PreviewProcess
        locale={locale}
        index={SECTION.process}
        eyebrow={t.supply.eyebrow}
        title={supply.title}
        subtitle={supply.subtitle}
        stageLabel={t.preview.stage}
        points={t.supply.points}
        capabilities={t.capabilities.items}
        artworkLabel={t.preview.artwork}
      />

      <PreviewQuality
        locale={locale}
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
