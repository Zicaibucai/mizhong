'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getPrisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { getDbUnavailableState, requireAdminOrError } from '@/lib/admin/guard';
import {
  ADMIN_LOCALES,
  makeBlockBaseSchema,
  makeBlockTranslationSchema,
  makePageBaseSchema,
  makePageTranslationSchema,
  parseForm,
  parseLocaleFields,
  type AdminLocale,
} from '@/lib/admin/validation';
import { formatMessage, getAdminMessagesForRequest } from '@/lib/admin/i18n';
import type { FormState } from '@/lib/admin/action-state';

export async function savePageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const base = parseForm(makePageBaseSchema(t), formData, t);
  if (!base.ok) return { status: 'error', message: base.message };

  const translationSchema = makePageTranslationSchema(t);
  const translations: { locale: AdminLocale; title: string; seoTitle: string; seoDescription: string }[] =
    [];
  for (const locale of ADMIN_LOCALES) {
    const parsed = parseLocaleFields(translationSchema, locale, formData, t);
    if (!parsed.ok) return { status: 'error', message: parsed.message };
    translations.push({ locale, ...parsed.data });
  }

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const existing = await db.page.findUnique({ where: { id: base.data.id } });
    if (!existing) return { status: 'error', message: t.actions.pageMissing };

    const slugOwner = await db.page.findUnique({ where: { slug: base.data.slug } });
    if (slugOwner && slugOwner.id !== base.data.id) {
      return { status: 'error', message: t.actions.slugTaken };
    }

    await db.page.update({ where: { id: base.data.id }, data: { slug: base.data.slug } });

    for (const item of translations) {
      await db.pageTranslation.upsert({
        where: { pageId_locale: { pageId: base.data.id, locale: item.locale } },
        update: { title: item.title, seoTitle: item.seoTitle, seoDescription: item.seoDescription },
        create: {
          pageId: base.data.id,
          locale: item.locale,
          title: item.title,
          seoTitle: item.seoTitle,
          seoDescription: item.seoDescription,
        },
      });
    }

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'UPDATE',
      targetType: 'Page',
      targetId: base.data.id,
      summary: formatMessage(t.auditSummaries.pageUpdated, { slug: existing.slug }),
    });
  } catch (error) {
    console.error('[admin] save page failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePath('/', 'layout');
  return { status: 'success', message: t.actions.pageSaved };
}

export async function saveBlockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const base = parseForm(makeBlockBaseSchema(t), formData, t);
  if (!base.ok) return { status: 'error', message: base.message };

  const translationSchema = makeBlockTranslationSchema();
  const translations: {
    locale: AdminLocale;
    title: string;
    subtitle: string;
    body: string;
    ctaLabel: string;
    ctaHref: string;
  }[] = [];
  for (const locale of ADMIN_LOCALES) {
    const parsed = parseLocaleFields(translationSchema, locale, formData, t);
    if (!parsed.ok) return { status: 'error', message: parsed.message };
    translations.push({ locale, ...parsed.data });
  }

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const block = await db.pageBlock.findUnique({ where: { id: base.data.id } });
    if (!block) return { status: 'error', message: t.actions.blockMissing };

    await db.pageBlock.update({ where: { id: block.id }, data: { enabled: base.data.enabled } });

    for (const item of translations) {
      await db.pageBlockTranslation.upsert({
        where: { blockId_locale: { blockId: block.id, locale: item.locale } },
        update: {
          title: item.title,
          subtitle: item.subtitle,
          body: item.body,
          ctaLabel: item.ctaLabel,
          ctaHref: item.ctaHref,
        },
        create: {
          blockId: block.id,
          locale: item.locale,
          title: item.title,
          subtitle: item.subtitle,
          body: item.body,
          ctaLabel: item.ctaLabel,
          ctaHref: item.ctaHref,
        },
      });
    }

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'UPDATE',
      targetType: 'PageBlock',
      targetId: block.id,
      summary: formatMessage(t.auditSummaries.blockUpdated, { key: block.key }),
    });
  } catch (error) {
    console.error('[admin] save block failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePath('/', 'layout');
  return { status: 'success', message: t.actions.blockSaved };
}

export async function setPageStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const statusSchema = z.object({
    id: z.string().trim().min(1, t.validation.invalidInput),
    status: z.enum(['DRAFT', 'PUBLISHED']),
  });
  const parsed = parseForm(statusSchema, formData, t);
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const page = await db.page.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status },
    });

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: parsed.data.status === 'PUBLISHED' ? 'PUBLISH' : 'UNPUBLISH',
      targetType: 'Page',
      targetId: page.id,
      summary:
        parsed.data.status === 'PUBLISHED'
          ? formatMessage(t.auditSummaries.pagePublished, { slug: page.slug })
          : formatMessage(t.auditSummaries.pageDrafted, { slug: page.slug }),
    });
  } catch (error) {
    console.error('[admin] set page status failed:', error);
    return { status: 'error', message: t.actions.operationFailed };
  }

  revalidatePath('/', 'layout');
  return {
    status: 'success',
    message: parsed.data.status === 'PUBLISHED' ? t.actions.pagePublished : t.actions.pageDrafted,
  };
}
