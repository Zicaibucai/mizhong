import type { Metadata } from 'next';
import Link from 'next/link';
import { defaultLocale, isLocale, type Locale } from '@/lib/i18n';
import { format, getCatalogDict } from '@/lib/i18n/catalog';
import { listProducts, normalizeQuery } from '@/lib/catalog';
import { PreviewContainer } from '@/components/preview/shell';
import { CatalogPageHeader } from '@/components/catalog/page-header';
import { CatalogSearchForm } from '@/components/catalog/catalog-search-form';
import { CatalogEmptyState, ProductGrid } from '@/components/catalog/product-grid';
import { Pagination } from '@/components/catalog/pagination';
import {
  catalogPath,
  firstValue,
  parsePage,
  searchPath,
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

  return {
    title: query ? format(dict.search.resultsFor, { query }) : dict.search.title,
    description: query ? format(dict.search.resultsFor, { query }) : dict.search.emptyQueryHint,
  };
}

export default async function SearchPage({
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
  const basePath = searchPath(l);
  const catalogueHref = catalogPath(l);

  const form = (
    <CatalogSearchForm
      action={basePath}
      defaultQuery={query}
      placeholder={dict.list.searchPlaceholder}
      buttonLabel={dict.list.searchButton}
      className="max-w-xl"
    />
  );

  // 空关键词：不查数据库，直接给出提示与完整目录入口
  if (!query) {
    return (
      <>
        <CatalogPageHeader title={dict.search.title} />
        <section className="bg-ivory-50 py-12 lg:py-20">
          <PreviewContainer>
            <div className="mb-10">{form}</div>
            <CatalogEmptyState
              message={dict.search.emptyQuery}
              hint={dict.search.emptyQueryHint}
              actionHref={catalogueHref}
              actionLabel={dict.search.backToCatalogue}
            />
          </PreviewContainer>
        </section>
      </>
    );
  }

  const page = parsePage(search.page);
  const result = await listProducts({ locale: l, query, page });

  const countLabel =
    result.total === 1
      ? dict.search.resultCountOne
      : format(dict.search.resultCount, { count: result.total });

  return (
    <>
      <CatalogPageHeader
        title={dict.search.title}
        subtitle={format(dict.search.resultsFor, { query })}
      />

      <section className="bg-ivory-50 py-12 lg:py-20">
        <PreviewContainer>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted">{countLabel}</p>
            <Link
              href={catalogueHref}
              className="text-sm font-medium text-copper-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
            >
              {dict.search.backToCatalogue}
            </Link>
          </div>

          <div className="mt-8">
            {result.items.length > 0 ? (
              <ProductGrid locale={l} products={result.items} />
            ) : (
              <CatalogEmptyState
                message={format(dict.search.noResults, { query })}
                hint={dict.search.noResultsHint}
                actionHref={catalogueHref}
                actionLabel={dict.search.backToCatalogue}
              />
            )}
          </div>

          <Pagination
            locale={l}
            basePath={basePath}
            query={query}
            page={result.page}
            pageCount={result.pageCount}
          />

          <div className="mt-14 border-t border-navy-100 pt-10">{form}</div>
        </PreviewContainer>
      </section>
    </>
  );
}
