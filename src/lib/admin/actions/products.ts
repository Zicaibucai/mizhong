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
import { getAdminMessagesForRequest, formatMessage, type AdminMessages } from '@/lib/admin/i18n';
import {
  describeSyncFailure,
  runPublishSync,
  toProgress,
  type PublishSyncOutcome,
} from '@/lib/admin/publish-sync';
import { classifyPublishFailure } from '@/lib/admin/emergency-publish';
import { finishProductPublish } from '@/lib/admin/finish-publish';
import { CURRENCY_CODES, PRICE_MODES, decimalToString, normalizeCurrency } from '@/lib/pricing';
import {
  DRAFT_TRANSACTION_OPTIONS,
  loadProductDraftState,
  recordVersion,
  saveDraft,
} from '@/lib/admin/product-draft-store';
import { invalidateTranslationState } from '@/lib/translation/state';
import {
  draftMediaRoleFor,
  readDraft,
  specTableFromLegacySpecs,
  validateForPublish,
  type ProductDraft,
  type ProductDraftSpec,
  type ProductDraftSpecTable,
  type ProductDraftVariantGroup,
} from '@/lib/product-draft';
import type { FormState } from '@/lib/admin/action-state';
import { localizedRecord } from '@/lib/i18n/localized';
import { SLUG_PATTERN, slugify, uniqueSlug } from '@/lib/slug';

/**
 * 自动保存的提示。
 *
 * 与手动保存刻意区分开：自动保存每几秒就可能发生一次，如果每次都冒出「已保存修改。」，
 * 页面上会不停闪提示。顶部状态条已经用「保存中… / 已保存」表达了同一件事，
 * 所以成功时不给消息，失败时照常给（失败必须被看见）。
 */
function autosavedMessage(): FormState {
  return { status: 'success', message: undefined };
}

/**
 * 读出商品的**正在编辑内容**：有草稿就是草稿，没有就是线上内容本身。
 *
 * 所有保存动作只认这一份。于是「从没发布过」「改了还没发布」走的是同一条代码路径，
 * 不需要在每个动作里判断「现在到底在编辑哪一份」。
 */
async function loadWorkingDraft(
  db: PrismaClient,
  productId: string,
  t: AdminMessages,
): Promise<{ ok: true; draft: ProductDraft; live: ProductDraft } | { ok: false; error: FormState }> {
  const state = await loadProductDraftState(db, productId);
  if (!state) return { ok: false, error: { status: 'error', message: t.products.notFound } };
  return { ok: true, draft: state.draft, live: state.live };
}

