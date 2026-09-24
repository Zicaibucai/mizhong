import type { ProductDetailView } from '@/lib/catalog';
import type { Locale } from '@/lib/i18n/config';
import { rawHighPrice, rawPrice } from '@/lib/product-format';
import { normalizeCurrency } from '@/lib/pricing';
import { companyName } from '@/lib/site-config';

/**
 * 商品的结构化数据。
 *
 * **只有存在真实数字价格时才输出 Offer。** 这不是省事，是刻意为之：
 *
 * - Google 的商品富媒体结果要求 `Product` 至少带 `offers` / `review` /
 *   `aggregateRating` 三者之一。我们的商品是**面议**（NEGOTIABLE），没有价格，
 *   于是 GSC 会报「应指定 offers、review 或 aggregateRating」。
 * - 那个提示的性质是**「该页面不符合富媒体资格」**，不是处罚：商品本身照常被收录、
 *   照常参与排名，只是不会出现带价格/评分的那种卡片。
 * - 剩下两条路都不能走：编一个价格（误导搜索引擎与客户），或者编评分（我们没有评价，
 *   伪造评分可能招致人工处置）。**面议的 B2B 商品本来就不该出价格卡片。**
 * - 一旦某个商品在后台填了真实价格（FIXED / RANGE），下面的 Offer 会自动出现，
 *   什么都不用改。
 *
 * 保留 `Product` 标记仍有价值：名称、型号、描述、分类、品牌这些是实体信号，
 * 也是「搜型号能找到我们」的辅助。
 */
export function productJsonLd(
  product: ProductDetailView,
  locale: Locale,
  base: string,
) {
  const url = `${base}/${locale}/products/${encodeURIComponent(product.slug)}`;
  const image = [
    product.coverUrl,
    ...product.gallery.filter((m) => m.type === 'image').map((m) => m.url),
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => (value.startsWith('http') ? value : `${base}${value}`));

  const low = rawPrice(product);
  const high = rawHighPrice(product);
  const currency = normalizeCurrency(product.currency);
  const tableProperties = product.specificationTable
    ? product.specificationTable.rows.flatMap((row) =>
        product.specificationTable!.columns.flatMap((column) => {
          const value = row.cells[column.id];
          return value ? [{ name: column.label, value }] : [];
        }),
      )
    : [];
  const additionalProperties = [
    ...tableProperties,
    ...product.specifications
      .filter((spec) => spec.value)
      .map((spec) => ({ name: spec.name, value: spec.value })),
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    // 品牌：商品用自家型号（HD6001…）供货，品牌即公司名。Google 的 Product 指南
    // 推荐该字段，也是把商品与品牌实体关联起来的信号。
    brand: { '@type': 'Brand', name: companyName(locale) },
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.shortDescription ? { description: product.shortDescription } : {}),
    ...(image.length > 0 ? { image } : {}),
    ...(product.categoryName ? { category: product.categoryName } : {}),
    ...(additionalProperties.length > 0
      ? {
          additionalProperty: additionalProperties.map((property) => ({
            '@type': 'PropertyValue',
            ...property,
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
            ...(high && high !== low
              ? {
                  priceSpecification: {
                    '@type': 'PriceSpecification',
                    priceCurrency: currency,
                    minPrice: low,
                    maxPrice: high,
                  },
                }
              : {}),
            availability: 'https://schema.org/InStock',
          },
        }
      : {}),
  };
}
