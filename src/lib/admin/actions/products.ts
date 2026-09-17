'use server';

import { revalidatePublicCatalogue } from '@/lib/admin/revalidate';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { Prisma, type PrismaClient } from '@prisma/client';
import { getPrisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { getDbUnavailableState, requireAdminOrError } from '@/lib/admin/guard';
import {
  ADMIN_LOCALES,
  parseForm,
  parseLocaleFields,
  type AdminLocale,
} from '@/lib/admin/validation';
import { getContentLocaleLabel } from '@/lib/admin/labels';
import { getAdminMessagesForRequest, type AdminMessages } from '@/lib/admin/i18n';
import { CURRENCY_CODES, PRICE_MODES, normalizeCurrency } from '@/lib/pricing';
import { slugify } from '@/lib/slugify';
import { randomBytes } from 'node:crypto';
import type { FormState } from '@/lib/admin/action-state';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * 商品保存成功的统一提示。
 *
 * 用 `products.saved`（「已保存修改。」/「Changes saved.」）而不是通用的
 * `common.saveChanges`（那个字符串是按钮文案「保存修改」，当提示语读起来不像一句确认）。
 */
function savedMessage(t: AdminMessages): string {
  return t.products.saved;
}

// ---------------------------------------------------------------------------
// Local schemas (see the note in product-categories.ts)
// ---------------------------------------------------------------------------

function textField(max: number) {
  return z.preprocess(
    (value) => (typeof value === 'string' ? value : ''),
    z.string().trim().max(max),
  );
}

function slugField(t: AdminMessages) {
  return z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : ''),
    z
      .string()
      .min(1, t.validation.slugRequired)
      .max(120)
      .regex(SLUG_PATTERN, t.validation.slugFormat),
  );
}

function requiredIdField(t: AdminMessages) {
  return z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : ''),
    z.string().min(1, t.validation.invalidInput).max(200),
  );
}

function optionalIdField(max = 200) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined),
    z.string().max(max).optional(),
  );
}

/**
 * 新建商品时的字段。
 *
 * slug **不是必填**：它是「网址后缀」这种技术细节，不该成为普通运营建商品的门槛。
 * 留空时服务端会按商品名称自动生成一个（见 resolveCreateSlug），
 * 之后在「基本信息」里随时可以改。填了就必须符合格式，免得存进一个打不开的地址。
 */
function makeProductCreateSchema(t: AdminMessages) {
  return z.object({
    slug: z.preprocess(
      (value) => (typeof value === 'string' ? value.trim() : ''),
      z
        .string()
        .max(120)
        .refine((value) => value.length === 0 || SLUG_PATTERN.test(value), {
          message: t.validation.slugFormat,
        }),
    ),
    categoryId: optionalIdField(),
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  });
}

/**
 * 金额字段：只接受 `1234.56` 这样的十进制字面量（最多两位小数），
 * 转成 `Prisma.Decimal` 之后入库。
 *
 * 这里**绝不经过 `Number`**：`parseFloat` / `Number()` 会把金额变成 IEEE754 浮点数，
 * 0.1 + 0.2 那类误差会直接进入报价。空串与 null 统一归为「未填写」。
 */
function amountField(t: AdminMessages) {
  return z.preprocess(
    (value) => {
      if (typeof value !== 'string') return undefined;
      const text = value.trim().replace(/,/g, '');
      return text.length > 0 ? text : undefined;
    },
    z
      .string()
      .regex(/^\d{1,10}(\.\d{1,2})?$/, t.products.priceAmountInvalid)
      .transform((text) => new Prisma.Decimal(text))
      .optional(),
  );
}

/** 计价单位 / 起订单位：自由文本，长度受限，允许留空 */
function unitField(max = 40) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined),
    z.string().max(max).optional(),
  );
}

/**
 * 基本信息表单的字段。
 *
 * **刻意不含价格字段**：商品编辑器由多个独立表单组成，每个表单只提交自己那一段。
 * 如果基本信息表单也声明 priceMode，一次「保存基本信息」就会把价格模式重置为默认值 ——
 * 那是最典型的静默数据丢失，所以价格走独立的 saveProductPricingAction。
 */
function makeProductBaseSchema(t: AdminMessages) {
  return z.object({
    id: requiredIdField(t),
    slug: slugField(t),
    sku: textField(120),
    categoryId: optionalIdField(),
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
    featured: z.coerce.boolean().default(false),
    coverAssetId: textField(200),
    hoverVideoAssetId: textField(200),
  });
}

/** 价格与贸易信息表单的字段（与基本信息表单完全分离） */
function makeProductPricingSchema(t: AdminMessages) {
  return z.object({
    id: requiredIdField(t),
    priceMode: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() ? value.trim() : 'NEGOTIABLE'),
      z.enum(PRICE_MODES, { errorMap: () => ({ message: t.validation.invalidInput }) }),
    ),
    currency: z.preprocess(
      (value) => normalizeCurrency(typeof value === 'string' ? value : null),
      z.enum(CURRENCY_CODES, { errorMap: () => ({ message: t.validation.invalidInput }) }),
    ),
    priceMin: amountField(t),
    priceMax: amountField(t),
    priceUnit: unitField(),
    moq: z.preprocess(
      (value) => {
        if (typeof value !== 'string' || value.trim().length === 0) return undefined;
        const parsed = Number.parseInt(value.trim(), 10);
        return Number.isFinite(parsed) ? parsed : value;
      },
      z.number().int().min(0).max(100_000_000).optional(),
    ),
    moqUnit: unitField(),
  });
}

