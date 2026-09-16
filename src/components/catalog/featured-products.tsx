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
    <section className="border-b border-navy-100 bg-white py-12 lg:py-16">
      <Container>
        <h2 className="text-xl font-semibold tracking-tight text-navy-900 sm:text-2xl">
          {dict.list.featuredTitle}
        </h2>
        <div className="mt-3 h-px w-16 bg-copper-300" />
        <ProductGrid locale={locale} products={products} className="mt-10" />
      </Container>
    </section>
  );
}
