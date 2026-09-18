import { tryDb } from '@/lib/db';
import { locales, type Locale } from '@/lib/i18n/config';
import { decimalToString, normalizeCurrency, type PriceMode } from '@/lib/pricing';
import { readSpecTable, readVariantGroups } from '@/lib/product-draft';

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
  /** 素材主键：用于把封面并入主媒体列表时去重 */
  assetId: string;
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

/** 可配置规格/颜色表（已按当前语言回退解析）。 */
export interface ProductSpecTableView {
  columns: { id: string; label: string }[];
  rows: { id: string; cells: Record<string, string> }[];
}

/** 前台可选的型号/颜色组，每一项可带一张缩略图。 */
export interface ProductVariantGroupView {
  id: string;
  label: string;
  options: { id: string; label: string; imageUrl: string | null }[];
}

export interface ProductDetailView extends ProductCardView {
  description: string | null;
  spec: string | null;
  application: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  /**
   * 主媒体列表（详情页左侧查看器用）：**封面在最前**，其后是图库，按素材去重。
   * 只设置了封面、没有加图库的商品同样有图可看 —— 发布只要求封面，不要求图库。
   */
  media: ProductMediaView[];
  /** 图库（详情页下方网格用）：仅 ProductMedia 行，不含自动补入的封面 */
  gallery: ProductMediaView[];
  specifications: ProductSpecView[];
  specificationTable: ProductSpecTableView | null;
  variantGroups: ProductVariantGroupView[];
  /** 当前语言缺失、已回退英文时为 true（页面据此提示，而不是显示字段名） */
  usingFallback: boolean;
  /**
   * 这个商品**真正有内容**的语言列表，用于生成 hreflang。
   * 不含「会回退到英文」的语言 —— hreflang 声明的是内容语言，不是可访问的地址。
   */
  contentLocales: Locale[];
}

/**
 * 草稿预览用取数：正式 slug 找不到时，再按**草稿里的 slug** 找一次。
 *
 * 为什么需要：后台的「预览产品」链接用的是编辑器里**当前**的 slug（草稿里的那个），
 * 而 `getProductBySlug` 查的是线上行 `Product.slug`。于是一旦在草稿里改了网址后缀，
 * 预览按钮就会 404 —— 恰恰是最需要预览的时候。
 *
 * 只在预览路由使用：正式详情页绝不能按草稿 slug 命中商品，
 * 否则一个还没发布的地址就会暴露线上内容。
 */