/**
 * 价格模式的跨字段校验（Zod 的对象级 refine 在这里用显式函数表达，
 * 便于把三种模式的差异写成一段可读的规则）。
 *
 * - NEGOTIABLE：不要求填写价格；已填的数字会被清空，避免前台展示与模式不一致
 * - FIXED：必须有 priceMin，且 priceMax 清空（固定价没有上限）
 * - RANGE：必须有 priceMin；填了 priceMax 时不得小于 priceMin
 */
function resolvePrice(
  values: {
    priceMode: 'NEGOTIABLE' | 'FIXED' | 'RANGE';
    priceMin?: Prisma.Decimal;
    priceMax?: Prisma.Decimal;
  },
  t: AdminMessages,
): { ok: true; priceMin: Prisma.Decimal | null; priceMax: Prisma.Decimal | null } | { ok: false; message: string } {
  if (values.priceMode === 'NEGOTIABLE') {
    return { ok: true, priceMin: null, priceMax: null };
  }

  if (!values.priceMin) return { ok: false, message: t.products.priceMinRequired };

  if (values.priceMode === 'FIXED') {
    return { ok: true, priceMin: values.priceMin, priceMax: null };
  }

  if (values.priceMax && values.priceMax.lessThan(values.priceMin)) {
    return { ok: false, message: t.products.priceRangeInvalid };
  }

  return { ok: true, priceMin: values.priceMin, priceMax: values.priceMax ?? null };
}

/**
 * 为新建商品决定一个可用的 slug。
 *
 * 优先级：管理员手填 → 英文名称 → 中文名称 → 越南语名称 → `product-<n>` 顺序号。
 * 名称里的中文/越南语经 slugify 后可能为空，所以最后一定有兜底，绝不会卡住建商品。
 * 结果再经过唯一化（`-2`、`-3`…），保证数据库的唯一约束不会在保存时才炸出来。
 */
async function resolveCreateSlug(
  db: PrismaClient,
  requested: string,
  names: { locale: AdminLocale; name: string }[],
): Promise<string> {
  const fromName =
    slugify(names.find((item) => item.locale === 'en')?.name ?? '') ||
    slugify(names.find((item) => item.locale === 'zh')?.name ?? '') ||
    slugify(names.find((item) => item.locale === 'vi')?.name ?? '');

  let candidate = requested || fromName;
  if (!candidate) {
    // 名称全是中日韩等非拉丁文字时用顺序号：可读、稳定，而且一眼能看出是自动生成的
    const total = await db.product.count();
    candidate = `product-${total + 1}`;
  }

  const taken = async (value: string) =>
    Boolean(await db.product.findUnique({ where: { slug: value }, select: { id: true } }));

  if (!(await taken(candidate))) return candidate;

  for (let suffix = 2; suffix <= 200; suffix += 1) {
    const next = `${candidate}-${suffix}`;
    if (!(await taken(next))) return next;
  }

  // 兜底：极端情况下用随机后缀，宁可地址难看也不能让新建失败
  return `${candidate}-${randomBytes(4).toString('hex')}`;
}

function makeNameSchema() {
  return z.object({ name: textField(200) });
}

function makeProductTranslationSchema() {
  return z.object({
    name: textField(200),
    shortDescription: textField(500),
    description: textField(10000),
    sizeSummary: textField(200),
    spec: textField(10000),
    application: textField(10000),
  });
}

function makeProductSeoSchema() {
  return z.object({
    seoTitle: textField(200),
    seoDescription: textField(400),
  });
}

function makeMediaSettingsSchema(t: AdminMessages) {
  return z.object({
    id: requiredIdField(t),
    coverAssetId: textField(200),
    hoverVideoAssetId: textField(200),
  });
}

/**
 * 价格与贸易信息保存：只写价格相关列，不触碰 slug / 分类 / 媒体。
 *
 * 三种价格模式的差异全部在 resolvePrice 里判定（面议不要求填价、固定价清空上限、
 * 区间校验 max >= min），金额在进入数据库前一直是 `Prisma.Decimal`，绝不经过 Number。
 */
