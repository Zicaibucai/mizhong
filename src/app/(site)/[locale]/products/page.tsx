import type { Metadata } from 'next';
import Link from 'next/link';
import { defaultLocale, isLocale, type Locale } from '@/lib/i18n';
import { format, getCatalogDict } from '@/lib/i18n/catalog';
import {
  listCategories,
  listFeaturedProducts,
  listProducts,
  normalizeQuery,
} from '@/lib/catalog';
import { Container } from '@/components/ui/container';
import { CatalogPageHeader } from '@/components/catalog/page-header';
import { CatalogSearchForm } from '@/components/catalog/catalog-search-form';
import { CategoryFilter } from '@/components/catalog/category-filter';
import { CatalogEmptyState, ProductGrid } from '@/components/catalog/product-grid';
import { FeaturedProducts } from '@/components/catalog/featured-products';
import { Pagination } from '@/components/catalog/pagination';
import {
  catalogPath,
  firstValue,
  parsePage,
  type SearchParamsInput,
} from '@/components/catalog/urls';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const l: Locale = isLocale(locale) ? locale : defaultLocale;
  const dict = getCatalogDict(l);

  return {
    title: dict.list.title,
    description: dict.list.subtitle,
  };
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  const l: Locale = isLocale(locale) ? locale : defaultLocale;
  const dict = getCatalogDict(l);

  const search = await searchParams;
  const query = normalizeQuery(firstValue(search.q));
  const categorySlug = firstValue(search.category)?.trim() || undefined;
  const page = parsePage(search.page);

  const [result, categories] = await Promise.all([
    listProducts({ locale: l, query, categorySlug, page }),
    listCategories(l),
  ]);

  const hasFilters = Boolean(query || categorySlug);
  // 精选仅在目录首页、且没有任何筛选条件时出现
  const featured =
    !hasFilters && page === 1 ? await listFeaturedProducts(l, 3) : [];

  const basePath = catalogPath(l);
  const countLabel =
    result.total === 1
      ? dict.list.resultCountOne
      : format(dict.list.resultCount, { count: result.total });

  return (
    <>
      <CatalogPageHeader title={dict.list.title} subtitle={dict.list.subtitle} />
      <section className="border-b border-navy-100 bg-white">
        <Container className="py-7">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
            <div className="w-full lg:max-w-md">
              <CatalogSearchForm
                action={basePath}
                defaultQuery={query}
                category={categorySlug}
                placeholder={dict.list.searchPlaceholder}
                buttonLabel={dict.list.searchButton}
              />
            </div>
            <CategoryFilter
              locale={l}
              categories={categories}
              activeSlug={categorySlug}
              query={query}
              className="lg:max-w-2xl lg:pt-0.5"
            />
          </div>
        </Container>
      </section>

      {featured.length > 0 ? <FeaturedProducts locale={l} products={featured} /> : null}

      <section className="py-12 lg:py-16">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">{countLabel}</p>
            {hasFilters ? (
              <Link
                href={basePath}
                className="text-sm font-medium text-copper-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
              >
                {dict.list.clearFilters}
              </Link>
            ) : null}
          </div>

          <div className="mt-8">
            {result.items.length > 0 ? (
              <ProductGrid locale={l} products={result.items} />
            ) : (
              <CatalogEmptyState
                message={dict.list.empty}
                hint={dict.list.emptyHint}
                actionHref={basePath}
                actionLabel={dict.list.clearFilters}
              />
            )}
          </div>

          <Pagination
            locale={l}
            basePath={basePath}
            query={query}
            category={categorySlug}
            page={result.page}
            pageCount={result.pageCount}
          />
        </Container>
      </section>
    </>
  );
}
