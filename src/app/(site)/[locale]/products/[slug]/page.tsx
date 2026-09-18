import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import {
  defaultLocale,
  isLocale,
  localeCodes,
  type Locale,
} from '@/lib/i18n';
import { getCatalogDict } from '@/lib/i18n/catalog';
import { getProductBySlug, listRelatedProducts, strictLocaleFallbackEnabled } from '@/lib/catalog';
import { tryDb } from '@/lib/db';
import { findSlugRedirect } from '@/lib/slug-history';
import { getSiteContent } from '@/lib/content';
import { site } from '@/lib/site-config';
import { productJsonLd } from '@/lib/product-jsonld';
import { resolveFallbackSeo, resolveProductMetadata } from '@/lib/product-metadata';
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

  /**
   * hreflang 只列出**真正有该语言内容**的版本。
   *
   * 之前是 11 种语言全列 —— 商品只有中文时，等于对外声明「阿拉伯语版本在这里」，
   * 而那个地址指向的是中文内容，属于跨语言污染。现在没有内容的语言一律不出现在 hreflang 里。
   * x-default 指向默认语言（中文）—— 它一定存在，因为商品名称的中文是发布的前提。
   */
  const contentLocales = product.contentLocales;
  const languages: Record<string, string> = {};
  for (const loc of contentLocales) languages[localeCodes[loc]] = `${base}/${loc}${path}`;
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

  /**
   * 这个地址现在显示的是不是**别的语言**的内容。
   *
   * 是的话：noindex、canonical 指向真正承载这份内容的语言地址、
   * 并且（由上面的 contentLocales 保证）不进 hreflang —— 否则同一个英文页面
   * 会在索引里出现十次，每次挂一个不同的语言标签。
   */
  const fallbackSeo = resolveFallbackSeo({
    locale: l,
    fallbackLocale: product.fallbackLocale,
    path,
    strict: strictLocaleFallbackEnabled(),
  });
  const canonicalUrl = `${base}${fallbackSeo.canonicalPath}`;

  return {
    metadataBase: new URL(base),
    title,
    description,
    // 只有真的在显示别的语言内容时才 noindex；第二阶段翻译到位后自动消失
    ...(fallbackSeo.noindex ? { robots: { index: false, follow: true } } : {}),
    alternates: {
      canonical: canonicalUrl,
      languages,
    },
    openGraph: {
      type: 'website',
      locale: localeCodes[l],
      url: canonicalUrl,
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

  /**
   * 查不到内容时，先看看这是不是一个改过的旧地址。
   *
   * 管理员主动改 slug 之后，旧链接、搜索引擎索引、客户收藏夹都还指着旧地址。
   * 直接把它们变成 404 是静默的损失（页面本身一切正常，只是那些流量没了），
   * 所以这里用一次 301 把人送到新地址。
   *
   * 这次查询**只在本来就要 404 的路径上发生** —— 正常访问一次都不会多查。
   */
  if (!product) {
    const moved = await tryDb((db) => findSlugRedirect(db, 'product', slug));
    if (moved) permanentRedirect(`/${l}/products/${encodeURIComponent(moved)}`);
    notFound();
  }

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
