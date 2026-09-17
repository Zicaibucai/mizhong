import type { Locale } from '@/lib/i18n';
import type { ProductCardView } from '@/lib/catalog';
import { getCatalogDict } from '@/lib/i18n/catalog';
import { Container } from '@/components/ui/container';
import { ProductGrid } from './product-grid';

/**
 * 精选产品：仅在目录首页且没有任何筛选条件时展示。
 */
export function FeaturedProducts({
  locale,
  products,
}: {
  locale: Locale;
  products: ProductCardView[];
}) {
  if (products.length === 0) return null;
  const dict = getCatalogDict(locale);

  return (
    <section className="border-y border-navy-200 bg-ivory-100 py-14 lg:py-20">
      <Container>
        <p className="pv-mono text-[0.58rem] text-copper-700">CURATED / 01</p>
        <h2 className="pv-display mt-4 text-3xl text-navy-950 sm:text-4xl">
          {dict.list.featuredTitle}
        </h2>
        <ProductGrid locale={locale} products={products} className="mt-10" />
      </Container>
    </section>
  );
}
