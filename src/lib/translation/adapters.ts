import type { Prisma, PrismaClient } from '@prisma/client';
import type { Locale } from '@/lib/i18n/config';
import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';
import { loadProductDraftState, saveDraft } from '@/lib/admin/product-draft-store';
import {
  readPageDraft,
  type PageBlockTranslationValues,
  type PageDraft,
  type PageTranslationValues,
} from '@/lib/page-draft';
import type { ProductDraft } from '@/lib/product-draft';
import type { SourceDocument, TargetValues, TranslationUnit } from './document';
import { detectFormat } from './document';

/**
 * 内容适配器：把每一种后台可编辑、访客可见的中文内容，摊平成同一种形状
 * （`SourceDocument`），并负责把译文写回去。
 *
 * 全站同步、一键翻译、发布前同步都只认这一个接口。这样做的直接好处是：
 * 「同步」只有一份实现，加一种内容类型只需要在这里加一个适配器，
 * 而不是在后台各个页面各写一遍翻译逻辑（那样必然会出现某几个页面漏翻）。
 *
 * 两条贯穿全文件的规则：
 *   1. **只把中文原文送去翻译**。中文为空 → 该字段不进文档 → 永不出现在任何请求里。
 *   2. **结构字段永不进文档**（slug、链接、价格、开关、素材 id）。它们不是文案，
 *      送去翻译只会翻出错误的值。
 */

/** 数据库句柄：适配器既要在事务里跑（发布），也要在事务外跑（后台同步） */
export type Db = PrismaClient | Prisma.TransactionClient;

