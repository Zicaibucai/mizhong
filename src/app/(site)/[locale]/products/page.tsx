import type { Metadata } from 'next';
import Link from 'next/link';
import { defaultLocale, isLocale, type Locale } from '@/lib/i18n';
import { format, getCatalogDict } from '@/lib/i18n/catalog';
import {
  listCategories,
  listFeaturedProducts,
  listProducts,
  normalizeQuery,
  parseProductSort,
} from '@/lib/catalog';
import { PreviewContainer } from '@/components/preview/shell';
import { CatalogPageHeader } from '@/components/catalog/page-header';
import { CatalogSearchForm } from '@/components/catalog/catalog-search-form';
import { CategoryMobilePanel, CategorySidebar } from '@/components/catalog/category-sidebar';
import { SortSelect } from '@/components/catalog/sort-select';
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
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}): Promise<Metadata> {
  const { locale } = await params;
  const l: Locale = isLocale(locale) ? locale : defaultLocale;
  const dict = getCatalogDict(l);
  const search = await searchParams;
  const query = normalizeQuery(firstValue(search.q));
  const categorySlug = firstValue(search.category)?.trim();

  // 带筛选参数的地址不应被搜索引擎当作独立页面收录，避免重复内容
  const filtered = Boolean(query || categorySlug);

  return {
    title: dict.list.title,
    description: dict.list.subtitle,
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
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
  const sort = parseProductSort(firstValue(search.sort));
  const page = parsePage(search.page);

  const [result, categories] = await Promise.all([
    listProducts({ locale: l, query, categorySlug, page, sort }),
    listCategories(l),
  ]);

  const hasFilters = Boolean(query || categorySlug);
  // 精选仅在目录首页、且没有任何筛选条件时出现
  const featured = !hasFilters && page === 1 ? await listFeaturedProducts(l, 3) : [];

  const basePath = catalogPath(l);
  const countLabel =
    result.total === 1
      ? dict.list.resultCountOne
      : format(dict.list.resultCount, { count: result.total });

  const activeCategory = categories.find((category) => category.slug === categorySlug);

  return (
    <>
      <CatalogPageHeader title={dict.list.title} subtitle={dict.list.subtitle} />

      <section className="bg-ivory-50 py-12 lg:py-20">
        <PreviewContainer>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
            <CategorySidebar
              locale={l}
              categories={categories}
              activeSlug={categorySlug}
              query={query}
              sort={sort === 'recommended' ? undefined : sort}
            />

            {/* min-w-0：flex 子项默认 min-width:auto，会让长产品名把整页撑出横向滚动 */}
            <div className="min-w-0 flex-1">
              <CategoryMobilePanel
                locale={l}
                categories={categories}
                activeSlug={categorySlug}
                query={query}
                sort={sort === 'recommended' ? undefined : sort}
              />

              <div className="flex flex-col gap-4 border-b border-navy-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
                <CatalogSearchForm
                  action={basePath}
                  defaultQuery={query}
                  category={categorySlug}
                  sort={sort === 'recommended' ? undefined : sort}
                  placeholder={dict.list.searchPlaceholder}
                  buttonLabel={dict.list.searchButton}
                  className="sm:max-w-sm"
                />
                <SortSelect
                  locale={l}
                  value={sort}
                  query={query}
                  category={categorySlug}
                  className="shrink-0"
                />
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
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

              {activeCategory ? (
                <p className="mt-4 text-sm text-navy-600">
                  <span className="text-navy-400">{dict.list.activeCategory}</span>{' '}
                  <span className="font-medium text-navy-900">{activeCategory.name}</span>
                </p>
              ) : null}

              <div className="mt-8">
                {result.items.length > 0 ? (
                  <ProductGrid locale={l} products={result.items} />
                ) : hasFilters ? (
                  <CatalogEmptyState
                    message={dict.list.empty}
                    hint={dict.list.emptyHint}
                    actionHref={basePath}
                    actionLabel={dict.list.clearFilters}
                  />
                ) : (
                  /* 目录本身为空（不是筛选没命中）：不要提示「换个关键词」，那会误导访客 */
                  <CatalogEmptyState
                    message={dict.list.emptyCatalogue}
                    hint={dict.list.emptyCatalogueHint}
                  />
                )}
              </div>

              <Pagination
                locale={l}
                basePath={basePath}
                query={query}
                category={categorySlug}
                sort={sort === 'recommended' ? undefined : sort}
                page={result.page}
                pageCount={result.pageCount}
              />
            </div>
          </div>
        </PreviewContainer>
      </section>

      {featured.length > 0 ? <FeaturedProducts locale={l} products={featured} /> : null}
    </>
  );
}