/** 把草稿存回 draftData 并记一条审计。成功时不给提示文案（见 autosavedMessage）。 */
async function persistDraft(
  db: PrismaClient,
  input: {
    productId: string;
    draft: ProductDraft;
    user: { id: string; email: string };
    summary: string;
    t: AdminMessages;
    detail?: Record<string, unknown>;
  },
): Promise<FormState> {
  await saveDraft(db, input.productId, input.draft);
  await writeAudit({
    userId: input.user.id,
    actorEmail: input.user.email,
    action: 'UPDATE',
    targetType: 'Product',
    targetId: input.productId,
    summary: input.summary,
    detail: { ...input.detail, draft: true },
  });
  // 草稿不进前台，因此**不**调用 revalidatePublicCatalogue —— 客人看到的东西一个字节都没变
  return autosavedMessage();
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
 * 价格与贸易信息：整片替换草稿里的 `pricing`，不碰其它分区。
 *
 * 进入数据库前金额一直是 `Prisma.Decimal`，写进草稿时才转成字符串
 * （客户端不做金额运算，也不会遇到浮点精度问题）。
 *
 * 三种价格模式的差异（面议清空价格、固定价清空上限、区间价校验上下限）
 * **推迟到发布时**由 `resolveDraftPrice` 与 `validateForPublish` 判定 ——
 * 编辑到一半的草稿必须存得下去。
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

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const loaded = await loadWorkingDraft(db, parsed.data.id, t);
    if (!loaded.ok) return loaded.error;

    const draft: ProductDraft = {
      ...loaded.draft,
      pricing: {
        priceMode: parsed.data.priceMode,
        currency: parsed.data.currency,
        priceMin: decimalToString(parsed.data.priceMin),
        priceMax: decimalToString(parsed.data.priceMax),
        priceUnit: parsed.data.priceUnit ?? null,
        moq: parsed.data.moq ?? null,
        moqUnit: parsed.data.moqUnit ?? null,
      },
    };

    return await persistDraft(db, {
      productId: parsed.data.id,
      draft,
      user,
      summary: t.products.pricingSection,
      t,
    });
  } catch (error) {
    console.error('[admin] save product pricing failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }
}

/**
 * 媒体设置：只改草稿里的封面与悬停视频两个字段，不触碰其它内容。
 *
 * 封面必须是 IMAGE、悬停视频必须是启用的 VIDEO，两个检查都在服务端重做 ——
 * 素材 id 在表单里只是一个字符串，可以被换成任意值。
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
    const coverError = await checkImageAsset(db, coverAssetId ?? '', t);
    if (coverError) return coverError;

    const hoverError = await checkVideoAsset(db, hoverVideoAssetId ?? '', t);
    if (hoverError) return hoverError;

    const loaded = await loadWorkingDraft(db, parsed.data.id, t);
    if (!loaded.ok) return loaded.error;

    const draft: ProductDraft = {
      ...loaded.draft,
      basic: { ...loaded.draft.basic, coverAssetId, hoverVideoAssetId },
    };

    return await persistDraft(db, {
      productId: parsed.data.id,
      draft,
      user,
      summary: t.products.mediaSection,
      t,
    });
  } catch (error) {
    console.error('[admin] save product media settings failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }
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

  // 商品编辑器由多个独立表单组成，每个表单只提交自己那一段。
  // 因此封面与悬停视频**只有在该表单真的提交了对应字段时才更新** ——
  // 否则在「基本信息」里改动一下就会把媒体页设置好的封面清掉。
  const coverProvided = formData.has('coverAssetId');
  const hoverProvided = formData.has('hoverVideoAssetId');

  try {
    const loaded = await loadWorkingDraft(db, base.data.id, t);
    if (!loaded.ok) return loaded.error;

    const slugOwner = await db.product.findFirst({
      where: { slug: base.data.slug, id: { not: base.data.id } },
      select: { id: true },
    });
    if (slugOwner) return { status: 'error', message: t.actions.slugTaken };

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

    const draft: ProductDraft = {
      ...loaded.draft,
      basic: {
        slug: base.data.slug,
        sku: base.data.sku,
        categoryId: base.data.categoryId ?? null,
        featured: base.data.featured,
        sortOrder: base.data.sortOrder,
        coverAssetId: coverProvided ? coverAssetId : loaded.draft.basic.coverAssetId,
        hoverVideoAssetId: hoverProvided
          ? hoverVideoAssetId
          : loaded.draft.basic.hoverVideoAssetId,
      },
    };

    return await persistDraft(db, {
      productId: base.data.id,
      draft,
      user,
      summary: t.products.editTitle,
      t,
      detail: { slug: base.data.slug, previousSlug: loaded.live.basic.slug },
    });
  } catch (error) {
    console.error('[admin] save product failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }
}

/**
 * Save the customer-shaped product editor in one request.
 *
 * The visual surface deliberately puts name, price, trade details and the publish settings
 * together. Keeping one action for those fields prevents a quick edit in the lower details
 * section from racing a name/price autosave and overwriting the other half of the draft.
 * Media attachments and structured specifications still use their dedicated actions because
 * both have their own collection semantics.
 */
export async function saveProductVisualAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const base = parseForm(makeProductBaseSchema(t), formData, t);
  if (!base.ok) return { status: 'error', message: base.message };

  const pricing = parseForm(makeProductPricingSchema(t), formData, t);
  if (!pricing.ok) return { status: 'error', message: pricing.message };

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
    const loaded = await loadWorkingDraft(db, base.data.id, t);
    if (!loaded.ok) return loaded.error;

    const slugOwner = await db.product.findFirst({
      where: { slug: base.data.slug, id: { not: base.data.id } },
      select: { id: true },
    });
    if (slugOwner) return { status: 'error', message: t.actions.slugTaken };

    if (base.data.categoryId) {
      const category = await db.productCategory.findUnique({
        where: { id: base.data.categoryId },
        select: { id: true },
      });
      if (!category) return { status: 'error', message: t.validation.invalidInput };
    }

    const translations = { ...loaded.draft.translations };
    for (const { locale, data } of payloads) {
      translations[locale] = {
        ...translations[locale],
        name: data.name,
        shortDescription: data.shortDescription,
        description: data.description,
        sizeSummary: data.sizeSummary,
        spec: data.spec,
        application: data.application,
      };
    }

    const draft: ProductDraft = {
      ...loaded.draft,
      basic: {
        ...loaded.draft.basic,
        slug: base.data.slug,
        sku: base.data.sku,
        categoryId: base.data.categoryId ?? null,
        featured: base.data.featured,
        sortOrder: base.data.sortOrder,
      },
      pricing: {
        priceMode: pricing.data.priceMode,
        currency: pricing.data.currency,
        priceMin: decimalToString(pricing.data.priceMin),
        priceMax: decimalToString(pricing.data.priceMax),
        priceUnit: pricing.data.priceUnit ?? null,
        moq: pricing.data.moq ?? null,
        moqUnit: pricing.data.moqUnit ?? null,
      },
      translations,
    };

    return await persistDraft(db, {
      productId: base.data.id,
      draft,
      user,
      summary: t.products.visualTitle,
      t,
      detail: { slug: base.data.slug, locales: payloads.map((item) => item.locale) },
    });
  } catch (error) {
    console.error('[admin] save visual product failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }
}

/**
 * 三语内容：整片写进草稿的 `translations`，只覆盖这六个正文字段。
 *
 * SEO 的两个字段与前台的名称共用同一份翻译对象，所以这里**逐个字段赋值**而不是
 * 整体替换 —— 否则在「多语言」页保存会把「SEO」页填好的标题描述清空。
 *
 * 「某种语言填了内容却没有名称」这类规则**推迟到发布时**再判：编辑到一半必须存得下去。
 */
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
    const loaded = await loadWorkingDraft(db, base.data.id, t);
    if (!loaded.ok) return loaded.error;

    const translations = { ...loaded.draft.translations };
    for (const { locale, data } of payloads) {
      translations[locale] = {
        // seoTitle / seoDescription 由「SEO」分区负责，这里原样保留
        ...translations[locale],
        name: data.name,
        shortDescription: data.shortDescription,
        description: data.description,
        sizeSummary: data.sizeSummary,
        spec: data.spec,
        application: data.application,
      };
    }

    return await persistDraft(db, {
      productId: base.data.id,
      draft: { ...loaded.draft, translations },
      user,
      summary: t.products.translationsSection,
      t,
      detail: { locales: payloads.map((item) => item.locale) },
    });
  } catch (error) {
    console.error('[admin] save product translations failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }
}

/** SEO 文案：同样只覆盖草稿翻译对象里的两个字段，不碰名称与正文。 */
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
    const loaded = await loadWorkingDraft(db, base.data.id, t);
    if (!loaded.ok) return loaded.error;

    const translations = { ...loaded.draft.translations };
    for (const { locale, data } of payloads) {
      translations[locale] = {
        ...translations[locale],
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
      };
    }

    return await persistDraft(db, {
      productId: base.data.id,
      draft: { ...loaded.draft, translations },
      user,
      summary: t.products.seoSection,
      t,
    });
  } catch (error) {
    console.error('[admin] save product seo failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }
}

/**
 * 发布 / 取消发布。
 *
 * **发布是整个系统里唯一一处写线上内容的地方。** 编辑器平时只把改动存进草稿，
 * 客人看到的东西一个字节都不会变；只有走到这里，草稿才被落进关系表。
 *
 * 因此这里的校验也是最严的一关（规则与改造前完全一致）：slug 合法且未被占用、
 * 至少一种语言有名称、必须有封面、区间价上限不得小于下限。草稿可以是不完整的，
 * 发布不行。发布成功后写入一条 PUBLISHED 版本并清空草稿 —— 清空之后
 * 「有没有待发布的改动」就等价于「draftData 是不是空的」，不需要另算 diff。
 *
 * 取消发布只翻标志位，不动草稿：草稿是你还没发布的编辑内容，与上不上架无关。
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

  const publish = parsed.data.target === 'publish';

  /**
   * 本次发布跑过的同步结果。`null` 表示还没跑（取消发布时永远不会跑）——
   * 发布记录里的中文版本号与任务 id 都取自它。
   */
  let publishOutcome: PublishSyncOutcome | null = null;

  try {
    const loaded = await loadWorkingDraft(db, parsed.data.id, t);
    if (!loaded.ok) return loaded.error;
    const { draft } = loaded;

    if (publish) {
      const reasons: string[] = [];

      const valid = validateForPublish(draft, {
        slugRequired: t.validation.slugRequired,
        slugFormat: t.products.validationSlug,
        nameRequired: t.products.validationName,
        nameRequiredForLocale: t.products.nameCannotBeCleared,
        coverRequired: t.products.validationCover,
        priceMinRequired: t.products.priceMinRequired,
        priceRangeInvalid: t.products.priceRangeInvalid,
      });
      if (!valid.ok) reasons.push(valid.message);

      // slug 在草稿里可以随便改，占用冲突在发布这一关才拦得住
      const slugOwner = await db.product.findFirst({
        where: { slug: draft.basic.slug, id: { not: parsed.data.id } },
        select: { id: true },
      });
      if (slugOwner) reasons.push(t.products.validationSlug);

      if (draft.basic.categoryId) {
        const category = await db.productCategory.findUnique({
          where: { id: draft.basic.categoryId },
          select: { id: true },
        });
        if (!category) reasons.push(t.validation.invalidInput);
      }

      const coverError = await checkImageAsset(db, draft.basic.coverAssetId ?? '', t);
      if (coverError) reasons.push(coverError.message ?? t.products.validationCover);

      const hoverError = await checkVideoAsset(db, draft.basic.hoverVideoAssetId ?? '', t);
      if (hoverError) reasons.push(hoverError.message ?? t.validation.invalidInput);

      if (reasons.length > 0) {
        return {
          status: 'error',
          message: `${t.products.validationTitle}: ${reasons.join(' ')}`,
        };
      }

      /**
       * 发布自带的同步保险。
       *
       * 即使管理员改了中文之后**没有**再点「一键翻译」，这里也会把改动补齐到全部
       * 目标语言 —— 这是需求里那句「发布必须自带同步保险」的落点。
       *
       * 三条边界：
       *   - 一个待同步字段都没有时零调用（`syncForPublish` 直接返回 ready）；
       *   - 一次请求只跑一段预算，没跑完就把 jobId 交给界面继续推，
       *     绝不把整轮翻译塞进这一个请求里；
       *   - 任何目标语言失败就**放弃本次发布**，线上保持原样 ——
       *     宁可不上线，也不要上线一个中英混杂的版本。
       */
      const { outcome, hasApiKey } = await runPublishSync(db, 'product', parsed.data.id, user.id);

      if (outcome.status === 'working') {
        return {
          status: 'idle',
          message: formatMessage(t.translation.publishSyncing, {
            completed: outcome.progress?.completedItems ?? 0,
            total: outcome.progress?.totalItems ?? 0,
          }),
          jobId: outcome.jobId ?? undefined,
          progress: toProgress(outcome.progress),
        };
      }

      if (outcome.status === 'failed') {
        return {
          status: 'error',
          message: describeSyncFailure(outcome, hasApiKey, t),
          jobId: outcome.jobId ?? undefined,
          progress: toProgress(outcome.progress),
          // 界面据此决定要不要显示「应急发布中文，其他语言稍后同步」。
          // 只有服务暂时性故障才会是 eligible —— 内容或配置问题一律 false。
          emergency: classifyPublishFailure(outcome.progress),
        };
      }

      publishOutcome = outcome;
    }

    /**
     * 发布时**必须重新读一次草稿**。
     *
     * 上面那段同步把新翻出来的译文写进了 `Product.draftData`；而 `draft` 是同步**之前**
     * 读的快照。沿用旧的那份，结果就是「同步成功、发布也成功、译文却没上线」——
     * 而且不会有任何报错。这类 bug 只能靠这里的一次多余读取挡掉。
     */
    const fresh = publish ? await loadWorkingDraft(db, parsed.data.id, t) : null;
    if (publish && !fresh?.ok) return fresh?.error ?? { status: 'error', message: t.products.notFound };
    const toPublish = fresh && fresh.ok ? fresh.draft : draft;

    if (publish) {
      // 事务体与「应急发布之后自动补齐」那条路径共用，避免两处各写一遍、
      // 日后在故障恢复时才暴露出差异
      await finishProductPublish(db, parsed.data.id, toPublish, {
        userId: user.id,
        revision: publishOutcome?.revision ?? 0,
        jobId: publishOutcome?.jobId ?? null,
        kind: 'FULL',
      });
    } else {
      await db.product.update({ where: { id: parsed.data.id }, data: { published: false } });
    }

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: publish ? 'PUBLISH' : 'UNPUBLISH',
      targetType: 'Product',
      targetId: parsed.data.id,
      summary: publish ? t.products.publish : t.products.unpublish,
      detail: { slug: toPublish.basic.slug, release: publish ? (publishOutcome?.revision ?? null) : undefined },
    });
  } catch (error) {
    console.error('[admin] set product status failed:', error);
    return { status: 'error', message: t.actions.operationFailed };
  }

  revalidatePublicCatalogue();
  return {
    status: 'success',
    message: publish ? t.products.statusPublished : t.products.statusDraft,
  };
}

