import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  defaultLocale,
  isLocale,
  localeCodes,
  locales,
  type Locale,
} from '@/lib/i18n';
import { format, getCatalogDict } from '@/lib/i18n/catalog';
import { getProductBySlug, listRelatedProducts } from '@/lib/catalog';
import { getSiteContent } from '@/lib/content';
import { site } from '@/lib/site-config';
import { formatMoq, formatPrice, productUnitLabel, rawHighPrice, rawPrice } from '@/lib/product-format';
import { normalizeCurrency } from '@/lib/pricing';
import { Container } from '@/components/ui/container';
import { ArrowRightIcon } from '@/components/ui/icons';
import { ProductMediaViewer, ProductSpecTable } from '@/components/catalog/product-media-viewer';
import { ProductGrid } from '@/components/catalog/product-grid';
import { ProductInquiry } from '@/components/catalog/product-inquiry';
import { catalogPath, withQuery } from '@/components/catalog/urls';

export const revalidate = 60;

/**
 * 结构化数据：只有存在**真实数字价格**时才输出 Offer。
 * 面议商品绝不伪造价格 —— 伪造的 Offer 既误导搜索引擎，也误导询盘客户。
 */
function productJsonLd(
  product: NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>,
  locale: Locale,
  base: string,
) {
  const url = `${base}/${locale}/products/${encodeURIComponent(product.slug)}`;
  const image = [product.coverUrl, ...product.gallery.filter((m) => m.type === 'image').map((m) => m.url)]
    .filter((value): value is string => Boolean(value))
    .map((value) => (value.startsWith('http') ? value : `${base}${value}`));

  const low = rawPrice(product);
  const high = rawHighPrice(product);
  const currency = normalizeCurrency(product.currency);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.shortDescription ? { description: product.shortDescription } : {}),
    ...(image.length > 0 ? { image } : {}),
    ...(product.categoryName ? { category: product.categoryName } : {}),
    ...(product.specifications.length > 0
      ? {
          additionalProperty: product.specifications
            .filter((spec) => spec.value)
            .map((spec) => ({
              '@type': 'PropertyValue',
              name: spec.name,
              value: spec.value,
            })),
        }
      : {}),
    ...(low
      ? {
          offers: {
            '@type': 'Offer',
            url,
            priceCurrency: currency,
            price: low,
            ...(high && high !== low ? { priceSpecification: {
              '@type': 'PriceSpecification',
              priceCurrency: currency,
              minPrice: low,
              maxPrice: high,
            } } : {}),
            availability: 'https://schema.org/InStock',
          },
        }
      : {}),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const l: Locale = isLocale(locale) ? locale : defaultLocale;
  const product = await getProductBySlug(slug, l);

  if (!product) {
    return { title: getCatalogDict(l).notFound.title };
  }

  const base = site.url;
  const path = `/products/${product.slug}`;
  const languages: Record<string, string> = {};
  for (const loc of locales) languages[localeCodes[loc]] = `${base}/${loc}${path}`;
  languages['x-default'] = `${base}/${defaultLocale}${path}`;

  const title = product.seoTitle?.trim() || product.name;
  const description = product.seoDescription?.trim() || product.shortDescription?.trim() || undefined;
  const image = product.coverUrl ?? product.coverThumbnailUrl;

  return {
    metadataBase: new URL(base),
    title,
    description,
    alternates: {
      canonical: `${base}/${l}${path}`,
      languages,
    },
    openGraph: {
      type: 'website',
      locale: localeCodes[l],
      url: `${base}/${l}${path}`,
      siteName: site.name,
      title,
      ...(description ? { description } : {}),
      ...(image ? { images: [{ url: image, alt: product.coverAlt?.trim() || product.name }] } : {}),
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const l: Locale = isLocale(locale) ? locale : defaultLocale;
  const dict = getCatalogDict(l);

  const product = await getProductBySlug(slug, l);
  if (!product) notFound();

  const [content, related] = await Promise.all([
    getSiteContent(l),
    listRelatedProducts({ id: product.id, categorySlug: product.categorySlug }, l, 3),
  ]);

  const basePath = catalogPath(l);
  const categoryHref = product.categorySlug
    ? withQuery(basePath, { category: product.categorySlug })
    : null;
  const overview = product.description?.trim() || product.shortDescription?.trim() || '';
  const freeTextSpec = product.spec?.trim() ?? '';
  const application = product.application?.trim() ?? '';
  const size = product.sizeSummary?.trim() || null;
  const moq = formatMoq(product.moq, product.moqUnit, l);
  const price = formatPrice(product, l);
  const unit = productUnitLabel(product.priceUnit, l);
  const negotiable = product.priceMode === 'NEGOTIABLE' || !product.priceMin;

  const base = site.url;
  const jsonLd = productJsonLd(product, l, base);

  return (
    <article className="pb-16 lg:pb-24">
      {/* 面包屑 */}
      <Container className="pt-6">
        <nav aria-label={dict.detail.breadcrumbProducts}>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-navy-500">
            <li>
              <Link href={`/${l}`} className="hover:text-copper-700">
                {dict.detail.breadcrumbHome}
              </Link>
            </li>
            <li aria-hidden className="text-navy-300">
              /
            </li>
            <li>
              <Link href={basePath} className="hover:text-copper-700">
                {dict.detail.breadcrumbProducts}
              </Link>
            </li>
            {product.categoryName && categoryHref ? (
              <>
                <li aria-hidden className="text-navy-300">
                  /
                </li>
                <li>
                  <Link href={categoryHref} className="hover:text-copper-700">
                    {product.categoryName}
                  </Link>
                </li>
              </>
            ) : null}
            <li aria-hidden className="text-navy-300">
              /
            </li>
            <li aria-current="page" className="min-w-0 max-w-full truncate font-medium text-navy-900">
              {product.name}
            </li>
          </ol>
        </nav>
      </Container>

      <Container className="mt-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-start lg:gap-14">
          {/* 左：主媒体 + 缩略图（无图时不留空白块） */}
          {product.gallery.length > 0 ? (
            <ProductMediaViewer
              locale={l}
              items={product.gallery}
              fallbackAlt={product.name}
              className="min-w-0"
            />
          ) : null}

          {/* 右：产品概要 */}
          <div className="min-w-0 lg:pt-1">
            {product.categoryName ? (
              categoryHref ? (
                <Link
                  href={categoryHref}
                  className="inline-flex w-fit items-center rounded-full bg-copper-50 px-3.5 py-1.5 text-xs font-medium text-copper-700 transition-colors hover:bg-copper-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
                >
                  {product.categoryName}
                </Link>
              ) : (
                <span className="inline-flex w-fit items-center rounded-full bg-copper-50 px-3.5 py-1.5 text-xs font-medium text-copper-700">
                  {product.categoryName}
                </span>
              )
            ) : null}

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-navy-900 sm:text-[2.1rem] sm:leading-tight">
              {product.name}
            </h1>

            {product.sku ? (
              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                <span className="font-medium text-navy-700">{dict.detail.sku}</span>
                <span className="font-mono text-navy-800">{product.sku}</span>
              </p>
            ) : null}

            {product.shortDescription ? (
              <p className="mt-4 text-base leading-relaxed text-muted">{product.shortDescription}</p>
            ) : null}

            {/* 价格 / 贸易信息：未填写的行直接隐藏，不渲染空框 */}
            <dl className="mt-7 divide-y divide-navy-100 border-y border-navy-100">
              <div className="flex flex-wrap items-baseline justify-between gap-3 py-4">
                <dt className="text-sm text-navy-500">{dict.detail.priceLabel}</dt>
                <dd
                  className={
                    negotiable
                      ? 'text-lg font-medium text-navy-700'
                      : 'text-lg font-semibold tracking-tight text-copper-800'
                  }
                >
                  {price}
                </dd>
              </div>
              {unit ? (
                <div className="flex flex-wrap items-baseline justify-between gap-3 py-4">
                  <dt className="text-sm text-navy-500">{dict.detail.unitLabel}</dt>
                  <dd className="text-sm text-navy-900">{unit}</dd>
                </div>
              ) : null}
              {moq ? (
                <div className="flex flex-wrap items-baseline justify-between gap-3 py-4">
                  <dt className="text-sm text-navy-500">{dict.detail.moqLabel}</dt>
                  <dd className="text-sm text-navy-900">{moq}</dd>
                </div>
              ) : null}
              {size ? (
                <div className="flex flex-wrap items-baseline justify-between gap-3 py-4">
                  <dt className="text-sm text-navy-500">{dict.detail.sizeLabel}</dt>
                  <dd className="text-sm text-navy-900">{size}</dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="#inquiry"
                className="inline-flex h-11 items-center rounded-full bg-copper-700 px-6 text-sm font-medium text-ivory-50 transition-colors hover:bg-copper-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
              >
                {dict.detail.sendInquiry}
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </div>

            {product.usingFallback ? (
              <p className="mt-6 rounded-xl border border-copper-200 bg-copper-50 px-4 py-3 text-sm leading-relaxed text-copper-800">
                {dict.detail.fallbackNotice}
              </p>
            ) : null}
          </div>
        </div>
      </Container>

      {/* 产品介绍 / 结构化规格 / 应用场景：全部为空时整个区块不渲染 */}
      {overview || product.specifications.length > 0 || freeTextSpec || application ? (
        <Container className="mt-14 lg:mt-20">
          <div className="max-w-3xl space-y-12">
            {overview ? (
              <section>
                <h2 className="text-xl font-semibold tracking-tight text-navy-900 sm:text-2xl">
                  {dict.detail.overview}
                </h2>
                <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-navy-800">
                  {overview}
                </p>
              </section>
            ) : null}

            {product.specifications.length > 0 ? (
              <section>
                <h2 className="text-xl font-semibold tracking-tight text-navy-900 sm:text-2xl">
                  {dict.detail.specs}
                </h2>
                <ProductSpecTable
                  specs={product.specifications}
                  caption={dict.detail.specs}
                  className="mt-4"
                />
                {freeTextSpec ? (
                  <p className="mt-6 whitespace-pre-line text-base leading-relaxed text-navy-800">
                    {freeTextSpec}
                  </p>
                ) : null}
              </section>
            ) : freeTextSpec ? (
              <section>
                <h2 className="text-xl font-semibold tracking-tight text-navy-900 sm:text-2xl">
                  {dict.detail.specs}
                </h2>
                <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-navy-800">
                  {freeTextSpec}
                </p>
              </section>
            ) : null}

            {application ? (
              <section>
                <h2 className="text-xl font-semibold tracking-tight text-navy-900 sm:text-2xl">
                  {dict.detail.applications}
                </h2>
                <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-navy-800">
                  {application}
                </p>
              </section>
            ) : null}
          </div>
        </Container>
      ) : null}

      {/* 图库：与顶部查看器相互独立，保证「所有图片」始终可访问（含无 JavaScript 时） */}
      {product.gallery.length > 1 ? (
        <Container className="mt-14 lg:mt-20">
          <h2 className="text-xl font-semibold tracking-tight text-navy-900 sm:text-2xl">
            {dict.detail.gallery}
          </h2>
          <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {product.gallery.map((item) => {
              const label = item.alt.trim() || product.name;
              return (
                <li key={item.id}>
                  {item.type === 'video' && item.url ? (
                    <video
                      className="aspect-[4/3] w-full rounded-xl border border-navy-200/80 bg-navy-950 object-cover"
                      controls
                      preload="metadata"
                      poster={item.posterUrl?.trim() || undefined}
                      aria-label={label}
                    >
                      <source src={item.url} />
                    </video>
                  ) : item.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 素材来自 OSS 动态域名，接入 next/image remotePatterns 后统一替换
                    <img
                      src={item.thumbnailUrl ?? item.url}
                      alt={label}
                      loading="lazy"
                      className="aspect-[4/3] w-full rounded-xl border border-navy-200/80 bg-white object-cover"
                    />
                  ) : null}
                  {item.caption ? (
                    <p className="mt-2.5 text-sm leading-relaxed text-muted">{item.caption}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Container>
      ) : null}

      <Container className="mt-16 lg:mt-20">
        <div id="inquiry" className="scroll-mt-24">
          <ProductInquiry locale={l} product={product} contacts={content.contacts} />
        </div>
      </Container>

      {related.length > 0 ? (
        <Container className="mt-16 lg:mt-20">
          <h2 className="text-xl font-semibold tracking-tight text-navy-900 sm:text-2xl">
            {dict.detail.relatedTitle}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {product.categoryName
              ? format(dict.detail.relatedSubtitle, { category: product.categoryName })
              : dict.detail.relatedFallbackSubtitle}
          </p>
          <div className="mt-3 h-px w-16 bg-copper-300" />
          <ProductGrid locale={l} products={related} className="mt-10" />
        </Container>
      ) : null}

      <script
        type="application/ld+json"
        // JSON.stringify 的输出里 `<` 会被转义，避免 `</script>` 提前闭合标签
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
    </article>
  );
}
