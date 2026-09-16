import type { ProductDetailView } from '@/lib/catalog';
import type { Locale } from '@/lib/i18n/config';
import { rawHighPrice, rawPrice } from '@/lib/product-format';
import { normalizeCurrency } from '@/lib/pricing';

/**
 * 结构化数据：只有存在**真实数字价格**时才输出 Offer。
 * 面议商品绝不伪造价格 —— 伪造的 Offer 既误导搜索引擎，也误导询盘客户。
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
