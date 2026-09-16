'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getPrisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { getDbUnavailableState, requireAdminOrError } from '@/lib/admin/guard';
import {
  ADMIN_LOCALES,
  parseForm,
  parseLocaleFields,
  type AdminLocale,
} from '@/lib/admin/validation';
import { getAdminMessagesForRequest, type AdminMessages } from '@/lib/admin/i18n';
import type { FormState } from '@/lib/admin/action-state';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ---------------------------------------------------------------------------
// Local schemas
//
// The shared schema factories live in src/lib/admin/validation.ts, which is owned by another
// workstream — the catalog schemas therefore live here, built from the current request's admin
// messages (validation text is user-visible). `FormData.get()` returns `string | File | null`,
// so every field tolerates a missing value instead of failing on `null`.
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

/** Required id (an edit form): a missing field is reported as invalid input. */
function requiredIdField(t: AdminMessages) {
  return z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : ''),
    z.string().min(1, t.validation.invalidInput).max(200),
  );
}

/** Optional id (a create form): a missing field simply means "not set". */
function optionalIdField(max = 200) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined),
    z.string().max(max).optional(),
  );
}

function makeCategoryBaseSchema(t: AdminMessages) {
  return z.object({
    id: optionalIdField(),
    slug: slugField(t),
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
    enabled: z.coerce.boolean().default(false),
    coverAssetId: textField(200),
  });
}

function makeCategoryTranslationSchema(t: AdminMessages) {
  return z.object({
    name: z.preprocess(
      (value) => (typeof value === 'string' ? value.trim() : ''),
      z.string().min(1, t.validation.invalidInput).max(200),
    ),
    description: textField(5000),
  });
}

function makeCategoryDeleteSchema(t: AdminMessages) {
  return z.object({
    id: requiredIdField(t),
    action: z.preprocess(
      (value) => (typeof value === 'string' ? value : ''),
      z.enum(['', 'reassign', 'clear'], {
        errorMap: () => ({ message: t.validation.invalidInput }),
      }),
    ),
    reassignTo: optionalIdField(),
  });
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function saveProductCategoryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const base = parseForm(makeCategoryBaseSchema(t), formData, t);
  if (!base.ok) return { status: 'error', message: base.message };

  const translationSchema = makeCategoryTranslationSchema(t);
  const translations: { locale: AdminLocale; name: string; description: string }[] = [];
  for (const locale of ADMIN_LOCALES) {
    const parsed = parseLocaleFields(translationSchema, locale, formData, t);
    if (!parsed.ok) return { status: 'error', message: parsed.message };
    translations.push({ locale, ...parsed.data });
  }

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  const coverAssetId = base.data.coverAssetId || null;
  const isUpdate = Boolean(base.data.id);

  try {
    if (base.data.id) {
      const existing = await db.productCategory.findUnique({
        where: { id: base.data.id },
        select: { id: true },
      });
      if (!existing) return { status: 'error', message: t.productCategories.notFound };
    }

    const slugOwner = await db.productCategory.findUnique({
      where: { slug: base.data.slug },
      select: { id: true },
    });
    if (slugOwner && slugOwner.id !== base.data.id) {
      return { status: 'error', message: t.actions.slugTaken };
    }

    if (coverAssetId) {
      const asset = await db.asset.findUnique({
        where: { id: coverAssetId },
        select: { type: true },
      });
      if (!asset || asset.type !== 'IMAGE') {
        return { status: 'error', message: t.validation.invalidInput };
      }
    }

    const shared = {
      slug: base.data.slug,
      sortOrder: base.data.sortOrder,
      enabled: base.data.enabled,
      coverAssetId,
    };

    const record = base.data.id
      ? await db.productCategory.update({ where: { id: base.data.id }, data: shared })
      : await db.productCategory.create({ data: shared });

    for (const item of translations) {
      const data = { name: item.name, description: item.description || null };
      await db.categoryTranslation.upsert({
        where: { categoryId_locale: { categoryId: record.id, locale: item.locale } },
        update: data,
        create: { categoryId: record.id, locale: item.locale, ...data },
      });
    }

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: isUpdate ? 'UPDATE' : 'CREATE',
      targetType: 'ProductCategory',
      targetId: record.id,
      summary: isUpdate ? t.productCategories.updated : t.productCategories.created,
      detail: { slug: record.slug },
    });
  } catch (error) {
    console.error('[admin] save product category failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePath('/', 'layout');
  return {
    status: 'success',
    message: isUpdate ? t.productCategories.updated : t.productCategories.created,
  };
}

/**
 * Deletes a category.
 *
 * A category that still has products is never deleted silently: the caller must either move those
 * products to another category (`action=reassign`, `reassignTo=<id>`) or clear their category
 * (`action=clear`). Products themselves are never deleted as a side effect.
 */
export async function deleteProductCategoryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const parsed = parseForm(makeCategoryDeleteSchema(t), formData, t);
  if (!parsed.ok) return { status: 'error', message: parsed.message };
  const { id, action, reassignTo } = parsed.data;

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const category = await db.productCategory.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!category) return { status: 'error', message: t.productCategories.notFound };

    const productIds = (
      await db.product.findMany({ where: { categoryId: id }, select: { id: true } })
    ).map((row) => row.id);

    if (productIds.length > 0) {
      if (action === 'reassign') {
        if (!reassignTo || reassignTo === id) {
          return { status: 'error', message: t.validation.invalidInput };
        }
        const target = await db.productCategory.findUnique({
          where: { id: reassignTo },
          select: { id: true },
        });
        if (!target) return { status: 'error', message: t.productCategories.notFound };

        await db.product.updateMany({ where: { categoryId: id }, data: { categoryId: reassignTo } });
        await writeAudit({
          userId: user.id,
          actorEmail: user.email,
          action: 'UPDATE',
          targetType: 'Product',
          targetId: reassignTo,
          summary: t.products.editTitle,
          detail: { movedFrom: id, movedTo: reassignTo, productIds },
        });
      } else if (action === 'clear') {
        await db.product.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
        await writeAudit({
          userId: user.id,
          actorEmail: user.email,
          action: 'UPDATE',
          targetType: 'Product',
          targetId: null,
          summary: t.products.editTitle,
          detail: { clearedFrom: id, productIds },
        });
      } else {
        // Nothing chosen yet — the UI shows the products and the two ways forward.
        return { status: 'error', message: t.productCategories.hasProductsTitle };
      }
    }

    await db.productCategory.delete({ where: { id } });

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'DELETE',
      targetType: 'ProductCategory',
      targetId: id,
      summary: t.productCategories.deleted,
      detail: { slug: category.slug },
    });
  } catch (error) {
    console.error('[admin] delete product category failed:', error);
    return { status: 'error', message: t.actions.deleteFailed };
  }

  revalidatePath('/', 'layout');
  return { status: 'success', message: t.productCategories.deleted };
}
