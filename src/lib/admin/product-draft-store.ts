import { Prisma, type PrismaClient } from '@prisma/client';
import { ADMIN_LOCALES } from '@/lib/admin/validation';
import { decimalToString, normalizeCurrency } from '@/lib/pricing';
import { readDraft, type ProductDraft, type ProductMediaRoleValue } from '@/lib/product-draft';

/**
 * 草稿与版本的数据访问层。
 *
 * 所有写商品的动作都经由这里：读「线上内容」与「正在编辑的草稿」，把某几片写回草稿，
 * 以及发布时把整份草稿落进关系表。放在一处是为了让「线上内容长什么样」只有一份定义 ——
 * 任何地方手工拼一遍，都会在字段增删时静默漏掉一个。
 */

/** 发布/存档后每个商品最多保留的历史版本数 */
export const MAX_PRODUCT_VERSIONS = 3;

/**
 * 发布事务的超时设置。
 *
 * Prisma 的交互式事务默认只给 5 秒。发布要按顺序写商品列、三语翻译、参数、
 * 图库和版本，在跨网络的数据库上（本地开发走 SSH 隧道连生产库）很容易顶穿，
 * 报出来的是「Transaction already closed」，看起来像内容有问题，其实只是超时。
 * 放大到 20 秒，并且把等待连接的时间也放宽 —— 默认 2 秒在并发时会误伤。
 */
export const DRAFT_TRANSACTION_OPTIONS = { timeout: 20_000, maxWait: 10_000 } as const;

export interface ProductDraftState {
  /** 线上内容（前台正在展示的） */
  live: ProductDraft;
  /** 正在编辑的内容：有草稿就是草稿，没有就是线上内容本身 */
  draft: ProductDraft;
  /** 是否存在尚未发布的改动 */
  hasDraft: boolean;
  /** 商品当前是否已上架 */
  published: boolean;
  /** 草稿最后一次写入的时间 */
  draftUpdatedAt: Date | null;
}

const DRAFT_INCLUDE = {
  translations: true,
  specifications: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { translations: true },
  },
  media: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  },
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof DRAFT_INCLUDE }>;

/** 把关系行摊平成草稿形状。金额一律走 `decimalToString`，绝不让 Decimal 变浮点。 */
function toDraft(row: ProductWithRelations): ProductDraft {
  const translations = {} as ProductDraft['translations'];
  for (const locale of ADMIN_LOCALES) {
    const tr = row.translations.find((item) => item.locale === locale);
    translations[locale] = {
      name: tr?.name ?? '',
      shortDescription: tr?.shortDescription ?? '',
      description: tr?.description ?? '',
      sizeSummary: tr?.sizeSummary ?? '',
      spec: tr?.spec ?? '',
      application: tr?.application ?? '',
      seoTitle: tr?.seoTitle ?? '',
      seoDescription: tr?.seoDescription ?? '',
    };
  }

  return {
    basic: {
      slug: row.slug,
      sku: row.sku ?? '',
      categoryId: row.categoryId,
      featured: row.featured,
      sortOrder: row.sortOrder,
      coverAssetId: row.coverAssetId,
      hoverVideoAssetId: row.hoverVideoAssetId,
    },
    pricing: {
      priceMode: row.priceMode,
      currency: normalizeCurrency(row.currency),
      priceMin: decimalToString(row.priceMin),
      priceMax: decimalToString(row.priceMax),
      priceUnit: row.priceUnit,
      moq: row.moq,
      moqUnit: row.moqUnit,
    },
    translations,
    specs: row.specifications.map((spec) => {
      const values = {} as ProductDraft['specs'][number]['values'];
      for (const locale of ADMIN_LOCALES) {
        const tr = spec.translations.find((item) => item.locale === locale);
        values[locale] = { name: tr?.name ?? '', value: tr?.value ?? '' };
      }
      return { id: spec.id, values };
    }),
    media: row.media.map((item) => ({ assetId: item.assetId, role: item.role })),
  };
}

/**
 * 读取一个商品的「线上内容 + 正在编辑的草稿」。
 *
 * `hasDraft` 是所有「有未发布改动」提示的唯一依据：发布后草稿会被清空，
 * 所以「draftData 非空」与「有待发布的改动」是同一件事，不需要另算一次 diff。
 */