/**
 * 手动存档：把「正在编辑的内容」留成一个版本，**不影响线上**。
 *
 * 自动保存不产生版本（几秒一存的话，三个名额只会是最近几秒的快照），
 * 所以改大动作之前想留个退路，就用这个按钮。
 */
export async function createProductVersionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const schema = z.object({
    id: requiredIdField(t),
    note: z.preprocess(
      (value) => (typeof value === 'string' ? value.trim().slice(0, 200) : ''),
      z.string(),
    ),
  });
  const parsed = parseForm(schema, formData, t);
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const loaded = await loadWorkingDraft(db, parsed.data.id, t);
    if (!loaded.ok) return loaded.error;

    await db.$transaction(async (tx) => {
      await recordVersion(tx, {
        productId: parsed.data.id,
        kind: 'MANUAL',
        snapshot: loaded.draft,
        userId: user.id,
        note: parsed.data.note,
      });
    }, DRAFT_TRANSACTION_OPTIONS);

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'UPDATE',
      targetType: 'Product',
      targetId: parsed.data.id,
      summary: t.products.versionSaved,
      detail: { kind: 'MANUAL' },
    });
  } catch (error) {
    console.error('[admin] create product version failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  return { status: 'success', message: t.products.versionSaved };
}

/**
 * 恢复一个历史版本。
 *
 * 内容写回**草稿**而不是直接改线上：恢复之后它成为「待发布的改动」，
 * 你在编辑器里看到的就是那一版的样子，确认无误再点发布。误点恢复也能再退回去。
 */
export async function restoreProductVersionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const schema = z.object({
    id: requiredIdField(t),
    versionId: requiredIdField(t),
  });
  const parsed = parseForm(schema, formData, t);
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const version = await db.productVersion.findUnique({
      where: { id: parsed.data.versionId },
      select: { id: true, productId: true, snapshot: true, kind: true, createdAt: true },
    });
    if (!version || version.productId !== parsed.data.id) {
      return { status: 'error', message: t.products.versionNotFound };
    }

    const snapshot = readDraft(version.snapshot);
    if (!snapshot) return { status: 'error', message: t.products.versionUnreadable };

    // 快照里的参数行 id 属于「当时那一版」，可能已经被后来的发布删掉了。
    // 置空让发布时按新增处理，避免把主键指到别的商品的行上。
    const live = await loadProductDraftState(db, parsed.data.id);
    const liveSpecIds = new Set((live?.live.specs ?? []).map((spec) => spec.id).filter(Boolean));
    const restored = {
      ...snapshot,
      specs: snapshot.specs.map((spec) => ({
        ...spec,
        id: spec.id !== null && liveSpecIds.has(spec.id) ? spec.id : null,
      })),
    };

    await saveDraft(db, parsed.data.id, restored);

    /**
     * 内容是**整体换掉**的，没经过翻译引擎 —— 同步状态必须一起清掉。
     *
     * 不清的话记录会描述一个已经不存在的版本：界面显示「已是最新」，
     * 而线上跑的其实是另一份内容。这是最难查的一类不一致，清掉重翻的代价小得多。
     */
    await invalidateTranslationState(db, 'product', parsed.data.id);

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'UPDATE',
      targetType: 'Product',
      targetId: parsed.data.id,
      summary: t.products.versionRestored,
      detail: { versionId: version.id, kind: version.kind, draft: true },
    });
  } catch (error) {
    console.error('[admin] restore product version failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  return { status: 'success', message: t.products.versionRestored };
}

/** 删除一个历史版本（不影响线上内容，也不影响草稿） */
export async function deleteProductVersionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const schema = z.object({
    id: requiredIdField(t),
    versionId: requiredIdField(t),
  });
  const parsed = parseForm(schema, formData, t);
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const version = await db.productVersion.findUnique({
      where: { id: parsed.data.versionId },
      select: { id: true, productId: true },
    });
    if (!version || version.productId !== parsed.data.id) {
      return { status: 'error', message: t.products.versionNotFound };
    }

    await db.productVersion.delete({ where: { id: version.id } });

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'DELETE',
      targetType: 'Product',
      targetId: parsed.data.id,
      summary: t.products.versionDeleted,
      detail: { versionId: version.id },
    });
  } catch (error) {
    console.error('[admin] delete product version failed:', error);
    return { status: 'error', message: t.actions.deleteFailed };
  }

  return { status: 'success', message: t.products.versionDeleted };
}