export async function saveProductPricingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const parsed = parseForm(makeProductPricingSchema(t), formData, t);
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const price = resolvePrice(parsed.data, t);
  if (!price.ok) return { status: 'error', message: price.message };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const product = await db.product.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, slug: true },
    });
    if (!product) return { status: 'error', message: t.products.notFound };

    await db.product.update({
      where: { id: product.id },
      data: {
        priceMode: parsed.data.priceMode,
        currency: parsed.data.currency,
        priceMin: price.priceMin,
        priceMax: price.priceMax,
        priceUnit: parsed.data.priceUnit ?? null,
        moq: parsed.data.moq ?? null,
        moqUnit: parsed.data.moqUnit ?? null,
      },
    });

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'UPDATE',
      targetType: 'Product',
      targetId: product.id,
      summary: t.products.pricingSection,
      detail: {
        slug: product.slug,
        priceMode: parsed.data.priceMode,
        currency: parsed.data.currency,
        priceMin: price.priceMin?.toString() ?? null,
        priceMax: price.priceMax?.toString() ?? null,
      },
    });
  } catch (error) {
    console.error('[admin] save product pricing failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePublicCatalogue();
  return { status: 'success', message: savedMessage(t) };
}

/**
 * 媒体设置保存：只写封面与悬停视频两列，不触碰商品其它字段。
 *
 * 与「基本信息」表单共用同一套字段名，但语义独立 —— 在媒体页保存不会改动 slug / 价格。
 * 封面必须是 IMAGE、悬停视频必须是启用的 VIDEO，两个检查都在服务端重做。
 */
export async function saveProductMediaSettingsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const parsed = parseForm(makeMediaSettingsSchema(t), formData, t);
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  const coverAssetId = parsed.data.coverAssetId || null;
  const hoverVideoAssetId = parsed.data.hoverVideoAssetId || null;

  try {
    const product = await db.product.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, slug: true },
    });
    if (!product) return { status: 'error', message: t.products.notFound };

    const coverError = await checkImageAsset(db, coverAssetId ?? '', t);
    if (coverError) return coverError;

    const hoverError = await checkVideoAsset(db, hoverVideoAssetId ?? '', t);
    if (hoverError) return hoverError;

    await db.product.update({
      where: { id: parsed.data.id },
      data: { coverAssetId, hoverVideoAssetId },
    });

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'UPDATE',
      targetType: 'Product',
      targetId: parsed.data.id,
      summary: t.products.mediaSection,
      detail: { slug: product.slug, coverAssetId, hoverVideoAssetId },
    });
  } catch (error) {
    console.error('[admin] save product media settings failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePublicCatalogue();
  return { status: 'success', message: savedMessage(t) };
}

/** Ensures the given asset id exists and is an image; returns an error state when it is not. */
async function checkImageAsset(
  db: PrismaClient,
  assetId: string,
  t: AdminMessages,
): Promise<FormState | null> {
  if (!assetId) return null;
  const asset = await db.asset.findUnique({ where: { id: assetId }, select: { type: true } });
  if (!asset || asset.type !== 'IMAGE') {
    return { status: 'error', message: t.products.coverMustBeImage };
  }
  return null;
}

/**
 * Ensures the given asset id exists and really is a VIDEO.
 *
 * The type check is re-done on the server even though the picker only offers videos:
 * an asset id is just a string in a form body, so it can be swapped for an image id.
 *
 * 刻意**不要求 `enabled`**（与 checkImageAsset 一致）：素材可能在绑定之后被停用，
 * 那时若保存封面时连带校验悬停视频，就会出现「改封面保存不了、提示悬停视频必须是视频文件」
 * 这种与用户操作完全无关的报错，而且被停用的旧视频在媒体库里已经选不到、也清不掉。
 * 停用素材在前台由 catalog 层的 `enabled` 过滤负责隐藏，不需要在写入侧拦截。
 */
async function checkVideoAsset(
  db: PrismaClient,
  assetId: string,
  t: AdminMessages,
): Promise<FormState | null> {
  if (!assetId) return null;
  const asset = await db.asset.findUnique({ where: { id: assetId }, select: { type: true } });
  if (!asset || asset.type !== 'VIDEO') {
    return { status: 'error', message: t.products.hoverVideoMustBeVideo };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Product records
// ---------------------------------------------------------------------------

/** Creates a draft product from the "New product" screen and opens its editor. */
export async function createProductAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const base = parseForm(makeProductCreateSchema(t), formData, t);
  if (!base.ok) return { status: 'error', message: base.message };

  const nameSchema = makeNameSchema();
  const names: { locale: AdminLocale; name: string }[] = [];
  for (const locale of ADMIN_LOCALES) {
    const parsed = parseLocaleFields(nameSchema, locale, formData, t);
    if (!parsed.ok) return { status: 'error', message: parsed.message };
    if (parsed.data.name) names.push({ locale, name: parsed.data.name });
  }

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  let createdId: string;
  try {
    // 手填的 slug 已经过格式校验；留空则按下述规则自动生成，并保证唯一
    if (base.data.slug) {
      const slugOwner = await db.product.findUnique({
        where: { slug: base.data.slug },
        select: { id: true },
      });
      if (slugOwner) return { status: 'error', message: t.actions.slugTaken };
    }
    const slug = await resolveCreateSlug(db, base.data.slug, names);

    if (base.data.categoryId) {
      const category = await db.productCategory.findUnique({
        where: { id: base.data.categoryId },
        select: { id: true },
      });
      if (!category) return { status: 'error', message: t.validation.invalidInput };
    }

    const product = await db.product.create({
      data: {
        slug,
        categoryId: base.data.categoryId ?? null,
        sortOrder: base.data.sortOrder,
        published: false,
        translations: {
          create: names.map((item) => ({ locale: item.locale, name: item.name })),
        },
      },
    });
    createdId = product.id;

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'CREATE',
      targetType: 'Product',
      targetId: product.id,
      summary: t.products.newTitle,
      detail: { slug: product.slug },
    });
  } catch (error) {
    console.error('[admin] create product failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePublicCatalogue();
  redirect(`/admin/products/${createdId}`);
}

export async function saveProductBasicAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const base = parseForm(makeProductBaseSchema(t), formData, t);
  if (!base.ok) return { status: 'error', message: base.message };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  const coverAssetId = base.data.coverAssetId || null;
  const hoverVideoAssetId = base.data.hoverVideoAssetId || null;

  // 商品编辑器由多个独立表单组成（基本信息 / 价格 / 多语言 / 参数 / 媒体），
  // 每个表单只提交自己那一部分字段。因此封面与悬停视频**只有在该表单真的提交了
  // 对应字段时才更新** —— 否则在「基本信息」里点保存会把媒体页设置好的封面清空。
  const coverProvided = formData.has('coverAssetId');
  const hoverProvided = formData.has('hoverVideoAssetId');

  try {
    const product = await db.product.findUnique({
      where: { id: base.data.id },
      select: { id: true, slug: true },
    });
    if (!product) return { status: 'error', message: t.products.notFound };

    const slugOwner = await db.product.findUnique({
      where: { slug: base.data.slug },
      select: { id: true },
    });
    if (slugOwner && slugOwner.id !== base.data.id) {
      return { status: 'error', message: t.actions.slugTaken };
    }

    if (base.data.categoryId) {
      const category = await db.productCategory.findUnique({
        where: { id: base.data.categoryId },
        select: { id: true },
      });
      if (!category) return { status: 'error', message: t.validation.invalidInput };
    }

    if (coverProvided) {
      const coverError = await checkImageAsset(db, coverAssetId ?? '', t);
      if (coverError) return coverError;
    }

    if (hoverProvided) {
      const hoverError = await checkVideoAsset(db, hoverVideoAssetId ?? '', t);
      if (hoverError) return hoverError;
    }

    const patch: Prisma.ProductUncheckedUpdateInput = {
      slug: base.data.slug,
      sku: base.data.sku || null,
      categoryId: base.data.categoryId ?? null,
      sortOrder: base.data.sortOrder,
      featured: base.data.featured,
    };
    if (coverProvided) patch.coverAssetId = coverAssetId;
    if (hoverProvided) patch.hoverVideoAssetId = hoverVideoAssetId;

    await db.product.update({ where: { id: base.data.id }, data: patch });

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'UPDATE',
      targetType: 'Product',
      targetId: base.data.id,
      summary: t.products.editTitle,
      detail: { slug: base.data.slug, previousSlug: product.slug },
    });
  } catch (error) {
    console.error('[admin] save product failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePublicCatalogue();
  return { status: 'success', message: savedMessage(t) };
}

export async function saveProductTranslationsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const idSchema = z.object({ id: requiredIdField(t) });
  const base = parseForm(idSchema, formData, t);
  if (!base.ok) return { status: 'error', message: base.message };

  const translationSchema = makeProductTranslationSchema();
  const payloads: { locale: AdminLocale; data: z.infer<typeof translationSchema> }[] = [];
  for (const locale of ADMIN_LOCALES) {
    const parsed = parseLocaleFields(translationSchema, locale, formData, t);
    if (!parsed.ok) return { status: 'error', message: parsed.message };
    payloads.push({ locale, data: parsed.data });
  }

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const product = await db.product.findUnique({
      where: { id: base.data.id },
      select: { id: true, slug: true },
    });
    if (!product) return { status: 'error', message: t.products.notFound };

    // Validate every locale before writing anything, so a rejected locale leaves no partial save.
    for (const { locale, data } of payloads) {
      const filled = Boolean(
        data.name ||
          data.shortDescription ||
          data.description ||
          data.sizeSummary ||
          data.spec ||
          data.application,
      );
      if (filled && !data.name) {
        // A name is what makes a locale usable; refuse to store a row without one.
        return {
          status: 'error',
          message: `${getContentLocaleLabel(t, locale)}: ${t.validation.invalidInput}`,
        };
      }
    }

    for (const { locale, data } of payloads) {
      const existing = await db.productTranslation.findUnique({
        where: { productId_locale: { productId: product.id, locale } },
      });

      const filled = Boolean(
        data.name ||
          data.shortDescription ||
          data.description ||
          data.sizeSummary ||
          data.spec ||
          data.application,
      );

      if (!filled) {
        // A locale with nothing to say has no translation row — unless SEO copy still lives there.
        if (existing && !existing.seoTitle && !existing.seoDescription) {
          await db.productTranslation.delete({ where: { id: existing.id } });
        } else if (existing) {
          // name 是 NOT NULL：SEO 文案还在时这一行不能删，也就不能把名称清空。
          // 静默保留旧名称会让「编辑器里已清空、前台仍在显示」长期不一致，
          // 所以这里明确拒绝并给出可执行的下一步。
          return {
            status: 'error',
            message: `${getContentLocaleLabel(t, locale)}: ${t.products.nameCannotBeCleared}`,
          };
        }
        continue;
      }

      const values = {
        name: data.name,
        shortDescription: data.shortDescription || null,
        description: data.description || null,
        sizeSummary: data.sizeSummary || null,
        spec: data.spec || null,
        application: data.application || null,
      };

      await db.productTranslation.upsert({
        where: { productId_locale: { productId: product.id, locale } },
        update: values,
        create: { productId: product.id, locale, ...values },
      });
    }

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'UPDATE',
      targetType: 'Product',
      targetId: product.id,
      summary: t.products.translationsSection,
      detail: { slug: product.slug, locales: payloads.map((item) => item.locale) },
    });
  } catch (error) {
    console.error('[admin] save product translations failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePublicCatalogue();
  return { status: 'success', message: savedMessage(t) };
}

export async function saveProductSeoAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const idSchema = z.object({ id: requiredIdField(t) });
  const base = parseForm(idSchema, formData, t);
  if (!base.ok) return { status: 'error', message: base.message };

  const seoSchema = makeProductSeoSchema();
  const payloads: { locale: AdminLocale; data: z.infer<typeof seoSchema> }[] = [];
  for (const locale of ADMIN_LOCALES) {
    const parsed = parseLocaleFields(seoSchema, locale, formData, t);
    if (!parsed.ok) return { status: 'error', message: parsed.message };
    payloads.push({ locale, data: parsed.data });
  }

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const product = await db.product.findUnique({
      where: { id: base.data.id },
      select: { id: true, slug: true },
    });
    if (!product) return { status: 'error', message: t.products.notFound };

    // A translation row cannot exist without a name, and the product name lives in the
    // translations tab — validate before writing (the public catalogue would otherwise render an
    // empty product name for that locale).
    const existingLocales = new Set(
      (
        await db.productTranslation.findMany({
          where: { productId: product.id },
          select: { locale: true },
        })
      ).map((row) => row.locale),
    );

    for (const { locale, data } of payloads) {
      if (!existingLocales.has(locale) && (data.seoTitle || data.seoDescription)) {
        return {
          status: 'error',
          message: `${getContentLocaleLabel(t, locale)}: ${t.products.nameLabel}`,
        };
      }
    }

    for (const { locale, data } of payloads) {
      const values = {
        seoTitle: data.seoTitle || null,
        seoDescription: data.seoDescription || null,
      };
      const existing = await db.productTranslation.findUnique({
        where: { productId_locale: { productId: product.id, locale } },
        select: { id: true },
      });

      if (!existing) continue;

      await db.productTranslation.update({ where: { id: existing.id }, data: values });
    }

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'UPDATE',
      targetType: 'Product',
      targetId: product.id,
      summary: t.products.seoSection,
      detail: { slug: product.slug },
    });
  } catch (error) {
    console.error('[admin] save product seo failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePublicCatalogue();
  return { status: 'success', message: savedMessage(t) };
}

/**
 * Publishes or unpublishes a product.
 *
 * Publishing is gated: a valid slug, at least one language with a product name and a cover image
 * must all be present — otherwise the admin gets a list of exactly what is missing.
 */
export async function setProductPublishedAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const schema = z.object({
    id: requiredIdField(t),
    target: z.preprocess(
      (value) => (typeof value === 'string' ? value : ''),
      z.enum(['publish', 'draft'], { errorMap: () => ({ message: t.validation.invalidInput }) }),
    ),
  });
  const parsed = parseForm(schema, formData, t);
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const product = await db.product.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, slug: true, coverAssetId: true },
    });
    if (!product) return { status: 'error', message: t.products.notFound };

    const publish = parsed.data.target === 'publish';

    if (publish) {
      const reasons: string[] = [];

      if (!SLUG_PATTERN.test(product.slug)) reasons.push(t.products.validationSlug);

      const slugOwner = await db.product.findUnique({
        where: { slug: product.slug },
        select: { id: true },
      });
      if (slugOwner && slugOwner.id !== product.id) reasons.push(t.products.validationSlug);

      const named = await db.productTranslation.count({
        where: { productId: product.id, name: { not: '' } },
      });
      if (named === 0) reasons.push(t.products.validationName);

      if (!product.coverAssetId) reasons.push(t.products.validationCover);

      if (reasons.length > 0) {
        return {
          status: 'error',
          message: `${t.products.validationTitle}: ${reasons.join(' ')}`,
        };
      }
    }

    await db.product.update({
      where: { id: product.id },
      data: { published: publish },
    });

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: publish ? 'PUBLISH' : 'UNPUBLISH',
      targetType: 'Product',
      targetId: product.id,
      summary: publish ? t.products.publish : t.products.unpublish,
      detail: { slug: product.slug },
    });
  } catch (error) {
    console.error('[admin] set product status failed:', error);
    return { status: 'error', message: t.actions.operationFailed };
  }

  revalidatePublicCatalogue();
  return {
    status: 'success',
    message: parsed.data.target === 'publish' ? t.products.statusPublished : t.products.statusDraft,
  };
}