export async function getProductForPreview(
  slug: string,
  locale: Locale,
): Promise<ProductDetailView | null> {
  // 预览放宽语言要求：管理员要在发布前看到「这个商品现在长什么样」，
  // 此时因为缺少对应语言而 404 帮不上忙。
  const direct = await getProductBySlug(slug, locale, { includeUnpublished: true, lenientLocale: true });
  if (direct) return direct;

  const match = await tryDb((db) =>
    db.product.findFirst({
      // PostgreSQL 的 JSON 路径查询：draftData.basic.slug
      where: { draftData: { path: ['basic', 'slug'], equals: slug } },
      select: { slug: true },
    }),
  );
  if (!match) return null;

  return getProductBySlug(match.slug, locale, { includeUnpublished: true, lenientLocale: true });
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

/**
 * 按语言取翻译行。
 *
 * 规则（与 SEO 字段的回退是两件不同的事，别混）：
 *   - **中文页面只认中文**：没有中文内容就不显示，绝不拿别的语言顶上；
 *   - 其它语言：先看该语言，没有则回退**英文**；
 *   - 该语言与英文都没有 → 返回 `undefined`，由调用方决定 404 / 不进目录。
 *
 * 这里刻意**去掉了原来 `?? rows[0]` 那一层**：它会把「任意一条翻译」当成兜底，
 * 结果阿拉伯语页面显示中文名、并对外生成 hreflang，等于告诉搜索引擎
 * 「这是阿拉伯语内容」。宁可不展示，也不要展示错的语言。
 */
function pickTranslation<T extends { locale: Locale }>(rows: T[], locale: Locale): T | undefined {
  const exact = rows.find((row) => row.locale === locale);
  if (exact) return exact;
  if (locale === 'zh') return undefined;
  return rows.find((row) => row.locale === 'en');
}

/**
 * 该商品在指定语言下是否有真实内容。
 *
 * 判断依据是**是否存在可用的翻译行**（名称非空），而不是「渲染时会不会回退」——
 * 目录、hreflang、面包屑都要用同一个判断，否则又会出现「列表里有、点进去 404」。
 */
function hasTranslation<T extends { locale: Locale; name?: string | null }>(
  rows: T[],
  locale: Locale,
): boolean {
  const usable = (row: T) => (row.name ?? '').trim().length > 0;
  if (rows.some((row) => row.locale === locale && usable(row))) return true;
  if (locale === 'zh') return false;
  return rows.some((row) => row.locale === 'en' && usable(row));
}

/** 该商品有内容的全部语言，用于生成 hreflang */
export function localesWithContent(rows: { locale: Locale; name: string }[], available: readonly Locale[]): Locale[] {
  return available.filter((locale) => hasTranslation(rows, locale));
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
      // 该语言下没有内容的商品不出现在该语言的目录里。
      // 中文只认中文；其它语言允许英文兜底（页面上会标出这是英文内容）。
      // 不这样做就会出现「列表里看得见、点进去 404」的自相矛盾。
      translations:
        locale === 'zh'
          ? { some: { locale, name: { not: '' } } }
          : { some: { locale: { in: [locale, 'en'] as Locale[] }, name: { not: '' } } },
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

    const include = {
      translations: true,
      category: { include: { translations: true } },
      coverAsset: { include: { translations: true } },
      hoverVideoAsset: true,
    } as const;

    const fetchPage = (target: number) =>
      db.product.findMany({
        where,
        orderBy: orderByFor(sort),
        skip: (target - 1) * PRODUCTS_PER_PAGE,
        take: PRODUCTS_PER_PAGE,
        include,
      });

    const total = await db.product.count({ where });
    const pageCount = Math.max(1, Math.ceil(total / PRODUCTS_PER_PAGE));

    // 页码钳制：?page=99 落回最后一页。否则页面会一边显示「共 N 件产品」，
    // 一边因为这一页没有数据而渲染出「目录为空」的空状态 —— 自相矛盾。
    const effectivePage = Math.min(page, pageCount);
    const rows = await fetchPage(effectivePage);

    return { total, rows, page: effectivePage, pageCount };
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
    page: result.page,
    pageSize: PRODUCTS_PER_PAGE,
    pageCount: result.pageCount,
  };
}

/**
 * 按 slug 取商品详情。
 *
 * `includeUnpublished` 只由后台的草稿预览路由使用（那里已经校验过管理员会话）；
 * 前台永远只看得到已发布商品。
 */
