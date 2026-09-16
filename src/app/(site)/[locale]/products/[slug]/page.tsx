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
import { getCatalogDict } from '@/lib/i18n/catalog';
import { getProductBySlug } from '@/lib/catalog';
import { getSiteContent } from '@/lib/content';
import { site } from '@/lib/site-config';
import { Container } from '@/components/ui/container';
import { MediaPlaceholder } from '@/components/ui/media-placeholder';
import { ArrowRightIcon } from '@/components/ui/icons';
import { ProductGallery } from '@/components/catalog/product-gallery';
import { ProductInquiry } from '@/components/catalog/product-inquiry';
import { catalogPath, withQuery } from '@/components/catalog/urls';

export const revalidate = 60;

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

  const content = await getSiteContent(l);

  const basePath = catalogPath(l);
  const categoryHref = product.categorySlug
    ? withQuery(basePath, { category: product.categorySlug })
    : null;
  const cover = product.coverUrl ?? product.coverThumbnailUrl;
  const coverAlt = product.coverAlt?.trim() || product.name;
  const overview = product.description?.trim() || product.shortDescription?.trim() || '';
  const spec = product.spec?.trim() ?? '';
  const application = product.application?.trim() ?? '';

  return (
    <article className="pb-16 lg:pb-24">
      <Container className="pt-8">
        <Link
          href={basePath}
          className="inline-flex items-center gap-2 text-sm font-medium text-navy-700 transition-colors hover:text-copper-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
        >
          <ArrowRightIcon className="h-4 w-4 rotate-180" />
          {dict.detail.back}
        </Link>
      </Container>

      <Container className="mt-8">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-14">
          <div>
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element -- 素材来自 OSS 动态域名，接入 next/image remotePatterns 后统一替换
              <img
                src={cover}
                alt={coverAlt}
                loading="eager"
                className="aspect-[4/3] w-full rounded-2xl border border-navy-200/80 object-cover"
              />
            ) : (
              <MediaPlaceholder slot="product.cover" label={product.name} className="aspect-[4/3]" />
            )}
          </div>

          <div className="lg:pt-2">
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

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
              {product.name}
            </h1>

            {product.sku ? (
              <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                <span className="font-medium text-navy-700">{dict.detail.sku}</span>
                <span className="font-mono text-navy-800">{product.sku}</span>
              </p>
            ) : null}

            {product.shortDescription ? (
              <p className="mt-5 text-base leading-relaxed text-muted">{product.shortDescription}</p>
            ) : null}

            {product.usingFallback ? (
              <p className="mt-6 rounded-xl border border-copper-200 bg-copper-50 px-4 py-3 text-sm leading-relaxed text-copper-800">
                {dict.detail.fallbackNotice}
              </p>
            ) : null}
          </div>
        </div>
      </Container>

      {overview || spec || application ? (
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

            {spec ? (
              <section>
                <h2 className="text-xl font-semibold tracking-tight text-navy-900 sm:text-2xl">
                  {dict.detail.specs}
                </h2>
                <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-navy-800">
                  {spec}
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

      {product.gallery.length > 0 ? (
        <Container className="mt-14 lg:mt-20">
          <h2 className="text-xl font-semibold tracking-tight text-navy-900 sm:text-2xl">
            {dict.detail.gallery}
          </h2>
          <ProductGallery
            items={product.gallery}
            fallbackAlt={product.name}
            className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          />
        </Container>
      ) : null}

      <Container className="mt-16 lg:mt-20">
        <ProductInquiry locale={l} product={product} contacts={content.contacts} />
      </Container>
    </article>
  );
}
