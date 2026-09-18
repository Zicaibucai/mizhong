import { z } from 'zod';
import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';
import { localizedRecord } from '@/lib/i18n/localized';
import { SLUG_PATTERN } from '@/lib/slug';

export { localizedRecord, pickLocalized } from '@/lib/i18n/localized';
import { PRICE_MODES, CURRENCY_CODES } from '@/lib/pricing';

/**
 * 商品编辑草稿的形状，同时也是版本快照（`ProductVersion.snapshot`）的形状。
 *
 * 线上内容存在关系表里（`Product` 各列、`ProductTranslation`、`ProductSpecification`、
 * `ProductMedia`），前台读的就是它们；草稿是贴在 `Product.draftData` 上的一份 JSON。
 * 两者刻意分开：前台的查询、排序、搜索一行都不用改，风险为 0；草稿这边则允许
 * 存下「编辑到一半」的状态。
 *
 * 本模块是**纯的**：不碰 Prisma、不碰数据库，客户端与服务端都能引。
 * `draftFromLive` 由调用方喂已经序列化好的普通对象（金额已经是字符串），
 * 因此这里不需要知道 Decimal 是什么。
 *
 * 金额在本类型里**一律是字符串**（`"12.50"`），绝不经过 Number —— 与项目其余部分
 * 对金额的处理保持一致。
 */

export const PRODUCT_MEDIA_ROLES = ['GALLERY', 'VIDEO'] as const;
export type ProductMediaRoleValue = (typeof PRODUCT_MEDIA_ROLES)[number];

/** 一个语言下的全部可编辑文本字段 */
export interface ProductTranslationValues {
  name: string;
  shortDescription: string;
  description: string;
  sizeSummary: string;
  spec: string;
  application: string;
  seoTitle: string;
  seoDescription: string;
}

export interface ProductDraftSpec {
  /** 数据库主键；草稿里新增的一行为 null。发布时据此决定更新还是新建 */
  id: string | null;
  values: Record<AdminLocale, { name: string; value: string }>;
}

/** 一列可配置规格：列名也跟着当前语言切换保存。 */
export interface ProductDraftSpecColumn {
  id: string;
  values: Record<AdminLocale, string>;
}

/** 一行规格/颜色组合；cells 的 key 对应列 id。 */
export interface ProductDraftSpecTableRow {
  id: string;
  cells: Record<string, Record<AdminLocale, string>>;
}

/** 1688 风格的规格/颜色表，列和行都由管理员自由维护。 */
export interface ProductDraftSpecTable {
  columns: ProductDraftSpecColumn[];
  rows: ProductDraftSpecTableRow[];
}

/** 一个带可选图片的型号/颜色选项。 */
export interface ProductDraftVariantOption {
  id: string;
  assetId: string | null;
  values: Record<AdminLocale, string>;
}

/**
 * 1688 风格选项组（例如“型号”、“颜色”）。
 * 三语共用结构与图片，组名和选项名分别翻译。
 */
export interface ProductDraftVariantGroup {
  id: string;
  values: Record<AdminLocale, string>;
  options: ProductDraftVariantOption[];
}

export interface ProductDraftMedia {
  assetId: string;
  role: ProductMediaRoleValue;
}

export interface ProductDraft {
  basic: {
    slug: string;
    sku: string;
    categoryId: string | null;
    featured: boolean;
    sortOrder: number;
    coverAssetId: string | null;
    hoverVideoAssetId: string | null;
  };
  pricing: {
    priceMode: (typeof PRICE_MODES)[number];
    currency: string;
    priceMin: string | null;
    priceMax: string | null;
    priceUnit: string | null;
    moq: number | null;
    moqUnit: string | null;
  };
  translations: Record<AdminLocale, ProductTranslationValues>;
  /** 数组顺序即前台展示顺序 */
  specs: ProductDraftSpec[];
  /** 可配置的规格/颜色表；旧 specs 仅作为兼容数据保留。 */
  specTable: ProductDraftSpecTable;
  /** 带缩略图的型号/颜色选项，与尺寸/参数表分开。 */
  variantGroups: ProductDraftVariantGroup[];
  /** 数组顺序即图库顺序 */
  media: ProductDraftMedia[];
}

/** 草稿的分区，用于「有 N 处改动」的提示 */
export const DRAFT_SECTIONS = ['basic', 'pricing', 'translations', 'specs', 'media'] as const;
export type DraftSection = (typeof DRAFT_SECTIONS)[number];

export function emptyTranslationValues(): ProductTranslationValues {
  return {
    name: '',
    shortDescription: '',
    description: '',
    sizeSummary: '',
    spec: '',
    application: '',
    seoTitle: '',
    seoDescription: '',
  };
}

export function emptyTranslations(): Record<AdminLocale, ProductTranslationValues> {
  return localizedRecord(() => emptyTranslationValues());
}

export function draftMediaRoleFor(assetType: 'IMAGE' | 'VIDEO'): ProductMediaRoleValue {
  return assetType === 'VIDEO' ? 'VIDEO' : 'GALLERY';
}