export const CONTENT_TYPES = ['product', 'page', 'company', 'contact', 'nav', 'category', 'asset'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export function isContentType(value: string): value is ContentType {
  return (CONTENT_TYPES as readonly string[]).includes(value);
}

/** 全站同步要处理的一个内容实体 */
export interface ScopeEntry {
  entityId: string;
  /** 后台列表里显示的名称（中文） */
  label: string;
  /** 次要说明，例如 slug */
  hint?: string;
}

export interface ContentAdapter {
  type: ContentType;
  /** 读取中文原文。返回 null 表示这条内容不存在。 */
  readSource(db: Db, entityId: string): Promise<SourceDocument | null>;
  /** 读取某语言当前已有的译文 */
  readTarget(db: Db, entityId: string, locale: Locale): Promise<TargetValues>;
  /**
   * 写入译文。商品与页面写进**草稿**（线上不受影响，发布时才生效）；
   * 其余类型没有草稿机制，直接写库 —— 与它们现有的后台表单行为一致。
   */
  writeTranslations(
    db: Db,
    entityId: string,
    locale: Locale,
    values: TargetValues,
    cleared: readonly string[],
  ): Promise<void>;
  /** 该类型下「已发布」的全部内容，供全站同步使用 */
  listScope(db: Db): Promise<ScopeEntry[]>;
}

// ---------------------------------------------------------------------------
// 通用工具
// ---------------------------------------------------------------------------

function unit(path: string, label: string, text: string | null | undefined): TranslationUnit | null {
  const clean = (text ?? '').trim();
  if (!clean) return null;
  return { path, label, text: clean, format: detectFormat(clean) };
}

function compact(units: (TranslationUnit | null)[]): TranslationUnit[] {
  return units.filter((item): item is TranslationUnit => item !== null);
}

/** 译文为空串时，写库一律落成 null —— 与「没填过」是同一件事，前台才好回退 */
function orNull(value: string | undefined): string | null {
  const clean = (value ?? '').trim();
  return clean ? clean : null;
}

function emptyLocaleRecord(): Record<AdminLocale, string> {
  return Object.fromEntries(ADMIN_LOCALES.map((locale) => [locale, ''])) as Record<AdminLocale, string>;
}

// ---------------------------------------------------------------------------
// 商品
// ---------------------------------------------------------------------------

/** 商品各个直接字段的路径与说明 */
const PRODUCT_FIELDS: { key: keyof ProductDraft['translations'][AdminLocale]; label: string }[] = [
  { key: 'name', label: '商品名称' },
  { key: 'shortDescription', label: '一句话介绍' },
  { key: 'description', label: '完整介绍' },
  { key: 'sizeSummary', label: '尺寸摘要' },
  { key: 'spec', label: '规格说明' },
  { key: 'application', label: '应用场景' },
  { key: 'seoTitle', label: 'SEO 标题' },
  { key: 'seoDescription', label: 'SEO 描述' },
];

/**
 * 把一个商品的草稿摊平成「同一种语言的路径 → 值」的读写表。
 *
 * 路径由**枚举草稿结构**构造，而不是解析字符串。行 id、列 id 由前端生成，
 * 万一里面带了分隔符，解析式的写法会把路径切错；枚举式则天然不受影响 ——
 * 读和写用的是同一段代码生成的同一个字符串。
 *
 * 顺带解决了「按 id 而不是按下标回填」：增删一行只会让那一行的路径消失，
 * 其余路径纹丝不动，状态不会整体错位。
 */
function productPaths(draft: ProductDraft, locale: AdminLocale): Map<string, { read: () => string; write: (value: string) => void }> {
  const map = new Map<string, { read: () => string; write: (value: string) => void }>();

  for (const field of PRODUCT_FIELDS) {
    const path = `translations.${field.key}`;
    map.set(path, {
      read: () => draft.translations[locale][field.key] ?? '',
      write: (value) => {
        draft.translations[locale][field.key] = value;
      },
    });
  }

  // 旧版「参数」关系表（specTable 出现之前的数据）。只在没有 specTable 时前台才读它，
  // 但这里一律也翻 —— 少翻一份会让某些老商品的前台留下中文。
  draft.specs.forEach((spec, index) => {
    const id = spec.id ?? `draft-${index}`;
    map.set(`specs.${id}.name`, {
      read: () => spec.values[locale]?.name ?? '',
      write: (value) => {
        spec.values[locale] = { ...spec.values[locale], name: value };
      },
    });
    map.set(`specs.${id}.value`, {
      read: () => spec.values[locale]?.value ?? '',
      write: (value) => {
        spec.values[locale] = { ...spec.values[locale], value };
      },
    });
  });

  for (const column of draft.specTable.columns) {
    map.set(`specTable.columns.${column.id}`, {
      read: () => column.values[locale] ?? '',
      write: (value) => {
        column.values[locale] = value;
      },
    });
  }

  for (const row of draft.specTable.rows) {
    for (const column of draft.specTable.columns) {
      // 单元格可能还没被创建过（新增了列但这一行还没填）
      const cells = row.cells[column.id] ?? (row.cells[column.id] = emptyLocaleRecord());
      map.set(`specTable.rows.${row.id}.cells.${column.id}`, {
        read: () => cells[locale] ?? '',
        write: (value) => {
          cells[locale] = value;
        },
      });
    }
  }

  for (const group of draft.variantGroups) {
    map.set(`variantGroups.${group.id}.name`, {
      read: () => group.values[locale] ?? '',
      write: (value) => {
        group.values[locale] = value;
      },
    });
    for (const option of group.options) {
      map.set(`variantGroups.${group.id}.options.${option.id}.name`, {
        read: () => option.values[locale] ?? '',
        write: (value) => {
          option.values[locale] = value;
        },
      });
    }
  }

  return map;
}

/** 给路径配一个人看的说明，用在提示词里 */
function productLabel(path: string): string {
  const field = PRODUCT_FIELDS.find((item) => `translations.${item.key}` === path);
  if (field) return field.label;
  if (path.startsWith('specTable.columns.')) return '规格表列名';
  if (path.startsWith('specTable.rows.')) return '规格表内容';
  if (path.startsWith('variantGroups.') && path.endsWith('.name') && path.split('.').length === 3) {
    return '选项组名称';
  }
  if (path.startsWith('variantGroups.')) return '型号/颜色选项名';
  if (path.startsWith('specs.') && path.endsWith('.name')) return '参数名称';
  if (path.startsWith('specs.')) return '参数值';
  return '商品内容';
}

async function loadProductForEdit(db: Db, productId: string): Promise<{ draft: ProductDraft; slug: string } | null> {
  const state = await loadProductDraftState(db, productId);
  if (!state) return null;
  return { draft: state.draft, slug: state.draft.basic.slug };
}

const productAdapter: ContentAdapter = {
  type: 'product',

  async readSource(db, entityId) {
    const loaded = await loadProductForEdit(db, entityId);
    if (!loaded) return null;

    const paths = productPaths(loaded.draft, 'zh');
    const units = compact(
      [...paths.entries()].map(([path, access]) => unit(path, productLabel(path), access.read())),
    );
    return { entityType: 'product', entityId, units };
  },

  async readTarget(db, entityId, locale) {
    const loaded = await loadProductForEdit(db, entityId);
    if (!loaded || locale === 'zh') return {};

    const paths = productPaths(loaded.draft, locale as AdminLocale);
    return Object.fromEntries([...paths.entries()].map(([path, access]) => [path, access.read()]));
  },

  async writeTranslations(db, entityId, locale, values, cleared) {
    if (locale === 'zh') return;
    const loaded = await loadProductForEdit(db, entityId);
    if (!loaded) return;

    const paths = productPaths(loaded.draft, locale as AdminLocale);

    // 先清掉中文已经删掉的字段 —— 否则中文删了、译文还挂在线上
    const removable = new Set(cleared);
    for (const [path, access] of paths) {
      if (removable.has(path)) access.write('');
    }

    for (const [path, value] of Object.entries(values)) {
      const access = paths.get(path);
      // 路径对不上就丢弃。翻译结果只能写回**它自己**的位置，
      // 匹配不上宁可丢掉，也绝不猜一个位置塞进去。
      if (access) access.write(value);
    }

    await saveDraft(db as PrismaClient, entityId, loaded.draft);
  },

  async listScope(db) {
    const rows = await db.product.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, slug: true, translations: { where: { locale: 'zh' }, select: { name: true } } },
    });
    return rows.map((row) => ({
      entityId: row.id,
      label: row.translations[0]?.name?.trim() || row.slug,
      hint: row.slug,
    }));
  },
};

