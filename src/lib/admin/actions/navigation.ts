'use server';

import { revalidatePath } from 'next/cache';
import { getPrisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { requireAdminOrError, DB_UNAVAILABLE_STATE } from '@/lib/admin/guard';
import {
  ADMIN_LOCALES,
  idSchema,
  navBaseSchema,
  navTranslationSchema,
  parseForm,
  parseLocaleFields,
  type AdminLocale,
} from '@/lib/admin/validation';
import type { FormState } from '@/lib/admin/action-state';

export async function saveNavAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAdminOrError();
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const base = parseForm(navBaseSchema, formData);
  if (!base.ok) return { status: 'error', message: base.message };

  const translations: { locale: AdminLocale; label: string }[] = [];
  for (const locale of ADMIN_LOCALES) {
    const parsed = parseLocaleFields(navTranslationSchema, locale, formData);
    if (!parsed.ok) return { status: 'error', message: parsed.message };
    translations.push({ locale, label: parsed.data.label });
  }

  if (!translations.some((item) => item.label.trim().length > 0)) {
    return { status: 'error', message: '请至少填写一种语言的导航名称。' };
  }

  const db = getPrisma();
  if (!db) return DB_UNAVAILABLE_STATE;

  const shared = {
    href: base.data.href.trim(),
    external: base.data.external,
    sortOrder: base.data.sortOrder,
    enabled: base.data.enabled,
  };

  try {
    const record = base.data.id
      ? await db.navItem.update({ where: { id: base.data.id }, data: shared })
      : await db.navItem.create({ data: shared });

    for (const item of translations) {
      await db.navItemTranslation.upsert({
        where: { navItemId_locale: { navItemId: record.id, locale: item.locale } },
        update: { label: item.label },
        create: { navItemId: record.id, locale: item.locale, label: item.label },
      });
    }

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: base.data.id ? 'UPDATE' : 'CREATE',
      targetType: 'NavItem',
      targetId: record.id,
      summary: base.data.id ? '更新导航项' : '新增导航项',
    });
  } catch (error) {
    console.error('[admin] save nav item failed:', error);
    return { status: 'error', message: '保存失败，请稍后重试。' };
  }

  revalidatePath('/', 'layout');
  return { status: 'success', message: '导航已保存，前台已更新。' };
}

export async function deleteNavAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAdminOrError();
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const db = getPrisma();
  if (!db) return DB_UNAVAILABLE_STATE;

  try {
    await db.navItem.delete({ where: { id: parsed.data.id } });
  } catch (error) {
    console.error('[admin] delete nav item failed:', error);
    return { status: 'error', message: '删除失败，该记录可能已不存在。' };
  }

  await writeAudit({
    userId: user.id,
    actorEmail: user.email,
    action: 'DELETE',
    targetType: 'NavItem',
    targetId: parsed.data.id,
    summary: '删除导航项',
  });

  revalidatePath('/', 'layout');
  return { status: 'success', message: '导航项已删除。' };
}