/** Copies the product, its translations, its gallery and its cover into a new draft. */
export async function duplicateProductAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const schema = z.object({ id: requiredIdField(t) });
  const parsed = parseForm(schema, formData, t);
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const source = await db.product.findUnique({
      where: { id: parsed.data.id },
      include: {
        translations: true,
        media: true,
        specifications: { include: { translations: true } },
      },
    });
    if (!source) return { status: 'error', message: t.products.notFound };

    let slug = `${source.slug}-copy`;
    let counter = 2;
    for (;;) {
      const taken = await db.product.findUnique({ where: { slug }, select: { id: true } });
      if (!taken) break;
      slug = `${source.slug}-copy-${counter}`;
      counter += 1;
      if (counter > 100) return { status: 'error', message: t.actions.saveFailed };
    }

    const copy = await db.product.create({
      data: {
        slug,
        sku: source.sku,
        categoryId: source.categoryId,
        coverAssetId: source.coverAssetId,
        hoverVideoAssetId: source.hoverVideoAssetId,
        featured: source.featured,
        published: false,
        sortOrder: source.sortOrder,
        priceMode: source.priceMode,
        currency: source.currency,
        priceMin: source.priceMin,
        priceMax: source.priceMax,
        priceUnit: source.priceUnit,
        moq: source.moq,
        moqUnit: source.moqUnit,
        translations: {
          create: source.translations.map((item) => ({
            locale: item.locale,
            name: item.name,
            shortDescription: item.shortDescription,
            description: item.description,
            sizeSummary: item.sizeSummary,
            spec: item.spec,
            application: item.application,
            seoTitle: item.seoTitle,
            seoDescription: item.seoDescription,
          })),
        },
        media: {
          create: source.media.map((item) => ({
            assetId: item.assetId,
            role: item.role,
            sortOrder: item.sortOrder,
          })),
        },
        // 结构化参数按原顺序复制（含全部语言）
        specifications: {
          create: source.specifications.map((spec) => ({
            sortOrder: spec.sortOrder,
            translations: {
              create: spec.translations.map((tr) => ({
                locale: tr.locale,
                name: tr.name,
                value: tr.value,
              })),
            },
          })),
        },
      },
    });

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'CREATE',
      targetType: 'Product',
      targetId: copy.id,
      summary: t.products.duplicated,
      detail: { duplicatedFrom: source.id, slug: copy.slug },
    });
  } catch (error) {
    console.error('[admin] duplicate product failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePublicCatalogue();
  return { status: 'success', message: t.products.duplicated };
}

/** Deletes a product (translations, media and cover bindings cascade) and returns to the list. */
export async function deleteProductAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const schema = z.object({ id: requiredIdField(t) });
  const parsed = parseForm(schema, formData, t);
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const product = await db.product.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, slug: true },
    });
    if (!product) return { status: 'error', message: t.products.notFound };

    await db.product.delete({ where: { id: product.id } });

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'DELETE',
      targetType: 'Product',
      targetId: product.id,
      summary: t.products.deleted,
      detail: { slug: product.slug },
    });
  } catch (error) {
    console.error('[admin] delete product failed:', error);
    return { status: 'error', message: t.actions.deleteFailed };
  }

  revalidatePublicCatalogue();
  redirect('/admin/products?deleted=1');
}