// ---------------------------------------------------------------------------
// 读取
// ---------------------------------------------------------------------------

/**
 * 只校验**形状**的 schema，用来读 `draftData`。
 *
 * 不带任何业务规则、也不需要文案：读的时候只关心「这份 JSON 是不是我认识的结构」。
 * 哪天字段增删导致旧草稿读不出来，`readDraft` 返回 null，编辑器退回编辑线上内容 ——
 * 坏数据不会把后台打挂。
 */
const translationShape = z.object({
  name: z.string().default(''),
  shortDescription: z.string().default(''),
  description: z.string().default(''),
  sizeSummary: z.string().default(''),
  spec: z.string().default(''),
  application: z.string().default(''),
  seoTitle: z.string().default(''),
  seoDescription: z.string().default(''),
});

const localizedTableTextShape = (max: number) =>
  z.object(
    Object.fromEntries(
      ADMIN_LOCALES.map((locale) => [locale, z.string().max(max).default('')]),
    ) as Record<AdminLocale, z.ZodDefault<z.ZodString>>,
  );

const specTableShape = z.object({
  columns: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        values: localizedTableTextShape(120),
      }),
    )
    .max(20)
    .default([]),
  rows: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        cells: z.record(localizedTableTextShape(300)),
      }),
    )
    .max(100)
    .default([]),
});

const variantGroupsShape = z
  .array(
    z.object({
      id: z.string().min(1).max(80),
      values: localizedTableTextShape(120),
      options: z
        .array(
          z.object({
            id: z.string().min(1).max(80),
            assetId: z.string().max(200).nullable().default(null),
            values: localizedTableTextShape(200),
          }),
        )
        .max(100)
        .default([]),
    }),
  )
  .max(10);

const draftShape = z.object({
  basic: z.object({
    slug: z.string().default(''),
    sku: z.string().default(''),
    categoryId: z.string().nullable().default(null),
    featured: z.boolean().default(false),
    sortOrder: z.number().int().default(0),
    coverAssetId: z.string().nullable().default(null),
    hoverVideoAssetId: z.string().nullable().default(null),
  }),
  pricing: z.object({
    priceMode: z.enum(PRICE_MODES).default('NEGOTIABLE'),
    currency: z.enum(CURRENCY_CODES).default('USD'),
    priceMin: z.string().nullable().default(null),
    priceMax: z.string().nullable().default(null),
    priceUnit: z.string().nullable().default(null),
    moq: z.number().int().nullable().default(null),
    moqUnit: z.string().nullable().default(null),
  }),
  translations: z.object(
    Object.fromEntries(
      ADMIN_LOCALES.map((locale) => [locale, translationShape]),
    ) as Record<AdminLocale, typeof translationShape>,
  ),
  specs: z
    .array(
      z.object({
        id: z.string().nullable().default(null),
        values: z.object(
          Object.fromEntries(
            ADMIN_LOCALES.map((locale) => [
              locale,
              z.object({ name: z.string().default(''), value: z.string().default('') }),
            ]),
          ) as Record<AdminLocale, z.ZodObject<{ name: z.ZodDefault<z.ZodString>; value: z.ZodDefault<z.ZodString> }>>,
        ),
      }),
    )
    .default([]),
  specTable: specTableShape.default({ columns: [], rows: [] }),
  variantGroups: variantGroupsShape.default([]),
  media: z
    .array(
      z.object({
        assetId: z.string(),
        role: z.enum(PRODUCT_MEDIA_ROLES).default('GALLERY'),
      }),
    )
    .default([]),
});

/**
 * 读取草稿。形状不认识就返回 null —— 调用方据此回退到「直接编辑线上内容」，
 * 而不是抛错让整个后台页面打不开。
 */
export function readDraft(value: unknown): ProductDraft | null {
  if (value === null || value === undefined) return null;
  const parsed = draftShape.safeParse(value);
  if (!parsed.success) return null;

  // 旧版本草稿没有 specTable：把原来的两列参数平移成新表，避免升级后编辑器看起来像丢了数据。
  const source = value as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(source, 'specTable')) {
    parsed.data.specTable = specTableFromLegacySpecs(parsed.data.specs);
  }
  return parsed.data as ProductDraft;
}

/** 新商品默认提供“参数 + 参数值”两列；型号/颜色由独立选项组维护。 */
export function emptySpecTable(): ProductDraftSpecTable {
  return {
    columns: [
      { id: 'specification', values: localizedRecord(() => '') },
      { id: 'value', values: localizedRecord(() => '') },
    ],
    rows: [],
  };
}

/** 将旧的名称/值参数转换成两列表格，仅在迁移旧数据时使用。 */
export function specTableFromLegacySpecs(specs: ProductDraftSpec[]): ProductDraftSpecTable {
  const table = emptySpecTable();
  if (specs.length === 0) return table;
  table.columns[0] = { id: 'specification', values: localizedRecord(() => '') };
  table.columns[1] = { id: 'value', values: localizedRecord(() => '') };
  table.rows = specs.map((spec, index) => ({
    id: spec.id ?? `legacy-${index + 1}`,
    cells: {
      specification: localizedRecord((locale) => spec.values[locale]?.name ?? ''),
      value: localizedRecord((locale) => spec.values[locale]?.value ?? ''),
    },
  }));
  return table;
}

