'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getPrisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { requireAdminOrError, DB_UNAVAILABLE_STATE } from '@/lib/admin/guard';
import {
  ADMIN_LOCALES,
  blockBaseSchema,
  blockTranslationSchema,
  pageBaseSchema,
  pageTranslationSchema,
  parseForm,
  parseLocaleFields,
  type AdminLocale,
} from '@/lib/admin/validation';
import type { FormState } from '@/lib/admin/action-state';

const statusSchema = z.object({
  id: z.string().trim().min(1),
  status: z.enum(['DRAFT', 'PUBLISHED']),
});

export async function savePageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAdminOrError();
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const base = parseForm(pageBaseSchema, formData);
  if (!base.ok) return { status: 'error', message: base.message };

  const translations: { locale: AdminLocale; title: string; seoTitle: string; seoDescription: string }[] =
    [];
  for (const locale of ADMIN_LOCALES) {
    const parsed = parseLocaleFields(pageTranslationSchema, locale, formData);
    if (!parsed.ok) return { status: 'error', message: parsed.message };
    translations.push({ locale, ...parsed.data });
  }

  const db = getPrisma();
  if (!db) return DB_UNAVAILABLE_STATE;

  try {
    const existing = await db.page.findUnique({ where: { id: base.data.id } });
    if (!existing) return { status: 'error', message: '页面不存在。' };

    const slugOwner = await db.page.findUnique({ where: { slug: base.data.slug } });
    if (slugOwner && slugOwner.id !== base.data.id) {
      return { status: 'error', message: '该 slug 已被其它页面使用。' };
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
      summary: `更新页面「${existing.slug}」`,
    });
  } catch (error) {
    console.error('[admin] save page failed:', error);
    return { status: 'error', message: '保存失败，请稍后重试。' };
  }

  revalidatePath('/', 'layout');
  return { status: 'success', message: '页面信息已保存。' };
}

export async function saveBlockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAdminOrError();
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const base = parseForm(blockBaseSchema, formData);
  if (!base.ok) return { status: 'error', message: base.message };

  const translations: {
    locale: AdminLocale;
    title: string;
    subtitle: string;
    body: string;
    ctaLabel: string;
    ctaHref: string;
  }[] = [];
  for (const locale of ADMIN_LOCALES) {
    const parsed = parseLocaleFields(blockTranslationSchema, locale, formData);
    if (!parsed.ok) return { status: 'error', message: parsed.message };
    translations.push({ locale, ...parsed.data });
  }

  const db = getPrisma();
  if (!db) return DB_UNAVAILABLE_STATE;

  try {
    const block = await db.pageBlock.findUnique({ where: { id: base.data.id } });
    if (!block) return { status: 'error', message: '区块不存在。' };

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
      summary: `更新区块「${block.key}」`,
    });
  } catch (error) {
    console.error('[admin] save block failed:', error);
    return { status: 'error', message: '保存失败，请稍后重试。' };
  }

  revalidatePath('/', 'layout');
  return { status: 'success', message: '区块已保存。' };
}

export async function setPageStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAdminOrError();
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const parsed = parseForm(statusSchema, formData);
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const db = getPrisma();
  if (!db) return DB_UNAVAILABLE_STATE;

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
      summary: parsed.data.status === 'PUBLISHED' ? `发布页面「${page.slug}」` : `转为草稿「${page.slug}」`,
    });
  } catch (error) {
    console.error('[admin] set page status failed:', error);
    return { status: 'error', message: '操作失败，请稍后重试。' };
  }

  revalidatePath('/', 'layout');
  return {
    status: 'success',
    message: parsed.data.status === 'PUBLISHED' ? '页面已发布，前台已更新。' : '页面已转为草稿，前台已回退。',
  };
}
