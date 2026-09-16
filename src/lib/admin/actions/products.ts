'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
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
import type { FormState } from '@/lib/admin/action-state';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Success text for the plain "saved" cases.
 *
 * The admin message catalog (src/lib/admin/messages/catalog.ts) is frozen for this workstream and
 * carries no generic product-saved confirmation, so `t.common.saveChanges` is reused — it is the
 * only existing string that reads as "your edits are in". Product-specific confirmations that do
 * exist are used where they apply (`t.products.duplicated`, `t.products.deleted`, …).
 */
function savedMessage(t: AdminMessages): string {
  return t.common.saveChanges;
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

function makeProductCreateSchema(t: AdminMessages) {
  return z.object({
    slug: slugField(t),
    categoryId: optionalIdField(),
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  });
}

function makeProductBaseSchema(t: AdminMessages) {
  return z.object({
    id: requiredIdField(t),
    slug: slugField(t),
    sku: textField(120),
    categoryId: optionalIdField(),
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
    featured: z.coerce.boolean().default(false),
    coverAssetId: textField(200),
  });
}

function makeNameSchema() {
  return z.object({ name: textField(200) });
}

function makeProductTranslationSchema() {
  return z.object({
    name: textField(200),
    shortDescription: textField(500),
    description: textField(10000),
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

function makeCoverSchema(t: AdminMessages) {
  return z.object({
    id: requiredIdField(t),
    coverAssetId: textField(200),
  });
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
    return { status: 'error', message: t.validation.invalidInput };
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
    const slugOwner = await db.product.findUnique({
      where: { slug: base.data.slug },
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

    const product = await db.product.create({
      data: {
        slug: base.data.slug,
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

  revalidatePath('/', 'layout');
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

    const coverError = await checkImageAsset(db, coverAssetId ?? '', t);
    if (coverError) return coverError;

    await db.product.update({
      where: { id: base.data.id },
      data: {
        slug: base.data.slug,
        sku: base.data.sku || null,
        categoryId: base.data.categoryId ?? null,
        sortOrder: base.data.sortOrder,
        featured: base.data.featured,
        coverAssetId,
      },
    });

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

  revalidatePath('/', 'layout');
  return { status: 'success', message: savedMessage(t) };
}

/** Cover-only save, used by the media tab (keeps that tab independent from the basic form). */
export async function saveProductCoverAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const parsed = parseForm(makeCoverSchema(t), formData, t);
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  const coverAssetId = parsed.data.coverAssetId || null;

  try {
    const product = await db.product.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, slug: true },
    });
    if (!product) return { status: 'error', message: t.products.notFound };

    const coverError = await checkImageAsset(db, coverAssetId ?? '', t);
    if (coverError) return coverError;

    await db.product.update({ where: { id: parsed.data.id }, data: { coverAssetId } });

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'UPDATE',
      targetType: 'Product',
      targetId: parsed.data.id,
      summary: t.products.coverLabel,
      detail: { slug: product.slug, coverAssetId },
    });
  } catch (error) {
    console.error('[admin] save product cover failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePath('/', 'layout');
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
        data.name || data.shortDescription || data.description || data.spec || data.application,
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
        data.name || data.shortDescription || data.description || data.spec || data.application,
      );

      if (!filled) {
        // A locale with nothing to say has no translation row — unless SEO copy still lives there.
        if (existing && !existing.seoTitle && !existing.seoDescription) {
          await db.productTranslation.delete({ where: { id: existing.id } });
        } else if (existing) {
          await db.productTranslation.update({
            where: { id: existing.id },
            data: {
              shortDescription: null,
              description: null,
              spec: null,
              application: null,
            },
          });
        }
        continue;
      }

      const values = {
        name: data.name,
        shortDescription: data.shortDescription || null,
        description: data.description || null,
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

  revalidatePath('/', 'layout');
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

  revalidatePath('/', 'layout');
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

  revalidatePath('/', 'layout');
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
      include: { translations: true, media: true },
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
        featured: source.featured,
        published: false,
        sortOrder: source.sortOrder,
        translations: {
          create: source.translations.map((item) => ({
            locale: item.locale,
            name: item.name,
            shortDescription: item.shortDescription,
            description: item.description,
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

  revalidatePath('/', 'layout');
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

  revalidatePath('/', 'layout');
  redirect('/admin/products?deleted=1');
}

// ---------------------------------------------------------------------------
// Gallery (ProductMedia rows)
// ---------------------------------------------------------------------------

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

    const assets = await db.asset.findMany({
      where: { id: { in: assetIds }, enabled: true },
      select: { id: true, type: true },
    });
    if (assets.length === 0) return { status: 'error', message: t.validation.invalidInput };

    const existing = await db.productMedia.findMany({
      where: { productId: product.id },
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
      creates.push({ productId: product.id, assetId: asset.id, role, sortOrder: nextOrder });
      nextOrder += 1;
    }

    if (creates.length > 0) {
      await db.productMedia.createMany({ data: creates });

      await writeAudit({
        userId: user.id,
        actorEmail: user.email,
        action: 'CREATE',
        targetType: 'Product',
        targetId: product.id,
        summary: t.products.galleryLabel,
        detail: { slug: product.slug, assetIds: creates.map((row) => row.assetId) },
      });
    }
  } catch (error) {
    console.error('[admin] add product media failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePath('/', 'layout');
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

  revalidatePath('/', 'layout');
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

  revalidatePath('/', 'layout');
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

  revalidatePath('/', 'layout');
  return { status: 'success', message: savedMessage(t) };
}