// ---------------------------------------------------------------------------
// 页面（含首页）
// ---------------------------------------------------------------------------

const PAGE_FIELDS: { key: keyof PageTranslationValues; label: string }[] = [
  { key: 'title', label: '页面标题' },
  { key: 'seoTitle', label: 'SEO 标题' },
  { key: 'seoDescription', label: 'SEO 描述' },
];

const BLOCK_FIELDS: { key: keyof PageBlockTranslationValues; label: string }[] = [
  { key: 'title', label: '区块标题' },
  { key: 'subtitle', label: '区块副标题' },
  { key: 'body', label: '区块正文' },
  { key: 'ctaLabel', label: '按钮文字' },
  // ctaHref 刻意不在这里：链接是结构不是文案，翻它只会翻出一个 404。
];

function pagePaths(draft: PageDraft, locale: AdminLocale): Map<string, { read: () => string; write: (value: string) => void }> {
  const map = new Map<string, { read: () => string; write: (value: string) => void }>();

  for (const field of PAGE_FIELDS) {
    map.set(`translations.${field.key}`, {
      read: () => draft.translations[locale][field.key] ?? '',
      write: (value) => {
        draft.translations[locale][field.key] = value;
      },
    });
  }

  // 区块路径用**区块自己的 id**（草稿里新增的用 key 兜底），不用数组下标：
  // 前台区块顺序变了不该让译文状态整体错位。
  for (const block of draft.blocks) {
    const anchor = block.id ?? `key:${block.key}`;
    for (const field of BLOCK_FIELDS) {
      map.set(`blocks.${anchor}.${field.key}`, {
        read: () => block.values[locale][field.key] ?? '',
        write: (value) => {
          block.values[locale][field.key] = value;
        },
      });
    }
  }

  return map;
}

function pageLabel(path: string): string {
  const field = PAGE_FIELDS.find((item) => `translations.${item.key}` === path);
  if (field) return field.label;
  const last = path.split('.').pop() ?? '';
  return BLOCK_FIELDS.find((item) => item.key === last)?.label ?? '页面区块';
}

async function loadPageForEdit(db: Db, pageId: string): Promise<PageDraft | null> {
  const row = await db.page.findUnique({
    where: { id: pageId },
    include: {
      translations: true,
      blocks: {
        orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
        include: { translations: true },
      },
    },
  });
  if (!row) return null;

  const live = pageDraftFromRow(row);
  return readPageDraft(row.draftData) ?? live;
}

