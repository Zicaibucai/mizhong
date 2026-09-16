import { tryDb } from '@/lib/db';
import type { Locale } from '@/lib/i18n/config';

export const PRODUCTS_PER_PAGE = 12;
const MAX_QUERY_LENGTH = 80;

export interface CategoryView {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  productCount: number;
  coverUrl: string | null;
  coverAlt: string | null;
}

export interface ProductCardView {
  id: string;
  slug: string;
  sku: string | null;
  name: string;
  shortDescription: string | null;
  featured: boolean;
  categoryName: string | null;
  categorySlug: string | null;
  coverUrl: string | null;
  coverThumbnailUrl: string | null;
  coverAlt: string | null;
}

export interface ProductMediaView {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl: string | null;
  posterUrl: string | null;
  alt: string;
  caption: string | null;
}

export interface ProductDetailView extends ProductCardView {
  description: string | null;
  spec: string | null;
  application: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  gallery: ProductMediaView[];
  /** 当前语言缺失、已回退英文时为 true（页面据此提示，而不是显示字段名） */
  usingFallback: boolean;
}

export interface ProductListResult {
  items: ProductCardView[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

type TranslationRow = {
  locale: Locale;
  name: string;
  shortDescription: string | null;
  description: string | null;
  spec: string | null;
  application: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

/** 归一化并限制搜索词长度，避免超长查询冲击数据库 */
export function normalizeQuery(raw: string | null | undefined): string {
  return (raw ?? '').trim().slice(0, MAX_QUERY_LENGTH);
}

function pickTranslation<T extends { locale: Locale }>(rows: T[], locale: Locale): T | undefined {
  return rows.find((row) => row.locale === locale) ?? rows.find((row) => row.locale === 'en') ?? rows[0];
}

function coverOf(
  cover: { url: string; thumbnailUrl: string | null; translations: { locale: Locale; alt: string | null }[] } | null,
  locale: Locale,
) {
  if (!cover) return { url: null, thumbnailUrl: null, alt: null };
  const altRows = cover.translations;
  const alt =
    altRows.find((row) => row.locale === locale)?.alt ||
    altRows.find((row) => row.locale === 'en')?.alt ||
    null;
  return { url: cover.url, thumbnailUrl: cover.thumbnailUrl, alt };
}

/**
 * 首页产品概览仍由字典提供文案；这里只提供「已发布商品」的真实数据。
 * 数据库不可用时返回空结果，页面展示空状态而非报错。
 */
export async function listProducts(options: {
  locale: Locale;
  query?: string;
  categorySlug?: string;
  page?: number;
  featuredOnly?: boolean;
}): Promise<ProductListResult> {
  const { locale } = options;
  const query = normalizeQuery(options.query);
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const categorySlug = options.categorySlug?.trim() || undefined;

  const empty: ProductListResult = { items: [], total: 0, page, pageSize: PRODUCTS_PER_PAGE, pageCount: 0 };

  const result = await tryDb(async (db) => {
    const where = {
      published: true,
      ...(options.featuredOnly ? { featured: true } : {}),
      ...(categorySlug ? { category: { slug: categorySlug, enabled: true } } : {}),
      ...(query
        ? {
            OR: [
              { sku: { contains: query, mode: 'insensitive' as const } },
              { slug: { contains: query, mode: 'insensitive' as const } },
              { translations: { some: { name: { contains: query, mode: 'insensitive' as const } } } },
              {
                translations: {
                  some: { description: { contains: query, mode: 'insensitive' as const } },
                },
              },
              {
                translations: {
                  some: { shortDescription: { contains: query, mode: 'insensitive' as const } },
                },
              },
              {
                category: {
                  translations: { some: { name: { contains: query, mode: 'insensitive' as const } } },
                },
              },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      db.product.count({ where }),
      db.product.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * PRODUCTS_PER_PAGE,
        take: PRODUCTS_PER_PAGE,
        include: {
          translations: true,
          category: { include: { translations: true } },
          coverAsset: { include: { translations: true } },
        },
      }),
    ]);

    return { total, rows };
  });

  if (!result) return empty;

  const items: ProductCardView[] = result.rows.map((row) => {
    const tr = pickTranslation<TranslationRow>(row.translations as TranslationRow[], locale);
    const categoryTr = row.category
      ? pickTranslation(row.category.translations, locale)
      : undefined;
    const cover = coverOf(row.coverAsset, locale);

    return {
      id: row.id,
      slug: row.slug,
      sku: row.sku,
      name: tr?.name ?? row.slug,
      shortDescription: tr?.shortDescription ?? null,
      featured: row.featured,
      categoryName: categoryTr?.name ?? null,
      categorySlug: row.category?.slug ?? null,
      coverUrl: cover.url,
      coverThumbnailUrl: cover.thumbnailUrl,
      coverAlt: cover.alt,
    };
  });

  return {
    items,
    total: result.total,
    page,
    pageSize: PRODUCTS_PER_PAGE,
    pageCount: Math.max(1, Math.ceil(result.total / PRODUCTS_PER_PAGE)),
  };
}

export async function getProductBySlug(
  slug: string,
  locale: Locale,
): Promise<ProductDetailView | null> {
  const clean = slug.trim();
  if (!clean) return null;

  const row = await tryDb((db) =>
    db.product.findFirst({
      where: { slug: clean, published: true },
      include: {
        translations: true,
        category: { include: { translations: true } },
        coverAsset: { include: { translations: true } },
        media: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: { asset: { include: { translations: true } } },
        },
      },
    }),
  );

  if (!row) return null;

  const exact = row.translations.find((tr) => tr.locale === locale);
  const fallback = row.translations.find((tr) => tr.locale === 'en') ?? row.translations[0];
  const tr = (exact ?? fallback) as TranslationRow | undefined;
  const categoryTr = row.category ? pickTranslation(row.category.translations, locale) : undefined;
  const cover = coverOf(row.coverAsset, locale);

  const gallery: ProductMediaView[] = row.media
    .filter((item) => item.asset.enabled)
    .map((item) => {
      const altRows = item.asset.translations;
      const alt =
        altRows.find((t) => t.locale === locale)?.alt ||
        altRows.find((t) => t.locale === 'en')?.alt ||
        '';
      const caption =
        altRows.find((t) => t.locale === locale)?.caption ||
        altRows.find((t) => t.locale === 'en')?.caption ||
        null;

      return {
        id: item.id,
        type: item.asset.type === 'VIDEO' ? 'video' : 'image',
        url: item.asset.url,
        thumbnailUrl: item.asset.thumbnailUrl,
        posterUrl: item.asset.posterUrl,
        alt,
        caption,
      };
    });

  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    name: tr?.name ?? row.slug,
    shortDescription: tr?.shortDescription ?? null,
    description: tr?.description ?? null,
    spec: tr?.spec ?? null,
    application: tr?.application ?? null,
    seoTitle: tr?.seoTitle ?? null,
    seoDescription: tr?.seoDescription ?? null,
    featured: row.featured,
    categoryName: categoryTr?.name ?? null,
    categorySlug: row.category?.slug ?? null,
    coverUrl: cover.url,
    coverThumbnailUrl: cover.thumbnailUrl,
    coverAlt: cover.alt,
    gallery,
    usingFallback: Boolean(tr) && !exact,
  };
}

export async function listCategories(locale: Locale): Promise<CategoryView[]> {
  const rows = await tryDb((db) =>
    db.productCategory.findMany({
      where: { enabled: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        translations: true,
        coverAsset: { include: { translations: true } },
        _count: { select: { products: { where: { published: true } } } },
      },
    }),
  );

  if (!rows) return [];

  return rows
    .map((row) => {
      const tr = pickTranslation(row.translations, locale);
      const cover = coverOf(row.coverAsset, locale);
      return {
        id: row.id,
        slug: row.slug,
        name: tr?.name ?? row.slug,
        description: tr?.description ?? null,
        productCount: row._count.products,
        coverUrl: cover.url,
        coverAlt: cover.alt,
      };
    })
    .filter((category) => category.productCount > 0);
}

export async function getCategoryBySlug(
  slug: string,
  locale: Locale,
): Promise<CategoryView | null> {
  const categories = await listCategories(locale);
  return categories.find((category) => category.slug === slug) ?? null;
}

export async function listFeaturedProducts(locale: Locale, limit = 3): Promise<ProductCardView[]> {
  const result = await listProducts({ locale, featuredOnly: true, page: 1 });
  return result.items.slice(0, limit);
}