// ---------------------------------------------------------------------------
// Gallery (ProductMedia rows)
// ---------------------------------------------------------------------------

/**
 * 把素材挂到商品的图库上：图片 → GALLERY，视频 → VIDEO，接在现有顺序之后。
 *
 * 已被挂过的 (assetId, role) 组合会被跳过（数据库上是唯一约束），
 * 因此「重复点添加」「上传后重试」都不会产生重复行。
 * `found` 是确实存在且已启用的素材数量，供调用方区分「素材不存在」与「已经挂过」。
 */
async function attachAssets(
  db: PrismaClient,
  productId: string,
  assetIds: string[],
): Promise<{
  found: number;
  created: { assetId: string; role: 'GALLERY' | 'VIDEO'; sortOrder: number }[];
}> {
  const assets = await db.asset.findMany({
    where: { id: { in: assetIds }, enabled: true },
    select: { id: true, type: true },
  });
  if (assets.length === 0) return { found: 0, created: [] };

  const existing = await db.productMedia.findMany({
    where: { productId },
    select: { assetId: true, role: true, sortOrder: true },
  });
  const seen = new Set(existing.map((row) => `${row.assetId}:${row.role}`));
  let nextOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder + 1), 0);

  const creates: { productId: string; assetId: string; role: 'GALLERY' | 'VIDEO'; sortOrder: number }[] =
    [];
  for (const asset of assets) {
    const role: 'GALLERY' | 'VIDEO' = asset.type === 'VIDEO' ? 'VIDEO' : 'GALLERY';
    if (seen.has(`${asset.id}:${role}`)) continue;
    seen.add(`${asset.id}:${role}`);
    creates.push({ productId, assetId: asset.id, role, sortOrder: nextOrder });
    nextOrder += 1;
  }

  if (creates.length > 0) await db.productMedia.createMany({ data: creates });

  return {
    found: assets.length,
    created: creates.map((row) => ({ assetId: row.assetId, role: row.role, sortOrder: row.sortOrder })),
  };
}