/** 读取发布后的 JSON；形状不对时由调用方回退到旧参数表。 */
export function readSpecTable(value: unknown): ProductDraftSpecTable | null {
  const parsed = specTableShape.safeParse(value);
  if (!parsed.success || parsed.data.columns.length === 0) return null;
  return parsed.data as ProductDraftSpecTable;
}

/** 读取发布后的型号/颜色 JSON；结构不对时安全回退。 */
export function readVariantGroups(value: unknown): ProductDraftVariantGroup[] | null {
  const parsed = variantGroupsShape.safeParse(value);
  if (!parsed.success) return null;
  return parsed.data as ProductDraftVariantGroup[];
}

// ---------------------------------------------------------------------------
// 比较
// ---------------------------------------------------------------------------

function sectionEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 草稿相对线上内容到底改了哪几块。
 *
 * 返回分区 id（basic / pricing / …），由 UI 翻成「基本信息、价格与贸易」这样的标签。
 * 用它而不是「改动字段数」：管理员真正需要知道的是「我动过哪一块」。
 */
export function changedSections(draft: ProductDraft, live: ProductDraft): DraftSection[] {
  return DRAFT_SECTIONS.filter((section) => {
    if (section === 'specs') {
      return !sectionEqual(
        { specs: draft.specs, specTable: draft.specTable, variantGroups: draft.variantGroups },
        { specs: live.specs, specTable: live.specTable, variantGroups: live.variantGroups },
      );
    }
    return !sectionEqual(draft[section], live[section]);
  });
}

// ---------------------------------------------------------------------------
// 发布前的校验
// ---------------------------------------------------------------------------

/**
 * 发布前的完整校验。
 *
 * 与草稿保存**刻意不同**：草稿允许名称为空、允许区间价只填了下限 —— 编辑到一半
 * 必须存得下去。而一旦要发布，这些都必须齐全，规则与改造前完全一致
 * （至少一种语言有名称、必须有 slug 与封面、区间价上限不得小于下限）。
 *
 * 校验永远在服务端跑，客户端那份只是提前提示。
 */
export function validateForPublish(
  draft: ProductDraft,
  messages: {
    slugRequired: string;
    slugFormat: string;
    nameRequired: string;
    nameRequiredForLocale: string;
    coverRequired: string;
    priceMinRequired: string;
    priceRangeInvalid: string;
  },
): { ok: true } | { ok: false; message: string } {
  if (!draft.basic.slug) return { ok: false, message: messages.slugRequired };
  if (!SLUG_PATTERN.test(draft.basic.slug)) {
    return { ok: false, message: messages.slugFormat };
  }
  if (!draft.basic.coverAssetId) return { ok: false, message: messages.coverRequired };

  const named = ADMIN_LOCALES.some((locale) => draft.translations[locale].name.trim().length > 0);
  if (!named) return { ok: false, message: messages.nameRequired };

  // 某种语言填了正文或 SEO 却没填名称：不能放行。
  // 翻译行的 name 是 NOT NULL，而前台的「当前语言 → 英文 → 任意语言」回退是按**有没有这一行**
  // 决定的 —— 放它过去，该语言的前台就会渲染出一个空商品名，而不是回退到英文。
  for (const locale of ADMIN_LOCALES) {
    const values = draft.translations[locale];
    if (values.name.trim()) continue;
    const hasOther = [
      values.shortDescription,
      values.description,
      values.sizeSummary,
      values.spec,
      values.application,
      values.seoTitle,
      values.seoDescription,
    ].some((value) => value.trim().length > 0);
    if (hasOther) return { ok: false, message: messages.nameRequiredForLocale };
  }

  const { priceMode, priceMin, priceMax } = draft.pricing;
  if (priceMode !== 'NEGOTIABLE') {
    if (!priceMin) return { ok: false, message: messages.priceMinRequired };
    if (priceMode === 'RANGE' && priceMax && Number(priceMax) < Number(priceMin)) {
      return { ok: false, message: messages.priceRangeInvalid };
    }
  }

  return { ok: true };
}

/**
 * 把草稿整理成「可以直接写进关系表」的形式：三种价格模式的差异在这里收敛。
 *
 * 与改造前的 `resolvePrice` 规则一一对应：面议清空价格、固定价清空上限、
 * 区间价保留上下限。金额始终是字符串，写库时由 Prisma 转成 Decimal。
 */
export function resolveDraftPrice(draft: ProductDraft): {
  priceMin: string | null;
  priceMax: string | null;
} {
  const { priceMode, priceMin, priceMax } = draft.pricing;
  if (priceMode === 'NEGOTIABLE') return { priceMin: null, priceMax: null };
  if (priceMode === 'FIXED') return { priceMin, priceMax: null };
  return { priceMin, priceMax };
}