export async function getProductBySlug(
  slug: string,
  locale: Locale,
  options: {
    includeUnpublished?: boolean;
    /**
     * 放宽语言要求：当前语言与英文都没有内容时也照常返回（回退到任意一条）。
     * 只给**后台草稿预览**用 —— 管理员要在发布前检查「这个商品现在长什么样」，
     * 此时 404 帮不上忙。正式站点一律用默认的严格模式。
     */
    lenientLocale?: boolean;
  } = {},
): Promise<ProductDetailView | null> {
  const clean = slug.trim();
  if (!clean) return null;

  const row = await tryDb((db) =>
    db.product.findFirst({
      where: options.includeUnpublished ? { slug: clean } : { slug: clean, published: true },
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

  const translations = row.translations as TranslationRow[];
  // 严格模式：该语言与英文都没有内容就当作不存在（正式站点用这条）
  // 放宽模式：回退到任意一条，仅供后台预览
  const tr = options.lenientLocale
    ? (pickTranslation(translations, locale) ?? translations[0])
    : pickTranslation(translations, locale);
  if (!tr) return null;
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
        assetId: item.assetId,
        type: item.asset.type === 'VIDEO' ? 'video' : 'image',
        url: item.asset.url,
        thumbnailUrl: item.asset.thumbnailUrl,
        posterUrl: item.asset.posterUrl,
        alt,
        caption,
      };
    });

  // 封面并入主媒体：只设了封面、没加图库的商品（发布只要求封面）也必须有主图可看
  const media: ProductMediaView[] = [...gallery];
  if (row.coverAsset && row.coverAsset.enabled && row.coverAsset.url) {
    const alreadyPresent = media.some((item) => item.assetId === row.coverAssetId);
    if (!alreadyPresent) {
      media.unshift({
        id: `cover-${row.coverAsset.id}`,
        assetId: row.coverAsset.id,
        type: 'image',
        url: row.coverAsset.url,
        thumbnailUrl: row.coverAsset.thumbnailUrl,
        posterUrl: null,
        alt: cover.alt ?? '',
        caption: null,
      });
    }
  }

  const publishedSpecTable = readSpecTable(row.specTable);
  const specificationTable: ProductSpecTableView | null = publishedSpecTable
    ? {
        columns: publishedSpecTable.columns
          .map((column) => ({
            id: column.id,
            label:
              column.values[locale].trim() ||
              column.values.en.trim() ||
              column.values.zh.trim() ||
              column.values.vi.trim(),
          }))
          .filter((column) => column.label.length > 0),
        rows: publishedSpecTable.rows
          .map((tableRow) => ({
            id: tableRow.id,
            cells: Object.fromEntries(
              publishedSpecTable.columns.map((column) => {
                const values = tableRow.cells[column.id];
                const value = values
                  ? values[locale].trim() || values.en.trim() || values.zh.trim() || values.vi.trim()
                  : '';
                return [column.id, value];
              }),
            ),
          }))
          .filter((tableRow) => Object.values(tableRow.cells).some((value) => value.length > 0)),
      }
    : null;

  // 兼容尚未发布新表结构的老商品：当前语言缺失时回退英文，空行不展示。
  const specifications: ProductSpecView[] = publishedSpecTable ? [] : row.specifications
    .map((spec) => {
      const specTr =
        spec.translations.find((item) => item.locale === locale) ??
        spec.translations.find((item) => item.locale === 'en');
      if (!specTr || !specTr.name.trim()) return null;
      return { id: spec.id, name: specTr.name.trim(), value: specTr.value?.trim() ?? '' };
    })
    .filter((spec): spec is ProductSpecView => spec !== null);

  const publishedVariantGroups = readVariantGroups(row.variantGroups) ?? [];
  const variantAssetIds = [
    ...new Set(
      publishedVariantGroups.flatMap((group) =>
        group.options.flatMap((option) => (option.assetId ? [option.assetId] : [])),
      ),
    ),
  ];
  const variantAssetRows =
    variantAssetIds.length > 0
      ? await tryDb((db) =>
          db.asset.findMany({
            where: { id: { in: variantAssetIds }, enabled: true, type: 'IMAGE' },
            select: { id: true, url: true, thumbnailUrl: true },
          }),
        )
      : [];
  const variantAssetById = new Map(
    (variantAssetRows ?? []).map((asset) => [asset.id, asset.thumbnailUrl ?? asset.url]),
  );
  const variantGroups: ProductVariantGroupView[] = publishedVariantGroups
    .map((group) => {
      const label =
        group.values[locale].trim() ||
        group.values.en.trim() ||
        group.values.zh.trim() ||
        group.values.vi.trim();
      const options = group.options
        .map((option) => ({
          id: option.id,
          label:
            option.values[locale].trim() ||
            option.values.en.trim() ||
            option.values.zh.trim() ||
            option.values.vi.trim(),
          imageUrl: option.assetId ? variantAssetById.get(option.assetId) ?? null : null,
        }))
        .filter((option) => option.label.length > 0);
      return { id: group.id, label, options };
    })
    .filter((group) => group.label.length > 0 && group.options.length > 0);

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
    media,
    gallery,
    specifications,
    specificationTable,
    variantGroups,
    // 真正在展示的语言与请求的语言不一致 —— 也就是「英文回退」。
    // 页面据此显示「该商品暂无您所选语言的内容，当前显示英文」。
    usingFallback: tr.locale !== locale,
    contentLocales: localesWithContent(translations, locales),
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