type PageRow = Prisma.PageGetPayload<{
  include: { translations: true; blocks: { include: { translations: true } } };
}>;

export function pageDraftFromRow(row: PageRow): PageDraft {
  const translations = {} as PageDraft['translations'];
  for (const locale of ADMIN_LOCALES) {
    const tr = row.translations.find((item) => item.locale === locale);
    translations[locale] = {
      title: tr?.title ?? '',
      seoTitle: tr?.seoTitle ?? '',
      seoDescription: tr?.seoDescription ?? '',
    };
  }

  return {
    slug: row.slug,
    translations,
    blocks: row.blocks.map((block, index) => {
      const values = {} as PageBlockDraftValues;
      for (const locale of ADMIN_LOCALES) {
        const tr = block.translations.find((item) => item.locale === locale);
        values[locale] = {
          title: tr?.title ?? '',
          subtitle: tr?.subtitle ?? '',
          body: tr?.body ?? '',
          ctaLabel: tr?.ctaLabel ?? '',
          ctaHref: tr?.ctaHref ?? '',
        };
      }
      return { id: block.id, key: block.key, enabled: block.enabled, sortOrder: block.sortOrder ?? index, values };
    }),
  };
}

type PageBlockDraftValues = Record<AdminLocale, PageBlockTranslationValues>;

const pageAdapter: ContentAdapter = {
  type: 'page',

  async readSource(db, entityId) {
    const draft = await loadPageForEdit(db, entityId);
    if (!draft) return null;

    const paths = pagePaths(draft, 'zh');
    return {
      entityType: 'page',
      entityId,
      units: compact([...paths.entries()].map(([path, access]) => unit(path, pageLabel(path), access.read()))),
    };
  },

  async readTarget(db, entityId, locale) {
    if (locale === 'zh') return {};
    const draft = await loadPageForEdit(db, entityId);
    if (!draft) return {};
    const paths = pagePaths(draft, locale as AdminLocale);
    return Object.fromEntries([...paths.entries()].map(([path, access]) => [path, access.read()]));
  },

  async writeTranslations(db, entityId, locale, values, cleared) {
    if (locale === 'zh') return;
    const draft = await loadPageForEdit(db, entityId);
    if (!draft) return;

    const paths = pagePaths(draft, locale as AdminLocale);
    const removable = new Set(cleared);
    for (const [path, access] of paths) {
      if (removable.has(path)) access.write('');
    }
    for (const [path, value] of Object.entries(values)) {
      const access = paths.get(path);
      if (access) access.write(value);
    }

    await (db as PrismaClient).page.update({
      where: { id: entityId },
      data: { draftData: draft as unknown as Prisma.InputJsonValue, draftUpdatedAt: new Date() },
    });
  },

  async listScope(db) {
    const rows = await db.page.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, slug: true, isHome: true, translations: { where: { locale: 'zh' }, select: { title: true } } },
    });
    return rows.map((row) => ({
      entityId: row.id,
      label: row.translations[0]?.title?.trim() || row.slug,
      hint: row.isHome ? `${row.slug}（首页）` : row.slug,
    }));
  },
};

// ---------------------------------------------------------------------------
// 公司资料（单例）
// ---------------------------------------------------------------------------

const COMPANY_FIELDS = [
  { key: 'name' as const, label: '公司名称' },
  { key: 'tagline' as const, label: '一句话标语' },
  { key: 'about' as const, label: '公司介绍' },
  { key: 'positioning' as const, label: '定位' },
  { key: 'address' as const, label: '地址' },
  { key: 'businessHours' as const, label: '营业时间' },
  { key: 'seoTitle' as const, label: 'SEO 标题' },
  { key: 'seoDescription' as const, label: 'SEO 描述' },
];

/** 公司资料是单例，entityId 固定为 `primary`（与 CompanyProfile.slug 一致） */
const COMPANY_SINGLETON_ID = 'primary';

async function companyRow(db: Db) {
  return db.companyProfile.findUnique({
    where: { slug: COMPANY_SINGLETON_ID },
    include: { translations: true },
  });
}

