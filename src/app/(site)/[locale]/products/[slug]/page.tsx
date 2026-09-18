import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  defaultLocale,
  isLocale,
  localeCodes,
  locales,
  type Locale,
} from '@/lib/i18n';
import { getCatalogDict } from '@/lib/i18n/catalog';
import { getProductBySlug, listRelatedProducts } from '@/lib/catalog';
import { getSiteContent } from '@/lib/content';
import { site } from '@/lib/site-config';
import { productJsonLd } from '@/lib/product-jsonld';
import { resolveProductMetadata } from '@/lib/product-metadata';
import { ProductDetail } from '@/components/catalog/product-detail';

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

  // 与后台「SEO」分区的灰色占位提示共用同一套回退规则（见 lib/product-metadata.ts），
  // 避免出现「后台提示会用商品名，前台却没生效」这类不一致。
  const meta = resolveProductMetadata({
    name: product.name,
    shortDescription: product.shortDescription,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    coverUrl: product.coverUrl,
    coverThumbnailUrl: product.coverThumbnailUrl,
    coverAlt: product.coverAlt,
  });
  const title = meta.title;
  const description = meta.description;
  const image = meta.image;

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
      ...(image ? { images: [{ url: image, alt: meta.imageAlt }] } : {}),
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

  const product = await getProductBySlug(slug, l);
  if (!product) notFound();

  const [content, related] = await Promise.all([
    getSiteContent(l),
    listRelatedProducts({ id: product.id, categorySlug: product.categorySlug }, l, 3),
  ]);

  const jsonLd = productJsonLd(product, l, site.url);

  return (
    <>
      <ProductDetail
        locale={l}
        product={product}
        contacts={content.contacts}
        related={related}
      />
      <script
        type="application/ld+json"
        // JSON.stringify 的输出里 `<` 会被转义，避免 `</script>` 提前闭合标签
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
    </>
  );
}