/** Adds the picked library assets to the gallery: images as GALLERY, videos as VIDEO. */
export async function addProductMediaAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const schema = z.object({ productId: requiredIdField(t) });
  const base = parseForm(schema, formData, t);
  if (!base.ok) return { status: 'error', message: base.message };

  const assetIds = formData
    .getAll('assetIds')
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim());

  if (assetIds.length === 0) return { status: 'error', message: t.validation.invalidInput };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const product = await db.product.findUnique({
      where: { id: base.data.productId },
      select: { id: true, slug: true },
    });
    if (!product) return { status: 'error', message: t.products.notFound };

    const { found, created } = await attachAssets(db, product.id, assetIds);
    if (found === 0) return { status: 'error', message: t.validation.invalidInput };

    if (created.length > 0) {
      await writeAudit({
        userId: user.id,
        actorEmail: user.email,
        action: 'CREATE',
        targetType: 'Product',
        targetId: product.id,
        summary: t.products.galleryLabel,
        detail: { slug: product.slug, assetIds: created.map((row) => row.assetId) },
      });
    }
  } catch (error) {
    console.error('[admin] add product media failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePublicCatalogue();
  return { status: 'success', message: savedMessage(t) };
}

/** Swaps one gallery item with its neighbour and renumbers the whole list. */
export async function moveProductMediaAction(
  productId: string,
  mediaId: string,
  direction: 'up' | 'down',
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  const parsed = z
    .object({
      productId: z.string().min(1),
      mediaId: z.string().min(1),
      direction: z.enum(['up', 'down']),
    })
    .safeParse({ productId, mediaId, direction });
  if (!parsed.success) return { status: 'error', message: t.validation.invalidInput };

  try {
    const rows = await db.productMedia.findMany({
      where: { productId: parsed.data.productId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });

    const index = rows.findIndex((row) => row.id === parsed.data.mediaId);
    if (index === -1) return { status: 'error', message: t.validation.invalidInput };

    const target = parsed.data.direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= rows.length) return { status: 'success', message: savedMessage(t) };

    const next = [...rows];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);

    await db.$transaction(async (tx) => {
      for (let position = 0; position < next.length; position += 1) {
        await tx.productMedia.update({
          where: { id: next[position].id },
          data: { sortOrder: position },
        });
      }
    });

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'UPDATE',
      targetType: 'Product',
      targetId: parsed.data.productId,
      summary: t.products.galleryLabel,
      detail: { mediaId: parsed.data.mediaId, direction: parsed.data.direction },
    });
  } catch (error) {
    console.error('[admin] move product media failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePublicCatalogue();
  return { status: 'success', message: savedMessage(t) };
}

/** Persists an explicit drag-and-drop order; the id set must match the product's gallery exactly. */
export async function reorderProductMediaAction(
  productId: string,
  mediaIds: string[],
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  const parsed = z
    .object({
      productId: z.string().min(1),
      mediaIds: z.array(z.string().min(1)).min(1).max(500),
    })
    .safeParse({ productId, mediaIds });
  if (!parsed.success) return { status: 'error', message: t.validation.invalidInput };

  try {
    const rows = await db.productMedia.findMany({
      where: { productId: parsed.data.productId },
      select: { id: true },
    });

    const known = new Set(rows.map((row) => row.id));
    const submitted = new Set(parsed.data.mediaIds);
    if (
      rows.length !== parsed.data.mediaIds.length ||
      submitted.size !== parsed.data.mediaIds.length ||
      !parsed.data.mediaIds.every((id) => known.has(id))
    ) {
      return { status: 'error', message: t.validation.invalidInput };
    }

    await db.$transaction(async (tx) => {
      for (let position = 0; position < parsed.data.mediaIds.length; position += 1) {
        await tx.productMedia.update({
          where: { id: parsed.data.mediaIds[position] },
          data: { sortOrder: position },
        });
      }
    });

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'UPDATE',
      targetType: 'Product',
      targetId: parsed.data.productId,
      summary: t.products.galleryLabel,
      detail: { mediaIds: parsed.data.mediaIds },
    });
  } catch (error) {
    console.error('[admin] reorder product media failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePublicCatalogue();
  return { status: 'success', message: savedMessage(t) };
}

/** Removes one gallery row. The asset itself stays in the media library. */
export async function removeProductMediaAction(
  productId: string,
  mediaId: string,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  const parsed = z
    .object({ productId: z.string().min(1), mediaId: z.string().min(1) })
    .safeParse({ productId, mediaId });
  if (!parsed.success) return { status: 'error', message: t.validation.invalidInput };

  try {
    const row = await db.productMedia.findUnique({
      where: { id: parsed.data.mediaId },
      select: { id: true, productId: true, assetId: true },
    });
    if (!row || row.productId !== parsed.data.productId) {
      return { status: 'error', message: t.validation.invalidInput };
    }

    await db.productMedia.delete({ where: { id: row.id } });

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'DELETE',
      targetType: 'Product',
      targetId: parsed.data.productId,
      summary: t.products.removeFromGallery,
      detail: { mediaId: row.id, assetId: row.assetId },
    });
  } catch (error) {
    console.error('[admin] remove product media failed:', error);
    return { status: 'error', message: t.actions.deleteFailed };
  }

  revalidatePublicCatalogue();
  return { status: 'success', message: savedMessage(t) };
}