const companyAdapter: ContentAdapter = {
  type: 'company',

  async readSource(db) {
    const row = await companyRow(db);
    if (!row) return null;
    const zh = row.translations.find((item) => item.locale === 'zh');
    return {
      entityType: 'company',
      entityId: COMPANY_SINGLETON_ID,
      units: compact(
        COMPANY_FIELDS.map((field) => unit(field.key, field.label, (zh?.[field.key] as string | null) ?? '')),
      ),
    };
  },

  async readTarget(db, entityId, locale) {
    if (locale === 'zh') return {};
    const row = await companyRow(db);
    const tr = row?.translations.find((item) => item.locale === locale);
    return Object.fromEntries(COMPANY_FIELDS.map((field) => [field.key, (tr?.[field.key] as string | null) ?? '']));
  },

  async writeTranslations(db, entityId, locale, values, cleared) {
    if (locale === 'zh') return;
    const row = await companyRow(db);
    if (!row) return;

    const existing = row.translations.find((item) => item.locale === locale);
    const data: Record<string, string | null> = {};
    for (const field of COMPANY_FIELDS) {
      if (cleared.includes(field.key)) {
        // 名称是必填列：只能清成空串，不能写 null
        data[field.key] = field.key === 'name' ? existing?.name ?? '' : null;
        continue;
      }
      if (field.key in values) data[field.key] = orNull(values[field.key]);
    }

    // name 是 NOT NULL 且必填。翻译只会往空名称上写，绝不会把已有名称清掉；
    // 真有别的语言只剩 SEO 没有名称时，用中文名兜底 —— 前台至少不会渲染出空白公司名。
    if (data.name === null || data.name === '') {
      const zhName = row.translations.find((item) => item.locale === 'zh')?.name ?? '';
      if (data.name === '') data.name = zhName;
    }

    await db.companyProfileTranslation.upsert({
      where: { profileId_locale: { profileId: row.id, locale } },
      create: {
        profileId: row.id,
        locale,
        name: typeof data.name === 'string' ? data.name : '',
        tagline: str(data.tagline),
        about: str(data.about),
        positioning: str(data.positioning),
        address: str(data.address),
        businessHours: str(data.businessHours),
        seoTitle: str(data.seoTitle),
        seoDescription: str(data.seoDescription),
      },
      update: data,
    });
  },

  async listScope(db) {
    const row = await companyRow(db);
    if (!row) return [];
    const zh = row.translations.find((item) => item.locale === 'zh');
    return [{ entityId: COMPANY_SINGLETON_ID, label: zh?.name?.trim() || '公司资料', hint: '单例' }];
  },
};

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

// ---------------------------------------------------------------------------
// 联系方式
// ---------------------------------------------------------------------------

/**
 * 联系方式只翻译 **label**（「销售咨询」「售后支持」这类说明文字）。
 *
 * `value` 是联系数据本身 —— 电话、邮箱、WhatsApp 号、微信号。
 * 把它们送去翻译，最好的结果是原样返回，最坏的结果是翻出一个打不通的号码。
 * 唯一的例外是地址：那是一段真正需要按目标语言重写的自然语言。
 */
const CONTACT_LABEL_PATH = 'label';
const CONTACT_VALUE_PATH = 'value';

async function contactRows(db: Db, entityId: string) {
  return db.contactMethod.findMany({
    where: { id: entityId },
    include: { translations: true },
  });
}

