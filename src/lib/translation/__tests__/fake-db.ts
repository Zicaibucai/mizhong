import type { PrismaClient } from '@prisma/client';
import type { Locale } from '@/lib/i18n/config';
import { ADMIN_LOCALES } from '@/lib/admin/validation';
import { emptySpecTable, emptyTranslations, type ProductDraft } from '@/lib/product-draft';
import { emptyPageTranslations, emptyBlockTranslations, type PageDraft } from '@/lib/page-draft';

/**
 * 一个够用的内存版 Prisma。
 *
 * 本机没有 Postgres（见项目说明），而同步引擎的正确性恰恰体现在**跨多次读写**的
 * 行为上 —— 「只改一个字段就只翻一个字段」「中文清空后译文跟着清空」「重复同步
 * 零调用」都要连着跑三步才看得出来。所以这里手写一份支持**用到的那些操作**的假库，
 * 而不是把逻辑拆成更难验证的小块。
 *
 * 刻意保持朴素：只实现引擎与适配器真正调用到的方法，不认识的方法直接抛错 ——
 * 这样一旦生产代码开始用新查询，测试会立刻失败，而不是悄悄返回 undefined
 * 让测试在错误的前提下通过。
 */

export interface FakeAsset {
  id: string;
  type: 'IMAGE' | 'VIDEO';
  key: string;
  url: string;
  originalName?: string | null;
  enabled: boolean;
  sortOrder: number;
  translations: { id: string; assetId: string; locale: Locale; title: string | null; caption: string | null; alt: string | null }[];
}