// ---------------------------------------------------------------------------
// 结构化参数（ProductSpecification）
// ---------------------------------------------------------------------------

/** 一行参数：id 为空表示新增；三种语言各自可留空 */
const specRowSchema = () =>
  z.object({
    id: z
      .preprocess(
        (value) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined),
        z.string().max(200).optional(),
      ),
    name: z.object({
      zh: textField(120),
      en: textField(120),
      vi: textField(120),
    }),
    value: z.object({
      zh: textField(300),
      en: textField(300),
      vi: textField(300),
    }),
  });

const specPayloadSchema = (t: AdminMessages) =>
  z.object({
    productId: requiredIdField(t),
    rows: z.array(specRowSchema()).max(60, t.products.specTooMany),
  });

/**
 * 表单版本：参数行是动态的，因此整表序列化成 JSON 放进一个隐藏字段。
 *
 * JSON 只是**传输方式**，不是信任边界 —— 解析后仍然走上面的 Zod 校验，
 * 行数上限、字段长度、语言枚举都由服务端重新检查。
 */
const specFormSchema = (t: AdminMessages) =>
  z.object({
    productId: requiredIdField(t),
    payload: z.string().max(200_000, t.products.specTooMany),
  });

type SpecTranslationDraft = { locale: AdminLocale; name: string; value: string | null };

/**
 * 保存整个参数表（顺序即 sortOrder）。
 *
 * 语义是「以提交内容为准」：新行创建、已有行更新、没提交的行删除。用 id 做差分而不是
 * 全删重建，这样未改动的行在数据库里保持稳定（审计与后续引用都不会出现无意义的抖动）。
 *
 * 校验规则：
 *   - 三种语言的名称与值都为空的行直接丢弃（用户点了「增加一条」却没填，不算错误）；
 *   - 只要某一行填了值却没有任何语言的名称，就整体拒绝并提示 —— 静默丢弃用户输入才是真问题。
 */