const contactAdapter: ContentAdapter = {
  type: 'contact',

  async readSource(db, entityId) {
    const rows = await contactRows(db, entityId);
    const row = rows[0];
    if (!row) return null;
    const zh = row.translations.find((item) => item.locale === 'zh');

    const units = compact([
      unit(CONTACT_LABEL_PATH, '联系方式说明', zh?.label),
      row.type === 'ADDRESS' ? unit(CONTACT_VALUE_PATH, '地址', zh?.value ?? row.value) : null,
    ]);
    return { entityType: 'contact', entityId, units };
  },

  async readTarget(db, entityId, locale) {
    if (locale === 'zh') return {};
    const row = (await contactRows(db, entityId))[0];
    const tr = row?.translations.find((item) => item.locale === locale);
    return {
      [CONTACT_LABEL_PATH]: tr?.label ?? '',
      ...(row?.type === 'ADDRESS' ? { [CONTACT_VALUE_PATH]: tr?.value ?? '' } : {}),
    };
  },

  async writeTranslations(db, entityId, locale, values, cleared) {
    if (locale === 'zh') return;
    const row = (await contactRows(db, entityId))[0];
    if (!row) return;

    const existing = row.translations.find((item) => item.locale === locale);
    const label = cleared.includes(CONTACT_LABEL_PATH) ? null : orNull(values[CONTACT_LABEL_PATH]);
    const isAddress = row.type === 'ADDRESS';
    const addressValue = isAddress
      ? cleared.includes(CONTACT_VALUE_PATH)
        ? null
        : orNull(values[CONTACT_VALUE_PATH])
      : existing?.value ?? null;

    // label 与 value 全空且没有别的可说时，不留一行空记录
    if (!label && !addressValue) {
      if (existing) await db.contactMethodTranslation.delete({ where: { id: existing.id } });
      return;
    }

    await db.contactMethodTranslation.upsert({
      where: { contactMethodId_locale: { contactMethodId: row.id, locale } },
      create: { contactMethodId: row.id, locale, label, value: addressValue },
      update: { label, value: addressValue },
    });
  },

  async listScope(db) {
    const rows = await db.contactMethod.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, type: true, translations: { where: { locale: 'zh' }, select: { label: true } } },
    });
    return rows.map((row) => ({ entityId: row.id, label: row.translations[0]?.label?.trim() || row.type, hint: row.type }));
  },
};

// ---------------------------------------------------------------------------
// 导航
// ---------------------------------------------------------------------------

const navAdapter: ContentAdapter = {
  type: 'nav',

  async readSource(db, entityId) {
    const row = await db.navItem.findUnique({ where: { id: entityId }, include: { translations: true } });
    if (!row) return null;
    const zh = row.translations.find((item) => item.locale === 'zh');
    return { entityType: 'nav', entityId, units: compact([unit('label', '导航文字', zh?.label)]) };
  },

  async readTarget(db, entityId, locale): Promise<TargetValues> {
    if (locale === 'zh') return {};
    const row = await db.navItem.findUnique({ where: { id: entityId }, include: { translations: true } });
    return { label: row?.translations.find((item) => item.locale === locale)?.label ?? '' };
  },

  async writeTranslations(db, entityId, locale, values, cleared) {
    if (locale === 'zh') return;
    const row = await db.navItem.findUnique({ where: { id: entityId }, include: { translations: true } });
    if (!row) return;
    const existing = row.translations.find((item) => item.locale === locale);
    const label = cleared.includes('label') ? null : orNull(values.label);

    // NavItemTranslation.label 是必填列：没有文字就不建行，让前台回退
    if (!label) {
      if (existing) await db.navItemTranslation.delete({ where: { id: existing.id } });
      return;
    }
    await db.navItemTranslation.upsert({
      where: { navItemId_locale: { navItemId: row.id, locale } },
      create: { navItemId: row.id, locale, label },
      update: { label },
    });
  },

  async listScope(db) {
    const rows = await db.navItem.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, href: true, translations: { where: { locale: 'zh' }, select: { label: true } } },
    });
    return rows.map((row) => ({ entityId: row.id, label: row.translations[0]?.label?.trim() || row.href, hint: row.href }));
  },
};

// ---------------------------------------------------------------------------
// 商品类目
// ---------------------------------------------------------------------------

const categoryAdapter: ContentAdapter = {
  type: 'category',

  async readSource(db, entityId) {
    const row = await db.productCategory.findUnique({ where: { id: entityId }, include: { translations: true } });
    if (!row) return null;
    const zh = row.translations.find((item) => item.locale === 'zh');
    return {
      entityType: 'category',
      entityId,
      units: compact([unit('name', '类目名称', zh?.name), unit('description', '类目说明', zh?.description)]),
    };
  },

  async readTarget(db, entityId, locale): Promise<TargetValues> {
    if (locale === 'zh') return {};
    const row = await db.productCategory.findUnique({ where: { id: entityId }, include: { translations: true } });
    const tr = row?.translations.find((item) => item.locale === locale);
    return { name: tr?.name ?? '', description: tr?.description ?? '' };
  },

  async writeTranslations(db, entityId, locale, values, cleared) {
    if (locale === 'zh') return;
    const row = await db.productCategory.findUnique({ where: { id: entityId }, include: { translations: true } });
    if (!row) return;
    const existing = row.translations.find((item) => item.locale === locale);
    const name = cleared.includes('name') ? '' : (values.name ?? existing?.name ?? '').trim();
    const description = cleared.includes('description') ? null : orNull(values.description);

    // name 是 NOT NULL，没有名称就不该有这一行
    if (!name) {
      if (existing) await db.categoryTranslation.delete({ where: { id: existing.id } });
      return;
    }
    await db.categoryTranslation.upsert({
      where: { categoryId_locale: { categoryId: row.id, locale } },
      create: { categoryId: row.id, locale, name, description },
      update: { name, description },
    });
  },

  async listScope(db) {
    const rows = await db.productCategory.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, slug: true, translations: { where: { locale: 'zh' }, select: { name: true } } },
    });
    return rows.map((row) => ({ entityId: row.id, label: row.translations[0]?.name?.trim() || row.slug, hint: row.slug }));
  },
};