/** Copies the product, its translations, its gallery and its cover into a new draft. */
export async function duplicateProductAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState & { duplicateId?: string }> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const schema = z.object({ id: requiredIdField(t) });
  const parsed = parseForm(schema, formData, t);
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  let copyId: string | undefined;

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

    // 复制品必须有唯一 slug。命名规则与新建商品共用同一套实现（下划线 + 递增序号），
    // 这样「复制出来的地址」和「新建出来的地址」样式一致。
    const baseSlug = slugify(`${source.slug}_copy`) || 'product_copy';
    const slug = await uniqueSlug(baseSlug, async (candidate) =>
      Boolean(await db.product.findUnique({ where: { slug: candidate }, select: { id: true } })),
    );

    // 编辑器里看到的是**草稿**（没有草稿时就是线上内容）。原实现只复制线上行，
    // 于是「正在编辑的商品」复制出来会丢掉你刚改的东西 —— 这里把草稿一并带过去。
    const draftState = await loadProductDraftState(db, source.id);
    const sourceDraft = draftState?.hasDraft ? draftState.draft : null;

    const copy = await db.product.create({
      data: {
        slug,
        // 运行数据一律不继承：published 固定为 false、不复制订单/统计/发布时间；
        // sortOrder 属于展示配置，随内容一起复制。
        draftData: sourceDraft
          ? (sourceDraft as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        draftUpdatedAt: sourceDraft ? new Date() : null,
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
        specTable: source.specTable ?? undefined,
        variantGroups: source.variantGroups ?? undefined,
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

    copyId = copy.id;

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'CREATE',
      targetType: 'Product',
      targetId: copy.id,
      summary: t.products.duplicated,
      detail: { duplicatedFrom: source.id, slug: copy.slug, carriedDraft: Boolean(sourceDraft) },
    });
  } catch (error) {
    console.error('[admin] duplicate product failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePublicCatalogue();
  return { status: 'success', message: t.products.duplicated, duplicateId: copyId };
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

    // TranslationState 是按 (entityType, entityId) 字符串关联的，没有外键级联 ——
    // 商品删了却留下同步状态，会让「语言同步」页出现指向空气的条目
    await db.translationState.deleteMany({ where: { entityType: 'product', entityId: product.id } });
    await db.contentRevision.deleteMany({ where: { entityType: 'product', entityId: product.id } });

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
/**
 * 把素材追加到图库末尾。素材类型决定用途（视频 → VIDEO，图片 → GALLERY），
 * 与前台/发布时的判定完全一致，不接受客户端传 role。
 *
 * 纯函数：顺序语义只写在这一处，新增、上传绑定都走它。
 */
function appendToGallery(
  draft: ProductDraft,
  assets: { id: string; type: 'IMAGE' | 'VIDEO' }[],
): { draft: ProductDraft; added: string[] } {
  const seen = new Set(draft.media.map((item) => item.assetId));
  const media = [...draft.media];
  const added: string[] = [];

  for (const asset of assets) {
    if (seen.has(asset.id)) continue;
    seen.add(asset.id);
    media.push({ assetId: asset.id, role: draftMediaRoleFor(asset.type) });
    added.push(asset.id);
  }

  return { draft: { ...draft, media }, added };
}

/** 经服务端校验的、可用的素材（存在且已启用） */
async function loadUsableAssets(
  db: PrismaClient,
  assetIds: string[],
): Promise<{ id: string; type: 'IMAGE' | 'VIDEO' }[]> {
  if (assetIds.length === 0) return [];
  return db.asset.findMany({
    where: { id: { in: assetIds }, enabled: true },
    select: { id: true, type: true },
  });
}

/** 从图库里挑素材加进草稿图库：图片为 GALLERY，视频为 VIDEO。 */
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
    const assets = await loadUsableAssets(db, assetIds);
    if (assets.length === 0) return { status: 'error', message: t.validation.invalidInput };

    const loaded = await loadWorkingDraft(db, base.data.productId, t);
    if (!loaded.ok) return loaded.error;

    const { draft, added } = appendToGallery(loaded.draft, assets);

    return await persistDraft(db, {
      productId: base.data.productId,
      draft,
      user,
      summary: t.products.galleryLabel,
      t,
      detail: { assetIds: added },
    });
  } catch (error) {
    console.error('[admin] add product media failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }
}

/**
 * 与相邻的一项交换位置。
 *
 * 图库项的身份是 **assetId** 而不是行主键：草稿里的图库还只是数组，
 * 没有数据库行可指。同一商品内一个素材只可能出现一次（发布时的
 * `@@unique([productId, assetId, role])` 也是这个语义），所以 assetId 就是稳定标识。
 */
export async function moveProductMediaAction(
  productId: string,
  assetId: string,
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
      assetId: z.string().min(1),
      direction: z.enum(['up', 'down']),
    })
    .safeParse({ productId, assetId, direction });
  if (!parsed.success) return { status: 'error', message: t.validation.invalidInput };

  try {
    const loaded = await loadWorkingDraft(db, parsed.data.productId, t);
    if (!loaded.ok) return loaded.error;

    const media = [...loaded.draft.media];
    const index = media.findIndex((item) => item.assetId === parsed.data.assetId);
    if (index === -1) return { status: 'error', message: t.validation.invalidInput };

    const target = parsed.data.direction === 'up' ? index - 1 : index + 1;
    // 已经在两端：不报错，当作无事发生（用户点多了不该看到红字）
    if (target < 0 || target >= media.length) return autosavedMessage();

    const [moved] = media.splice(index, 1);
    media.splice(target, 0, moved);

    return await persistDraft(db, {
      productId: parsed.data.productId,
      draft: { ...loaded.draft, media },
      user,
      summary: t.products.galleryLabel,
      t,
      detail: { assetId: parsed.data.assetId, direction: parsed.data.direction },
    });
  } catch (error) {
    console.error('[admin] move product media failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }
}

/** 拖拽后的显式顺序；提交的集合必须与草稿图库完全一致（不能借机塞进别的素材）。 */
export async function reorderProductMediaAction(
  productId: string,
  assetIds: string[],
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
      assetIds: z.array(z.string().min(1)).min(1).max(500),
    })
    .safeParse({ productId, assetIds });
  if (!parsed.success) return { status: 'error', message: t.validation.invalidInput };

  try {
    const loaded = await loadWorkingDraft(db, parsed.data.productId, t);
    if (!loaded.ok) return loaded.error;

    const known = new Set(loaded.draft.media.map((item) => item.assetId));
    const submitted = new Set(parsed.data.assetIds);
    if (
      known.size !== parsed.data.assetIds.length ||
      submitted.size !== parsed.data.assetIds.length ||
      !parsed.data.assetIds.every((id) => known.has(id))
    ) {
      return { status: 'error', message: t.validation.invalidInput };
    }

    const byAsset = new Map(loaded.draft.media.map((item) => [item.assetId, item]));
    const media = parsed.data.assetIds.map((id) => byAsset.get(id)!);

    return await persistDraft(db, {
      productId: parsed.data.productId,
      draft: { ...loaded.draft, media },
      user,
      summary: t.products.galleryLabel,
      t,
      detail: { assetIds: parsed.data.assetIds },
    });
  } catch (error) {
    console.error('[admin] reorder product media failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }
}

/** 从图库里移出一项。素材本身留在媒体库，没有被删除。 */
export async function removeProductMediaAction(
  productId: string,
  assetId: string,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  const parsed = z
    .object({ productId: z.string().min(1), assetId: z.string().min(1) })
    .safeParse({ productId, assetId });
  if (!parsed.success) return { status: 'error', message: t.validation.invalidInput };

  try {
    const loaded = await loadWorkingDraft(db, parsed.data.productId, t);
    if (!loaded.ok) return loaded.error;

    const media = loaded.draft.media.filter((item) => item.assetId !== parsed.data.assetId);
    if (media.length === loaded.draft.media.length) {
      return { status: 'error', message: t.validation.invalidInput };
    }

    // 移出图库时，如果它正被当作封面或悬停视频，一并清掉 ——
    // 否则会留下一个指向「已不在图库里」的素材的引用，媒体页上再也点不到、清不掉。
    const basic = { ...loaded.draft.basic };
    if (basic.coverAssetId === parsed.data.assetId) basic.coverAssetId = null;
    if (basic.hoverVideoAssetId === parsed.data.assetId) basic.hoverVideoAssetId = null;

    return await persistDraft(db, {
      productId: parsed.data.productId,
      draft: { ...loaded.draft, basic, media },
      user,
      summary: t.products.removeFromGallery,
      t,
      detail: { assetId: parsed.data.assetId },
    });
  } catch (error) {
    console.error('[admin] remove product media failed:', error);
    return { status: 'error', message: t.actions.deleteFailed };
  }
}

// ---------------------------------------------------------------------------
// 结构化参数 / 规格颜色表
// ---------------------------------------------------------------------------

const tableTextSchema = (max: number) =>
  z.object({
    zh: textField(max),
    en: textField(max),
    vi: textField(max),
  });

const specTablePayloadSchema = (t: AdminMessages) =>
  z
    .object({
      productId: requiredIdField(t),
      table: z.object({
        columns: z
          .array(
            z.object({
              id: z.string().trim().min(1).max(80),
              values: tableTextSchema(120),
            }),
          )
          .min(1, t.products.specColumnRequired)
          .max(20, t.products.specTooMany),
        rows: z
          .array(
            z.object({
              id: z.string().trim().min(1).max(80),
              cells: z.record(tableTextSchema(300)),
            }),
          )
          .max(100, t.products.specTooMany),
      }),
    })
    .superRefine((value, context) => {
      const columnIds = value.table.columns.map((column) => column.id);
      if (new Set(columnIds).size !== columnIds.length) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: t.products.specColumnDuplicate });
      }
      const rowIds = value.table.rows.map((row) => row.id);
      if (new Set(rowIds).size !== rowIds.length) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: t.products.specRowDuplicate });
      }
    });