export async function saveProductSpecificationsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const form = parseForm(specFormSchema(t), formData, t);
  if (!form.ok) return { status: 'error', message: form.message };

  let rawRows: unknown[];
  try {
    const decoded: unknown = JSON.parse(form.data.payload);
    if (!Array.isArray(decoded)) return { status: 'error', message: t.validation.invalidInput };
    rawRows = decoded;
  } catch {
    return { status: 'error', message: t.validation.invalidInput };
  }

  // 形状体检：客户端与服务端的字段名一旦漂移，Zod 会把不认识的键安静地剥掉，
  // 结果是「保存成功但一行都没写」。这里把这种情况变成显式错误。
  if (
    rawRows.length > 0 &&
    !rawRows.some(
      (row) => row !== null && typeof row === 'object' && 'name' in (row as Record<string, unknown>),
    )
  ) {
    console.error('[admin] save product specifications: payload shape mismatch');
    return { status: 'error', message: t.validation.invalidInput };
  }

  const parsed = specPayloadSchema(t).safeParse({
    productId: form.data.productId,
    rows: rawRows,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { status: 'error', message: issue?.message ?? t.validation.invalidInput };
  }

  const normalized: { id?: string; translations: SpecTranslationDraft[] }[] = [];

  for (const row of parsed.data.rows) {
    const translations: SpecTranslationDraft[] = [];
    let hasAnyValue = false;

    for (const locale of ADMIN_LOCALES) {
      const name = row.name[locale].trim();
      const value = row.value[locale].trim();
      if (value) hasAnyValue = true;
      if (!name) continue;
      translations.push({ locale, name, value: value || null });
    }

    if (translations.length === 0) {
      // 整行空白：当作未填写，忽略；但填了值却没名称时明确报错，不静默丢数据
      if (hasAnyValue) return { status: 'error', message: t.products.specNameRequired };
      continue;
    }

    normalized.push({ id: row.id, translations });
  }

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const product = await db.product.findUnique({
      where: { id: parsed.data.productId },
      select: { id: true, slug: true },
    });
    if (!product) return { status: 'error', message: t.products.notFound };

    await db.$transaction(async (tx) => {
      const existing = await tx.productSpecification.findMany({
        where: { productId: product.id },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((row) => row.id));
      const kept = new Set<string>();

      for (let index = 0; index < normalized.length; index += 1) {
        const row = normalized[index];

        if (row.id && existingIds.has(row.id)) {
          kept.add(row.id);
          await tx.productSpecification.update({
            where: { id: row.id },
            data: { sortOrder: index },
          });
          // 语言行先清后建：这样删掉某种语言的名称后不会留下孤立的旧值
          await tx.productSpecificationTranslation.deleteMany({
            where: { specificationId: row.id },
          });
          await tx.productSpecificationTranslation.createMany({
            data: row.translations.map((tr) => ({
              specificationId: row.id as string,
              locale: tr.locale,
              name: tr.name,
              value: tr.value,
            })),
          });
          continue;
        }

        const created = await tx.productSpecification.create({
          data: {
            productId: product.id,
            sortOrder: index,
            translations: {
              create: row.translations.map((tr) => ({
                locale: tr.locale,
                name: tr.name,
                value: tr.value,
              })),
            },
          },
          select: { id: true },
        });
        kept.add(created.id);
      }

      const stale = existing.filter((row) => !kept.has(row.id)).map((row) => row.id);
      if (stale.length > 0) {
        await tx.productSpecification.deleteMany({ where: { id: { in: stale } } });
      }
    });

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'UPDATE',
      targetType: 'Product',
      targetId: product.id,
      summary: t.products.specsSection,
      detail: { slug: product.slug, count: normalized.length },
    });
  } catch (error) {
    console.error('[admin] save product specifications failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePublicCatalogue();
  return { status: 'success', message: savedMessage(t) };
}

// ---------------------------------------------------------------------------
// 把图库里的素材指定为封面 / 悬停视频
// ---------------------------------------------------------------------------

const assetRoleSchema = z.object({
  productId: z.string().trim().min(1),
  assetId: z.string().trim().min(1).max(200),
  role: z.enum(['cover', 'hover']),
});

/**
 * 在图库里直接指定「产品封面」或「列表悬停视频」。
 *
 * 悬停视频必须引用 VIDEO 类型素材 —— 这条规则同时写在数据模型注释、服务端校验与
 * 媒体库删除时的引用检查里，保证不会出现「图片当视频」或删除视频后卡片静默失效。
 */
export async function setProductAssetRoleAction(input: {
  productId: string;
  assetId: string;
  role: 'cover' | 'hover';
}): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const parsed = assetRoleSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: t.validation.invalidInput };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const product = await db.product.findUnique({
      where: { id: parsed.data.productId },
      select: { id: true, slug: true },
    });
    if (!product) return { status: 'error', message: t.products.notFound };

    if (parsed.data.role === 'cover') {
      const error = await checkImageAsset(db, parsed.data.assetId, t);
      if (error) return error;

      await db.product.update({
        where: { id: product.id },
        data: { coverAssetId: parsed.data.assetId },
      });
    } else {
      const error = await checkVideoAsset(db, parsed.data.assetId, t);
      if (error) return error;

      await db.product.update({
        where: { id: product.id },
        data: { hoverVideoAssetId: parsed.data.assetId },
      });
    }

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'UPDATE',
      targetType: 'Product',
      targetId: product.id,
      summary: parsed.data.role === 'cover' ? t.products.coverLabel : t.products.hoverVideoLabel,
      detail: { slug: product.slug, assetId: parsed.data.assetId },
    });
  } catch (error) {
    console.error('[admin] set product asset role failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePublicCatalogue();
  return { status: 'success', message: savedMessage(t) };
}

// ---------------------------------------------------------------------------
// 直接上传后立即绑定
// ---------------------------------------------------------------------------

const attachSchema = z.object({
  productId: z.string().trim().min(1),
  assetIds: z.array(z.string().trim().min(1).max(200)).min(1).max(100),
});

/**
 * 把刚上传完成的素材立即挂到当前商品。
 *
 * 上传走 `POST /api/admin/media/upload`（原始字节流 + magic bytes 校验 + 体积极限），
 * 该接口只创建 Asset；「绑定到哪个商品」这一步由本 action 完成，两者都要求管理员会话，
 * 并且这里会重新校验素材确实存在且已启用 —— 客户端传什么都不能越权。
 */
export async function attachUploadedAssetsAction(input: {
  productId: string;
  assetIds: string[];
}): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const parsed = attachSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: t.validation.invalidInput };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const product = await db.product.findUnique({
      where: { id: parsed.data.productId },
      select: { id: true, slug: true },
    });
    if (!product) return { status: 'error', message: t.products.notFound };

    const { found, created } = await attachAssets(db, product.id, parsed.data.assetIds);
    if (found === 0) return { status: 'error', message: t.products.uploadBindFailed };

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'CREATE',
      targetType: 'Product',
      targetId: product.id,
      summary: t.products.galleryLabel,
      detail: { slug: product.slug, assetIds: created.map((row) => row.assetId), source: 'upload' },
    });
  } catch (error) {
    console.error('[admin] attach uploaded assets failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePublicCatalogue();
  return { status: 'success', message: savedMessage(t) };
}