export async function loadProductDraftState(
  db: PrismaClient | Prisma.TransactionClient,
  productId: string,
): Promise<ProductDraftState | null> {
  const row = await db.product.findUnique({ where: { id: productId }, include: DRAFT_INCLUDE });
  if (!row) return null;

  const live = toDraft(row);
  const stored = readDraft(row.draftData);
  return {
    live,
    draft: stored ?? live,
    hasDraft: stored !== null,
    published: row.published,
    draftUpdatedAt: row.draftUpdatedAt,
  };
}

/**
 * 把草稿的某几片合并写回 `draftData`。
 *
 * 传进来的永远是**完整的草稿**（调用方从 `loadProductDraftState` 拿到、改掉自己那一片），
 * 所以这里不需要「字段有没有出现」这类判断 —— 每个分区只写自己那一片，
 * 不可能像以前那样把别的分区的值清空。
 */
export async function saveDraft(
  db: PrismaClient,
  productId: string,
  draft: ProductDraft,
): Promise<void> {
  await db.product.update({
    where: { id: productId },
    data: {
      draftData: draft as unknown as Prisma.InputJsonValue,
      draftUpdatedAt: new Date(),
    },
  });
}

/** 丢弃草稿（发布后调用），商品回到「没有待发布改动」的状态 */
export async function clearDraft(
  db: PrismaClient | Prisma.TransactionClient,
  productId: string,
): Promise<void> {
  await db.product.update({
    where: { id: productId },
    data: { draftData: Prisma.DbNull, draftUpdatedAt: null },
  });
}

// ---------------------------------------------------------------------------
// 发布：把草稿落进关系表
// ---------------------------------------------------------------------------

/**
 * 把一份草稿完整写进线上内容（关系表）。
 *
 * 必须在事务里调用：发布要么整体生效，要么完全不动 —— 半套内容上线比不发布更糟。
 *
 * 结构化参数与图库采用「按 id 复用、缺失即删」的调和方式，而不是全删全建：
 * 全删全建会让 `ProductSpecification` 的主键每次都变，既浪费又让审计日志失去连续性。
 */