/**
 * 表单版本：表头、表格行和三语单元格都是动态的，因此整表序列化成 JSON 放进一个隐藏字段。
 *
 * JSON 只是**传输方式**，不是信任边界 —— 解析后仍然走上面的 Zod 校验，
 * 行数上限、字段长度、语言枚举都由服务端重新检查。
 */
const specFormSchema = (t: AdminMessages) =>
  z.object({
    productId: requiredIdField(t),
    payload: z.string().max(200_000, t.products.specTooMany),
  });

/**
 * 保存完整的可配置表。结构只存进草稿/发布后的 JSON，不再受固定的「名称 + 值」两列限制。
 * 仍兼容旧版客户端传来的 rows 数组，以便正在打开旧页面的管理员不会保存失败。
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

  let decoded: unknown;
  try {
    decoded = JSON.parse(form.data.payload);
  } catch {
    return { status: 'error', message: t.validation.invalidInput };
  }

  // 兼容上一版固定两列编辑器：先转换成新表结构，再走同一套校验。
  if (Array.isArray(decoded)) {
    const legacyRows = decoded as Array<Record<string, unknown>>;
    const table = specTableFromLegacyRows(legacyRows);
    decoded = { table };
  }

  const parsed = specTablePayloadSchema(t).safeParse({
    productId: form.data.productId,
    table: decoded && typeof decoded === 'object' && 'table' in decoded
      ? (decoded as { table: unknown }).table
      : decoded,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { status: 'error', message: issue?.message ?? t.validation.invalidInput };
  }

  const table = parsed.data.table as ProductDraftSpecTable;

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const loaded = await loadWorkingDraft(db, parsed.data.productId, t);
    if (!loaded.ok) return loaded.error;

    return await persistDraft(db, {
      productId: parsed.data.productId,
      draft: { ...loaded.draft, specTable: table },
      user,
      summary: t.products.specsSection,
      t,
      detail: { columns: table.columns.length, rows: table.rows.length },
    });
  } catch (error) {
    console.error('[admin] save product specifications failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }
}

// ---------------------------------------------------------------------------
// 1688 风格型号 / 颜色选项
// ---------------------------------------------------------------------------

const variantGroupsPayloadSchema = (t: AdminMessages) =>
  z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        values: tableTextSchema(120),
        options: z
          .array(
            z.object({
              id: z.string().trim().min(1).max(80),
              assetId: z.string().trim().max(200).nullable(),
              values: tableTextSchema(200),
            }),
          )
          .max(100, t.products.variantTooMany),
      }),
    )
    .max(10, t.products.variantTooMany)
    .superRefine((groups, context) => {
      const groupIds = groups.map((group) => group.id);
      const optionIds = groups.flatMap((group) => group.options.map((option) => option.id));
      if (new Set(groupIds).size !== groupIds.length || new Set(optionIds).size !== optionIds.length) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: t.products.variantDuplicate });
      }
      if (optionIds.length > 200) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: t.products.variantTooMany });
      }
    });

const variantGroupsFormSchema = (t: AdminMessages) =>
  z.object({
    productId: requiredIdField(t),
    payload: z.string().max(400_000, t.products.variantTooMany),
  });

/**
 * 保存带图片的型号/颜色卡片。它们与尺寸、材质等参数表是两套独立数据：
 * 参数表用来阅读，选项卡用来让客人逐项选择。
 */
