import Link from 'next/link';
import { requireAdminPage } from '@/lib/auth/session';
import { tryDb } from '@/lib/db';
import type { AdminLocale } from '@/lib/admin/validation';
import { adminDateLocale, formatMessage, getAdminMessagesForRequest } from '@/lib/admin/i18n';
import { Alert } from '@/components/admin/form';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/product-format';
import { decimalToString, normalizeCurrency } from '@/lib/pricing';
import { readDraft, type ProductDraft } from '@/lib/product-draft';
import type { Locale } from '@/lib/i18n/config';
import { ProductFilters } from './product-filters';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function pageNumbers(current: number, count: number): (number | 'gap')[] {
  const wanted = new Set([1, count, current - 1, current, current + 1]);
  const sorted = [...wanted].filter((page) => page >= 1 && page <= count).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) out.push('gap');
    out.push(page);
    previous = page;
  }
  return out;
}

/**
 * 列表里显示的商品名：优先后台界面语言，其次英文，再退回其余语言。
 * 与编辑器里的回退顺序保持一致，否则同一件商品在两个页面会显示不同的名字。
 */
function draftName(draft: ProductDraft, locale: AdminLocale): string {
  const values = draft.translations;
  return (
    values[locale as keyof typeof values]?.name ||
    values.en.name ||
    values.zh.name ||
    values.vi.name ||
    ''
  );
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdminPage();
  const { locale, t } = await getAdminMessagesForRequest();
  const params = await searchParams;

  const q = first(params.q).trim().slice(0, 80);
  const categoryId = first(params.categoryId).trim();
  const rawStatus = first(params.status);
  const status = rawStatus === 'published' || rawStatus === 'draft' ? rawStatus : '';
  const parsedPage = Number.parseInt(first(params.page), 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const justDeleted = first(params.deleted) === '1';

  const where = {
    ...(q
      ? {
          OR: [
            { slug: { contains: q, mode: 'insensitive' as const } },
            { sku: { contains: q, mode: 'insensitive' as const } },
            { translations: { some: { name: { contains: q, mode: 'insensitive' as const } } } },
          ],
        }
      : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(status === 'published' ? { published: true } : {}),
    ...(status === 'draft' ? { published: false } : {}),
  };

  const [result, categoryRows] = await Promise.all([
    tryDb(async (db) => {
      const [total, rows] = await Promise.all([
        db.product.count({ where }),
        db.product.findMany({
          where,
          orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          // `include` 只接受关系字段；标量列（含 draftData）本来就随查询一起返回。
          // 列表显示草稿里的名称 —— 商品改过名但还没发布时，
          // 显示线上旧名字会让人以为「我改的没保存上」。
          include: {
            translations: true,
            category: { include: { translations: true } },
            coverAsset: true,
          },
        }),
      ]);
      return { total, rows };
    }),
    tryDb((db) =>
      db.productCategory.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, slug: true, translations: { select: { locale: true, name: true } } },
      }),
    ),
  ]);

  const categories = (categoryRows ?? []).map((row) => ({
    id: row.id,
    name:
      row.translations.find((item) => item.locale === locale)?.name ||
      row.translations.find((item) => item.locale === 'en')?.name ||
      row.slug,
  }));

  const total = result?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(q || categoryId || status);

  const href = (target: number) => {
    const search = new URLSearchParams();
    if (q) search.set('q', q);
    if (categoryId) search.set('categoryId', categoryId);
    if (status) search.set('status', status);
    if (target > 1) search.set('page', String(target));
    const query = search.toString();
    return query ? `/admin/products?${query}` : '/admin/products';
  };

  // 价格文案按后台界面语言渲染（后台只有 en / zh 两套界面）
  const priceLocale: Locale = locale === 'zh' ? 'zh' : 'en';
  const negotiable = (row: { priceMode: string; priceMin: unknown }) =>
    row.priceMode === 'NEGOTIABLE' || !decimalToString(row.priceMin);

  // 没有任何语言的名称时显示「未命名商品」。这里刻意**不回退到 slug**：
  // slug 已经显示在名称下面那一行，把它同时当名称只会让人以为商品就叫 "2"。
  const productName = (translations: { locale: AdminLocale; name: string }[]) =>
    translations.find((item) => item.locale === locale)?.name ||
    translations.find((item) => item.locale === 'en')?.name ||
    translations.find((item) => item.locale === 'zh')?.name ||
    t.products.unnamedProduct;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-navy-900">{t.products.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.products.subtitle}</p>
        </div>
        <Link
          href="/admin/products/new"
          // 这个地址一打开就会建一条空草稿，因此绝不能预取 ——
          // Next 默认在鼠标悬停时就执行目标页的渲染，那会在用户没点的情况下写出数据
          prefetch={false}
          className="inline-flex h-10 items-center rounded-full bg-navy-900 px-5 text-sm font-medium text-ivory-50 transition-colors hover:bg-navy-800"
        >
          {t.products.new}
        </Link>
      </header>

      {result === null ? <Alert kind="error">{t.products.dbUnavailable}</Alert> : null}

      {justDeleted ? <Alert kind="success">{t.products.deleted}</Alert> : null}

      <ProductFilters categories={categories} q={q} categoryId={categoryId} status={status} />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted">
          {formatMessage(t.products.total, { count: total })}
        </p>
      </div>

      {total === 0 ? (
        <p className="rounded-xl border border-dashed border-navy-200 bg-white px-5 py-6 text-sm text-muted">
          {hasFilters ? t.products.emptyFiltered : t.products.empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-navy-200 bg-white">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-navy-100 bg-navy-50/60 text-xs uppercase tracking-wide text-navy-600">
              <tr>
                <th className="px-5 py-3 font-medium" />
                <th className="px-5 py-3 font-medium">{t.products.colProduct}</th>
                <th className="px-5 py-3 font-medium">{t.products.colSku}</th>
                <th className="px-5 py-3 font-medium">{t.products.colCategory}</th>
                <th className="px-5 py-3 font-medium">{t.products.colPrice}</th>
                <th className="px-5 py-3 font-medium">{t.products.colStatus}</th>
                <th className="px-5 py-3 font-medium">{t.products.colFeatured}</th>
                <th className="px-5 py-3 font-medium">{t.products.colUpdated}</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {(result?.rows ?? []).map((product) => {
                const thumbnail = product.coverAsset?.thumbnailUrl ?? product.coverAsset?.url ?? null;
                const draft = readDraft(product.draftData);
                const categoryTr = product.category?.translations ?? [];
                const categoryName = product.category
                  ? categoryTr.find((item) => item.locale === locale)?.name ||
                    categoryTr.find((item) => item.locale === 'en')?.name ||
                    product.category.slug
                  : null;

                return (
                  <tr key={product.id}>
                    <td className="px-5 py-3">
                      <div className="h-11 w-11 overflow-hidden rounded-md border border-navy-200 bg-navy-50">
                        {thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element -- 素材来自 OSS 动态域名，接入 next/image remotePatterns 后统一替换
                          <img
                            src={thumbnail}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="block h-full w-full border border-dashed border-navy-200" />
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-medium text-navy-900">
                        {draft
                          ? draftName(draft, locale) || t.products.unnamedProduct
                          : productName(product.translations)}
                      </span>
                      <span className="mt-0.5 block font-mono text-xs text-navy-500">
                        {draft ? draft.basic.slug : product.slug}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-navy-600">
                      {product.sku ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-navy-600">{categoryName ?? t.products.noCategory}</td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          'text-sm',
                          negotiable(product)
                            ? 'text-navy-500'
                            : 'font-medium text-copper-800',
                        )}
                      >
                        {formatPrice(
                          draft
                            ? draft.pricing
                            : {
                                priceMode: product.priceMode,
                                currency: normalizeCurrency(product.currency),
                                priceMin: decimalToString(product.priceMin),
                                priceMax: decimalToString(product.priceMax),
                                priceUnit: product.priceUnit,
                              },
                          priceLocale,
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs',
                          product.published
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700',
                        )}
                      >
                        {product.published ? t.products.statusPublished : t.products.statusDraft}
                      </span>
                      {draft ? (
                        <span className="ml-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-800">
                          {t.products.pendingBadge}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">
                      {product.featured ? (
                        <span className="rounded-full bg-copper-100 px-2.5 py-0.5 text-xs text-copper-700">
                          {t.products.featuredYes}
                        </span>
                      ) : (
                        <span className="text-navy-300">{t.products.featuredNo}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-navy-600">
                      {product.updatedAt.toLocaleDateString(adminDateLocale(locale))}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="text-sm text-copper-700 hover:underline"
                      >
                        {t.common.edit}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 ? (
        <nav
          aria-label={t.products.title}
          className="flex flex-wrap items-center gap-2"
        >
          <Link
            href={href(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={cn(
              'inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-navy-200 px-3 text-sm',
              page <= 1 ? 'pointer-events-none opacity-40' : 'text-navy-700 hover:bg-navy-50',
            )}
          >
            ‹
          </Link>
          {pageNumbers(page, pageCount).map((entry, index) =>
            entry === 'gap' ? (
              <span key={`gap-${index}`} className="px-1 text-navy-500">
                …
              </span>
            ) : (
              <Link
                key={entry}
                href={href(entry)}
                aria-current={entry === page ? 'page' : undefined}
                className={cn(
                  'inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-3 text-sm',
                  entry === page
                    ? 'border-navy-900 bg-navy-900 font-medium text-ivory-50'
                    : 'border-navy-200 text-navy-700 hover:bg-navy-50',
                )}
              >
                {entry}
              </Link>
            ),
          )}
          <Link
            href={href(Math.min(pageCount, page + 1))}
            aria-disabled={page >= pageCount}
            className={cn(
              'inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-navy-200 px-3 text-sm',
              page >= pageCount
                ? 'pointer-events-none opacity-40'
                : 'text-navy-700 hover:bg-navy-50',
            )}
          >
            ›
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