export interface FakeDbSeed {
  products?: Array<{
    id: string;
    slug: string;
    published?: boolean;
    sortOrder?: number;
    translations?: Partial<Record<Locale, Partial<ProductDraft['translations'][Locale]>>>;
    specTable?: ProductDraft['specTable'];
    variantGroups?: ProductDraft['variantGroups'];
  }>;
  pages?: Array<{
    id: string;
    slug: string;
    status?: 'DRAFT' | 'PUBLISHED';
    isHome?: boolean;
    translations?: Partial<Record<Locale, { title?: string; seoTitle?: string; seoDescription?: string }>>;
    blocks?: Array<{
      id: string;
      key: string;
      enabled?: boolean;
      sortOrder?: number;
      translations?: Partial<
        Record<Locale, { title?: string; subtitle?: string; body?: string; ctaLabel?: string; ctaHref?: string }>
      >;
    }>;
  }>;
  company?: Partial<Record<Locale, Record<string, string>>>;
  assets?: FakeAsset[];
}

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter}`;
}

export function createFakePrisma(seed: FakeDbSeed = {}) {
  const products = new Map<string, Record<string, unknown>>();
  const pages = new Map<string, Record<string, unknown>>();
  const revisionRows = new Map<string, { entityType: string; entityId: string; revision: number; sourceHash: string }>();
  const stateRows = new Map<string, Record<string, unknown>>();
  const companyTranslations = new Map<Locale, Record<string, unknown>>();

  for (const product of seed.products ?? []) {
    const translations = emptyTranslations();
    for (const locale of ADMIN_LOCALES) {
      Object.assign(translations[locale], product.translations?.[locale] ?? {});
    }
    products.set(product.id, {
      id: product.id,
      slug: product.slug,
      published: product.published ?? true,
      sortOrder: product.sortOrder ?? 0,
      sku: null,
      categoryId: null,
      coverAssetId: null,
      hoverVideoAssetId: null,
      priceMode: 'NEGOTIABLE',
      currency: 'USD',
      priceMin: null,
      priceMax: null,
      priceUnit: null,
      moq: null,
      moqUnit: null,
      draftData: null,
      draftUpdatedAt: null,
      specTable: product.specTable ?? null,
      variantGroups: product.variantGroups ?? null,
      createdAt: new Date(),
      translations: ADMIN_LOCALES.flatMap((locale) =>
        Object.values(translations[locale]).some((value) => value.trim())
          ? [{ id: nextId('ptr'), productId: product.id, locale, ...translations[locale] }]
          : [],
      ),
      specifications: [],
      media: [],
    });

    // 默认把中文内容当作「已经记录过的版本」，测试要从一个稳定的起点开始
    revisionRows.set(`product:${product.id}`, {
      entityType: 'product',
      entityId: product.id,
      revision: 1,
      sourceHash: '',
    });
  }

  for (const page of seed.pages ?? []) {
    const translations = emptyPageTranslations();
    for (const locale of ADMIN_LOCALES) {
      Object.assign(translations[locale], page.translations?.[locale] ?? {});
    }
    pages.set(page.id, {
      id: page.id,
      slug: page.slug,
      status: page.status ?? 'PUBLISHED',
      isHome: page.isHome ?? false,
      sortOrder: 0,
      draftData: null,
      draftUpdatedAt: null,
      translations: ADMIN_LOCALES.flatMap((locale) =>
        translations[locale].title.trim()
          ? [{ id: nextId('ptr'), pageId: page.id, locale, ...translations[locale] }]
          : [],
      ),
      blocks: (page.blocks ?? []).map((block, index) => {
        const values = emptyBlockTranslations();
        for (const locale of ADMIN_LOCALES) {
          Object.assign(values[locale], block.translations?.[locale] ?? {});
        }
        return {
          id: block.id,
          pageId: page.id,
          key: block.key,
          type: null,
          enabled: block.enabled ?? true,
          sortOrder: block.sortOrder ?? index,
          translations: ADMIN_LOCALES.filter((locale) => values[locale].title.trim() || values[locale].body.trim()).map(
            (locale) => ({ id: nextId('btr'), blockId: block.id, locale, ...values[locale] }),
          ),
        };
      }),
    });
  }

  for (const [locale, values] of Object.entries(seed.company ?? {}) as [Locale, Record<string, string>][]) {
    companyTranslations.set(locale, { id: nextId('ctr'), profileId: 'profile_1', locale, ...values });
  }

  const assets = new Map<string, FakeAsset>();
  for (const asset of seed.assets ?? []) assets.set(asset.id, asset);

  /** 按 include 的形状把关联挂上去 —— 假库也要模拟「include 里有什么就返回什么」 */
  function withProductInclude(row: Record<string, unknown>) {
    return {
      ...row,
      translations: (row.translations as unknown[]).filter(Boolean),
      specifications: [],
      media: [],
    };
  }

  function withPageInclude(row: Record<string, unknown>) {
    return { ...row, translations: row.translations, blocks: row.blocks };
  }

  const db = {
    product: {
      async findUnique({ where, include }: { where: { id: string }; include?: unknown }) {
        const row = products.get(where.id);
        if (!row) return null;
        if (include) return withProductInclude(row);
        return row;
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const row = products.get(where.id);
        if (!row) throw new Error(`fake db: no product ${where.id}`);
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
    },
    page: {
      async findUnique({ where, include }: { where: { id: string }; include?: unknown }) {
        const row = pages.get(where.id);
        if (!row) return null;
        if (include) return withPageInclude(row);
        return row;
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const row = pages.get(where.id);
        if (!row) throw new Error(`fake db: no page ${where.id}`);
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
    },
    translationState: {
      async findMany({ where }: { where: { entityType: string; entityId: string } }) {
        return [...stateRows.values()].filter(
          (row) => row.entityType === where.entityType && row.entityId === where.entityId,
        );
      },
      async deleteMany({ where }: { where: { entityType: string; entityId: string } }) {
        let removed = 0;
        for (const [key, row] of stateRows) {
          if (row.entityType === where.entityType && row.entityId === where.entityId) {
            stateRows.delete(key);
            removed += 1;
          }
        }
        return { count: removed };
      },
      async upsert({
        where,
        create,
        update,
      }: {
        where: { entityType_entityId_locale: { entityType: string; entityId: string; locale: Locale } };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) {
        const key = `${where.entityType_entityId_locale.entityType}:${where.entityType_entityId_locale.entityId}:${where.entityType_entityId_locale.locale}`;
        const existing = stateRows.get(key);
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date() });
          return existing;
        }
        const row = { id: nextId('ts'), ...create, createdAt: new Date(), updatedAt: new Date() };
        stateRows.set(key, row);
        return row;
      },
    },
    contentRevision: {
      async findUnique({ where }: { where: { entityType_entityId: { entityType: string; entityId: string } } }) {
        return revisionRows.get(`${where.entityType_entityId.entityType}:${where.entityType_entityId.entityId}`) ?? null;
      },
      async deleteMany({ where }: { where: { entityType: string; entityId: string } }) {
        const key = `${where.entityType}:${where.entityId}`;
        const existed = revisionRows.delete(key);
        return { count: existed ? 1 : 0 };
      },
      async upsert({
        where,
        create,
        update,
      }: {
        where: { entityType_entityId: { entityType: string; entityId: string } };
        create: { entityType: string; entityId: string; revision: number; sourceHash: string };
        update: { revision: number; sourceHash: string };
      }) {
        const key = `${where.entityType_entityId.entityType}:${where.entityType_entityId.entityId}`;
        const existing = revisionRows.get(key);
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date() });
          return existing;
        }
        const row = { ...create, createdAt: new Date(), updatedAt: new Date() };
        revisionRows.set(key, row);
        return row;
      },
    },
    companyProfile: {
      async findUnique({ where }: { where: { slug: string }; include?: unknown }) {
        if (where.slug !== 'primary') return null;
        return {
          id: 'profile_1',
          slug: 'primary',
          translations: [...companyTranslations.values()],
        };
      },
    },
    companyProfileTranslation: {
      async upsert({
        where,
        create,
        update,
      }: {
        where: { profileId_locale: { profileId: string; locale: Locale } };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) {
        const locale = where.profileId_locale.locale;
        const existing = companyTranslations.get(locale);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = { id: nextId('ctr'), ...create };
        companyTranslations.set(locale, row);
        return row;
      },
    },
    asset: {
      async findUnique({ where, include }: { where: { id: string }; include?: unknown }) {
        const row = assets.get(where.id);
        if (!row) return null;
        return include ? { ...row, translations: row.translations } : row;
      },
      async findMany({ where }: { where: { enabled?: boolean } }) {
        return [...assets.values()].filter((asset) => (where.enabled ? asset.enabled : true));
      },
    },
    assetTranslation: {
      async upsert({
        where,
        create,
        update,
      }: {
        where: { assetId_locale: { assetId: string; locale: Locale } };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) {
        const { assetId, locale } = where.assetId_locale;
        const asset = assets.get(assetId);
        if (!asset) throw new Error(`fake db: no asset ${assetId}`);
        const existing = asset.translations.find((row) => row.locale === locale);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = {
          id: nextId('atr'),
          assetId,
          locale,
          title: null,
          caption: null,
          alt: null,
          ...create,
        } as FakeAsset['translations'][number];
        asset.translations.push(row);
        return row;
      },
      async delete({ where }: { where: { id: string } }) {
        for (const asset of assets.values()) {
          const index = asset.translations.findIndex((row) => row.id === where.id);
          if (index >= 0) {
            const [removed] = asset.translations.splice(index, 1);
            return removed;
          }
        }
        throw new Error(`fake db: no assetTranslation ${where.id}`);
      },
    },
  };

  /**
   * 测试用的直接操作入口。
   *
   * 刻意通过这几个方法改数据，而不是让测试去翻内部结构：用例读起来就是
   * 「把中文名改成 X」「读一下线上跑的译文」，与它要验证的**行为**一一对应。
   */
  const handle = {
    /**
     * 改内容的「工作副本」—— 模拟管理员在编辑器里改了中文并保存。
     *
     * 中文同时写进线上内容与草稿（如果已经有草稿）。同步读中文时是**草稿优先**的，
     * 因为编辑器里的最新中文就在草稿上；只改线上而草稿里还是旧值的话，
     * 测出来的行为并不是真实后台的行为。
     */
    setProductTranslation(productId: string, locale: Locale, values: Partial<ProductDraft['translations'][Locale]>) {
      const row = products.get(productId);
      if (!row) throw new Error(`fake db: no product ${productId}`);

      const rows = row.translations as Array<Record<string, unknown>>;
      const existing = rows.find((item) => item.locale === locale);
      if (existing) Object.assign(existing, values);
      else rows.push({ id: nextId('ptr'), productId, locale, ...values });

      const draft = row.draftData as ProductDraft | null;
      if (draft) Object.assign(draft.translations[locale], values);
    },

    /** 读商品「线上跑的」某语言内容 —— 发布之后该看这里 */
    getProductTranslation(productId: string, locale: Locale): Record<string, unknown> | undefined {
      const rows = products.get(productId)?.translations as Array<Record<string, unknown>> | undefined;
      return rows?.find((item) => item.locale === locale);
    },

    /** 读商品草稿 —— 同步写的是草稿，发布之前线上不该变 */
    getProductDraft(productId: string): ProductDraft | null {
      return (products.get(productId)?.draftData as ProductDraft | null) ?? null;
    },

    /** 读页面草稿 */
    getPageDraft(pageId: string): PageDraft | null {
      return (pages.get(pageId)?.draftData as PageDraft | null) ?? null;
    },

    /** 某个「内容 × 语言」的同步状态，用于断言「这次到底翻了没有」 */
    getState(entityType: string, entityId: string, locale: Locale) {
      return stateRows.get(`${entityType}:${entityId}:${locale}`) ?? null;
    },

    getRevision(entityType: string, entityId: string) {
      return revisionRows.get(`${entityType}:${entityId}`) ?? null;
    },
  };

  return { db: db as unknown as PrismaClient, ...handle };
}

export type FakeDb = ReturnType<typeof createFakePrisma>;

export { emptySpecTable };