// ---------------------------------------------------------------------------
// 素材（图片 alt / 标题 / 说明）
// ---------------------------------------------------------------------------

const ASSET_FIELDS = [
  { key: 'title' as const, label: '图片标题' },
  { key: 'caption' as const, label: '图片说明' },
  { key: 'alt' as const, label: '图片替代文字（alt）' },
];

const assetAdapter: ContentAdapter = {
  type: 'asset',

  async readSource(db, entityId) {
    const row = await db.asset.findUnique({ where: { id: entityId }, include: { translations: true } });
    if (!row) return null;
    const zh = row.translations.find((item) => item.locale === 'zh');
    return {
      entityType: 'asset',
      entityId,
      units: compact(ASSET_FIELDS.map((field) => unit(field.key, field.label, zh?.[field.key]))),
    };
  },

  async readTarget(db, entityId, locale) {
    if (locale === 'zh') return {};
    const row = await db.asset.findUnique({ where: { id: entityId }, include: { translations: true } });
    const tr = row?.translations.find((item) => item.locale === locale);
    return Object.fromEntries(ASSET_FIELDS.map((field) => [field.key, tr?.[field.key] ?? '']));
  },

  async writeTranslations(db, entityId, locale, values, cleared) {
    if (locale === 'zh') return;
    const row = await db.asset.findUnique({ where: { id: entityId }, include: { translations: true } });
    if (!row) return;

    const existing = row.translations.find((item) => item.locale === locale);
    const data: Record<string, string | null> = {};
    for (const field of ASSET_FIELDS) {
      if (cleared.includes(field.key)) data[field.key] = null;
      else if (field.key in values) data[field.key] = orNull(values[field.key]);
    }

    const hasAnything = ASSET_FIELDS.some((field) => {
      const value = field.key in data ? data[field.key] : (existing?.[field.key] ?? null);
      return typeof value === 'string' && value.trim().length > 0;
    });
    if (!hasAnything) {
      if (existing) await db.assetTranslation.delete({ where: { id: existing.id } });
      return;
    }

    await db.assetTranslation.upsert({
      where: { assetId_locale: { assetId: row.id, locale } },
      create: {
        assetId: row.id,
        locale,
        title: str(data.title),
        caption: str(data.caption),
        alt: str(data.alt),
      },
      update: data,
    });
  },

  async listScope(db) {
    const rows = await db.asset.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, originalName: true, key: true, translations: { where: { locale: 'zh' }, select: { title: true, alt: true } } },
    });
    return rows.map((row) => ({
      entityId: row.id,
      label: row.translations[0]?.title?.trim() || row.originalName || row.key,
      hint: row.originalName ?? row.key,
    }));
  },
};

// ---------------------------------------------------------------------------
// 注册表
// ---------------------------------------------------------------------------

export const ADAPTERS: Record<ContentType, ContentAdapter> = {
  product: productAdapter,
  page: pageAdapter,
  company: companyAdapter,
  contact: contactAdapter,
  nav: navAdapter,
  category: categoryAdapter,
  asset: assetAdapter,
};

export function getAdapter(type: string): ContentAdapter | null {
  return isContentType(type) ? ADAPTERS[type] : null;
}

/** 中文以外的全部目标语言，从统一语言清单派生 */
export function targetLocales(locales: readonly Locale[]): Locale[] {
  return locales.filter((locale) => locale !== 'zh');
}