export async function applyDraftToLive(
  tx: Prisma.TransactionClient,
  productId: string,
  draft: ProductDraft,
  price: { priceMin: string | null; priceMax: string | null },
): Promise<void> {
  await tx.product.update({
    where: { id: productId },
    data: {
      slug: draft.basic.slug,
      sku: draft.basic.sku || null,
      categoryId: draft.basic.categoryId,
      featured: draft.basic.featured,
      sortOrder: draft.basic.sortOrder,
      coverAssetId: draft.basic.coverAssetId,
      hoverVideoAssetId: draft.basic.hoverVideoAssetId,
      priceMode: draft.pricing.priceMode,
      currency: draft.pricing.currency,
      priceMin: price.priceMin === null ? null : new Prisma.Decimal(price.priceMin),
      priceMax: price.priceMax === null ? null : new Prisma.Decimal(price.priceMax),
      priceUnit: draft.pricing.priceUnit,
      moq: draft.pricing.moq,
      moqUnit: draft.pricing.moqUnit,
    },
  });

  // 三语内容。
  //
  // **只有真正有内容的语言才建行。** 某种语言什么都没填时若也写一行空名称，
  // 前台在该语言下会选中这一行、渲染出一个空商品名，而不是按设计回退到英文 ——
  // 所以「名称与正文、SEO 全空」的语言直接删掉该行（与改造前 saveProductTranslations 一致）。
  for (const locale of ADMIN_LOCALES) {
    const values = draft.translations[locale];
    const data = {
      name: values.name,
      shortDescription: values.shortDescription || null,
      description: values.description || null,
      sizeSummary: values.sizeSummary || null,
      spec: values.spec || null,
      application: values.application || null,
      seoTitle: values.seoTitle || null,
      seoDescription: values.seoDescription || null,
    };

    const hasAnything = Object.values(data).some(
      (value) => typeof value === 'string' && value.trim().length > 0,
    );
    if (!hasAnything) {
      await tx.productTranslation.deleteMany({ where: { productId, locale } });
      continue;
    }

    await tx.productTranslation.upsert({
      where: { productId_locale: { productId, locale } },
      create: { productId, locale, ...data },
      update: data,
    });
  }

  // 结构化参数
  //
  // 主键尽量复用：全删全建会让每次发布的 id 都变，审计与后续引用失去连续性。
  const existingSpecs = await tx.productSpecification.findMany({
    where: { productId },
    select: { id: true },
  });
  const existingSpecIds = new Set(existingSpecs.map((row) => row.id));
  const keptSpecIds: string[] = [];

  for (const [index, spec] of draft.specs.entries()) {
    const reusable = spec.id !== null && existingSpecIds.has(spec.id);
    const specId = reusable
      ? spec.id!
      : (
          await tx.productSpecification.create({
            data: { productId, sortOrder: index },
            select: { id: true },
          })
        ).id;
    keptSpecIds.push(specId);
    if (reusable) {
      await tx.productSpecification.update({ where: { id: specId }, data: { sortOrder: index } });
    }
  }

  // 参数的多语言内容**成批**写回，而不是每行每语言各来一次 upsert。
  // 语言行没有任何东西引用，主键不需要稳定，所以先清后建最省往返 ——
  // 逐条 upsert 是 3N 次查询，跨网络时很容易把事务顶过超时。
  if (keptSpecIds.length > 0) {
    await tx.productSpecificationTranslation.deleteMany({
      where: { specificationId: { in: keptSpecIds } },
    });

    const translationRows = draft.specs.flatMap((spec, index) =>
      ADMIN_LOCALES.map((locale) => ({
        specificationId: keptSpecIds[index],
        locale,
        name: spec.values[locale].name.trim(),
        value: spec.values[locale].value.trim() || null,
      })).filter((row) => row.name.length > 0),
    );
    if (translationRows.length > 0) {
      await tx.productSpecificationTranslation.createMany({ data: translationRows });
    }
  }

  // 草稿里没有的旧参数行删掉（草稿为空时就把该商品的参数清空）
  if (keptSpecIds.length > 0) {
    await tx.productSpecification.deleteMany({
      where: { productId, id: { notIn: keptSpecIds } },
    });
  } else {
    await tx.productSpecification.deleteMany({ where: { productId } });
  }

  // 图库：顺序即数组顺序，整体重建（行本身没有需要保留的额外字段）
  await tx.productMedia.deleteMany({ where: { productId } });
  if (draft.media.length > 0) {
    const assetIds = [...new Set(draft.media.map((item) => item.assetId))];
    const assets = await tx.asset.findMany({
      where: { id: { in: assetIds } },
      select: { id: true, type: true },
    });
    const typeById = new Map(assets.map((asset) => [asset.id, asset.type]));

    const rows = draft.media
      .filter((item) => typeById.has(item.assetId))
      .map((item, index) => ({
        productId,
        assetId: item.assetId,
        // 用途由素材类型决定，与编辑器里「加素材」时一致，不接受前端传值
        role: (typeById.get(item.assetId) === 'VIDEO' ? 'VIDEO' : 'GALLERY') as ProductMediaRoleValue,
        sortOrder: index,
      }));
    if (rows.length > 0) await tx.productMedia.createMany({ data: rows });
  }
}

// ---------------------------------------------------------------------------
// 版本
// ---------------------------------------------------------------------------

/** 写入一个版本快照，并把该商品的历史版本裁到 MAX_PRODUCT_VERSIONS 个 */
export async function recordVersion(
  tx: Prisma.TransactionClient,
  input: {
    productId: string;
    kind: 'PUBLISHED' | 'MANUAL';
    snapshot: ProductDraft;
    userId: string | null;
    note?: string | null;
  },
): Promise<void> {
  await tx.productVersion.create({
    data: {
      productId: input.productId,
      kind: input.kind,
      snapshot: input.snapshot as unknown as Prisma.InputJsonValue,
      createdById: input.userId,
      note: input.note?.trim() || null,
    },
  });

  // 「最多三个版本」：留最近三版，其余删掉。线上内容本身不占名额。
  const keep = await tx.productVersion.findMany({
    where: { productId: input.productId },
    orderBy: { createdAt: 'desc' },
    take: MAX_PRODUCT_VERSIONS,
    select: { id: true },
  });
  await tx.productVersion.deleteMany({
    where: { productId: input.productId, id: { notIn: keep.map((row) => row.id) } },
  });
}
