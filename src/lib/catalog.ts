import { tryDb } from '@/lib/db';
import type { Locale } from '@/lib/i18n/config';
import { decimalToString, normalizeCurrency, type PriceMode } from '@/lib/pricing';

export const PRODUCTS_PER_PAGE = 12;
const MAX_QUERY_LENGTH = 80;

/** 目录排序方式；非法值一律回退 `recommended` */
export const PRODUCT_SORTS = ['recommended', 'newest', 'price-asc', 'price-desc'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export function parseProductSort(raw: string | null | undefined): ProductSort {
  const value = (raw ?? '').trim();
  return (PRODUCT_SORTS as readonly string[]).includes(value) ? (value as ProductSort) : 'recommended';
}

export interface CategoryView {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  productCount: number;
  coverUrl: string | null;
  coverAlt: string | null;
}

/** 价格与贸易信息：金额始终是字符串（Decimal 不跨越边界） */
export interface ProductPriceView {
  priceMode: PriceMode;
  currency: string;
  priceMin: string | null;
  priceMax: string | null;
  priceUnit: string | null;
  moq: number | null;
  moqUnit: string | null;
}

export interface ProductCardView extends ProductPriceView {
  id: string;
  slug: string;
  sku: string | null;
  name: string;
  shortDescription: string | null;
  sizeSummary: string | null;
  featured: boolean;
  categoryName: string | null;
  categorySlug: string | null;
  coverUrl: string | null;
  coverThumbnailUrl: string | null;
  coverAlt: string | null;
  /** 列表卡片悬停播放的视频（仅当产品配置了 VIDEO 素材时非空） */
  hoverVideoUrl: string | null;
  hoverVideoPosterUrl: string | null;
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

/** 一条结构化参数（已按当前语言回退解析） */
export interface ProductSpecView {
  id: string;
  name: string;
  value: string;
}

export interface ProductDetailView extends ProductCardView {
  description: string | null;
  spec: string | null;
  application: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  gallery: ProductMediaView[];
  specifications: ProductSpecView[];
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
  sizeSummary: string | null;
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

/** Prisma 的 Product 行 → 价格视图（Decimal 一律转字符串） */
function priceOf(row: {
  priceMode: PriceMode;
  currency: string;
  priceMin: unknown;
  priceMax: unknown;
  priceUnit: string | null;
  moq: number | null;
  moqUnit: string | null;
}): ProductPriceView {
  return {
    priceMode: row.priceMode,
    currency: normalizeCurrency(row.currency),
    priceMin: decimalToString(row.priceMin),
    priceMax: decimalToString(row.priceMax),
    priceUnit: row.priceUnit?.trim() || null,
    moq: row.moq,
    moqUnit: row.moqUnit?.trim() || null,
  };
}

/** 悬停视频：只有 VIDEO 类型且已启用的素材才会输出 */
function hoverVideoOf(
  asset: { type: 'IMAGE' | 'VIDEO'; url: string; posterUrl: string | null; thumbnailUrl: string | null; enabled: boolean } | null,
): { url: string | null; posterUrl: string | null } {
  if (!asset || !asset.enabled || asset.type !== 'VIDEO' || !asset.url) {
    return { url: null, posterUrl: null };
  }
  return { url: asset.url, posterUrl: asset.posterUrl ?? asset.thumbnailUrl ?? null };
}

/** 排序：无价格的商品（面议 / 未填价）在价格排序中一律排在最后 */
function orderByFor(sort: ProductSort) {
  switch (sort) {
    case 'newest':
      return [{ createdAt: 'desc' as const }];
    case 'price-asc':
      return [
        { priceMin: { sort: 'asc' as const, nulls: 'last' as const } },
        { sortOrder: 'asc' as const },
      ];
    case 'price-desc':
      return [
        { priceMin: { sort: 'desc' as const, nulls: 'last' as const } },
        { sortOrder: 'asc' as const },
      ];
    default:
      return [
        { featured: 'desc' as const },
        { sortOrder: 'asc' as const },
        { createdAt: 'desc' as const },
      ];
  }
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
  sort?: ProductSort;
}): Promise<ProductListResult> {
  const { locale } = options;
  const query = normalizeQuery(options.query);
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const categorySlug = options.categorySlug?.trim() || undefined;
  const sort = options.sort ?? 'recommended';

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
        orderBy: orderByFor(sort),
        skip: (page - 1) * PRODUCTS_PER_PAGE,
        take: PRODUCTS_PER_PAGE,
        include: {
          translations: true,
          category: { include: { translations: true } },
          coverAsset: { include: { translations: true } },
          hoverVideoAsset: true,
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
    const hover = hoverVideoOf(row.hoverVideoAsset);

    return {
      id: row.id,
      slug: row.slug,
      sku: row.sku,
      name: tr?.name ?? row.slug,
      shortDescription: tr?.shortDescription ?? null,
      sizeSummary: tr?.sizeSummary ?? null,
      featured: row.featured,
      categoryName: categoryTr?.name ?? null,
      categorySlug: row.category?.slug ?? null,
      coverUrl: cover.url,
      coverThumbnailUrl: cover.thumbnailUrl,
      coverAlt: cover.alt,
      hoverVideoUrl: hover.url,
      hoverVideoPosterUrl: hover.posterUrl,
      ...priceOf(row),
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
        hoverVideoAsset: true,
        media: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: { asset: { include: { translations: true } } },
        },
        specifications: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: { translations: true },
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
  const hover = hoverVideoOf(row.hoverVideoAsset);

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

  // 结构化参数：当前语言缺失时回退英文，两边都为空的行直接隐藏（不显示空行）
  const specifications: ProductSpecView[] = row.specifications
    .map((spec) => {
      const specTr =
        spec.translations.find((item) => item.locale === locale) ??
        spec.translations.find((item) => item.locale === 'en');
      if (!specTr || !specTr.name.trim()) return null;
      return { id: spec.id, name: specTr.name.trim(), value: specTr.value?.trim() ?? '' };
    })
    .filter((spec): spec is ProductSpecView => spec !== null);

  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    name: tr?.name ?? row.slug,
    shortDescription: tr?.shortDescription ?? null,
    description: tr?.description ?? null,
    sizeSummary: tr?.sizeSummary ?? null,
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
    hoverVideoUrl: hover.url,
    hoverVideoPosterUrl: hover.posterUrl,
    gallery,
    specifications,
    usingFallback: Boolean(tr) && !exact,
    ...priceOf(row),
  };
}

/**
 * 相关产品：优先同分类，不足时用最新商品补齐；排除当前商品。
 * 任何一步失败都返回空数组 —— 相关产品是增强内容，绝不能因此让详情页报错。
 */
export async function listRelatedProducts(
  product: { id: string; categorySlug: string | null },
  locale: Locale,
  limit = 3,
): Promise<ProductCardView[]> {
  const rows = await tryDb((db) =>
    db.product.findMany({
      where: {
        published: true,
        id: { not: product.id },
        ...(product.categorySlug ? { category: { slug: product.categorySlug, enabled: true } } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: limit,
      include: {
        translations: true,
        category: { include: { translations: true } },
        coverAsset: { include: { translations: true } },
        hoverVideoAsset: true,
      },
    }),
  );

  const map = (list: NonNullable<typeof rows>): ProductCardView[] =>
    list.map((row) => {
      const tr = pickTranslation<TranslationRow>(row.translations as TranslationRow[], locale);
      const categoryTr = row.category ? pickTranslation(row.category.translations, locale) : undefined;
      const cover = coverOf(row.coverAsset, locale);
      const hover = hoverVideoOf(row.hoverVideoAsset);
      return {
        id: row.id,
        slug: row.slug,
        sku: row.sku,
        name: tr?.name ?? row.slug,
        shortDescription: tr?.shortDescription ?? null,
        sizeSummary: tr?.sizeSummary ?? null,
        featured: row.featured,
        categoryName: categoryTr?.name ?? null,
        categorySlug: row.category?.slug ?? null,
        coverUrl: cover.url,
        coverThumbnailUrl: cover.thumbnailUrl,
        coverAlt: cover.alt,
        hoverVideoUrl: hover.url,
        hoverVideoPosterUrl: hover.posterUrl,
        ...priceOf(row),
      };
    });

  const primary = map(rows ?? []);
  if (primary.length >= limit) return primary;

  // 同分类商品不足时，补上其它分类的最新商品，保证区块不出现半空的状态
  const filler = await tryDb((db) =>
    db.product.findMany({
      where: { published: true, id: { not: product.id } },
      orderBy: [{ createdAt: 'desc' }],
      take: limit * 2,
      include: {
        translations: true,
        category: { include: { translations: true } },
        coverAsset: { include: { translations: true } },
        hoverVideoAsset: true,
      },
    }),
  );

  const seen = new Set(primary.map((item) => item.id));
  for (const item of map(filler ?? [])) {
    if (primary.length >= limit) break;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    primary.push(item);
  }

  return primary;
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