export async function saveProductVariantGroupsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const form = parseForm(variantGroupsFormSchema(t), formData, t);
  if (!form.ok) return { status: 'error', message: form.message };

  let decoded: unknown;
  try {
    decoded = JSON.parse(form.data.payload);
  } catch {
    return { status: 'error', message: t.validation.invalidInput };
  }

  const parsed = variantGroupsPayloadSchema(t).safeParse(decoded);
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? t.validation.invalidInput,
    };
  }

  const groups = parsed.data as ProductDraftVariantGroup[];
  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const assetIds = [
      ...new Set(
        groups.flatMap((group) =>
          group.options.flatMap((option) => (option.assetId ? [option.assetId] : [])),
        ),
      ),
    ];
    if (assetIds.length > 0) {
      const enabledImages = await db.asset.findMany({
        where: { id: { in: assetIds }, enabled: true, type: 'IMAGE' },
        select: { id: true },
      });
      if (enabledImages.length !== assetIds.length) {
        return { status: 'error', message: t.products.variantAssetInvalid };
      }
    }

    const loaded = await loadWorkingDraft(db, form.data.productId, t);
    if (!loaded.ok) return loaded.error;

    return await persistDraft(db, {
      productId: form.data.productId,
      draft: { ...loaded.draft, variantGroups: groups },
      user,
      summary: t.products.variantsSection,
      t,
      detail: {
        groups: groups.length,
        options: groups.reduce((total, group) => total + group.options.length, 0),
      },
    });
  } catch (error) {
    console.error('[admin] save product variant groups failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }
}

/** 兼容旧版 rows payload，不让旧页面的 in-flight 提交把数据写坏。 */
function specTableFromLegacyRows(rows: Array<Record<string, unknown>>): ProductDraftSpecTable {
  const legacySpecs: ProductDraftSpec[] = rows.map((row) => {
    const readLocalized = (value: unknown, locale: AdminLocale) => {
      if (!value || typeof value !== 'object') return '';
      const raw = (value as Record<string, unknown>)[locale];
      return typeof raw === 'string' ? raw : '';
    };
    return {
      id: typeof row.id === 'string' && row.id.trim() ? row.id : null,
      values: localizedRecord((locale) => ({
        name: readLocalized(row.name, locale),
        value: readLocalized(row.value, locale),
      })),
    };
  });
  return specTableFromLegacySpecs(legacySpecs);
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
    if (parsed.data.role === 'cover') {
      const error = await checkImageAsset(db, parsed.data.assetId, t);
      if (error) return error;
    } else {
      const error = await checkVideoAsset(db, parsed.data.assetId, t);
      if (error) return error;
    }

    const loaded = await loadWorkingDraft(db, parsed.data.productId, t);
    if (!loaded.ok) return loaded.error;

    const basic = { ...loaded.draft.basic };
    if (parsed.data.role === 'cover') basic.coverAssetId = parsed.data.assetId;
    else basic.hoverVideoAssetId = parsed.data.assetId;

    return await persistDraft(db, {
      productId: parsed.data.productId,
      draft: { ...loaded.draft, basic },
      user,
      summary: parsed.data.role === 'cover' ? t.products.coverLabel : t.products.hoverVideoLabel,
      t,
      detail: { assetId: parsed.data.assetId, role: parsed.data.role },
    });
  } catch (error) {
    console.error('[admin] set product asset role failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }
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
    const assets = await loadUsableAssets(db, parsed.data.assetIds);
    if (assets.length === 0) return { status: 'error', message: t.products.uploadBindFailed };

    const loaded = await loadWorkingDraft(db, parsed.data.productId, t);
    if (!loaded.ok) return loaded.error;

    const { draft, added } = appendToGallery(loaded.draft, assets);
    if (added.length === 0) return { status: 'error', message: t.products.uploadBindFailed };

    return await persistDraft(db, {
      productId: parsed.data.productId,
      draft,
      user,
      summary: t.products.galleryLabel,
      t,
      detail: { source: 'upload', assetIds: added },
    });
  } catch (error) {
    console.error('[admin] attach uploaded assets failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }
}
