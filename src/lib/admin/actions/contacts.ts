'use server';

import { revalidatePath } from 'next/cache';
import { getPrisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { requireAdminOrError, DB_UNAVAILABLE_STATE } from '@/lib/admin/guard';
import {
  ADMIN_LOCALES,
  contactBaseSchema,
  contactTranslationSchema,
  idSchema,
  parseForm,
  parseLocaleFields,
  type AdminLocale,
} from '@/lib/admin/validation';
import type { FormState } from '@/lib/admin/action-state';

export async function saveContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAdminOrError();
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const base = parseForm(contactBaseSchema, formData);
  if (!base.ok) return { status: 'error', message: base.message };

  const translations: { locale: AdminLocale; label: string; value: string }[] = [];
  for (const locale of ADMIN_LOCALES) {
    const parsed = parseLocaleFields(contactTranslationSchema, locale, formData);
    if (!parsed.ok) return { status: 'error', message: parsed.message };
    translations.push({ locale, ...parsed.data });
  }

  const hasAnyValue =
    base.data.value.trim().length > 0 || translations.some((item) => item.value.trim().length > 0);
  if (!hasAnyValue) {
    return { status: 'error', message: '请至少填写一个联系方式的值（通用值或任一语言的值）。' };
  }

  const db = getPrisma();
  if (!db) return DB_UNAVAILABLE_STATE;

  const shared = {
    type: base.data.type,
    value: base.data.value.trim() || null,
    href: base.data.href.trim() || null,
    sortOrder: base.data.sortOrder,
    enabled: base.data.enabled,
  };

  try {
    const record = base.data.id
      ? await db.contactMethod.update({ where: { id: base.data.id }, data: shared })
      : await db.contactMethod.create({ data: shared });

    for (const item of translations) {
      await db.contactMethodTranslation.upsert({
        where: { contactMethodId_locale: { contactMethodId: record.id, locale: item.locale } },
        update: { label: item.label, value: item.value },
        create: {
          contactMethodId: record.id,
          locale: item.locale,
          label: item.label,
          value: item.value,
        },
      });
    }

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: base.data.id ? 'UPDATE' : 'CREATE',
      targetType: 'ContactMethod',
      targetId: record.id,
      summary: base.data.id ? '更新联系方式' : '新增联系方式',
    });
  } catch (error) {
    console.error('[admin] save contact method failed:', error);
    return { status: 'error', message: '保存失败，请稍后重试。' };
  }

  revalidatePath('/', 'layout');
  return { status: 'success', message: '联系方式已保存，前台已更新。' };
}

export async function deleteContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAdminOrError();
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const db = getPrisma();
  if (!db) return DB_UNAVAILABLE_STATE;

  try {
    await db.contactMethod.delete({ where: { id: parsed.data.id } });
  } catch (error) {
    console.error('[admin] delete contact method failed:', error);
    return { status: 'error', message: '删除失败，该记录可能已不存在。' };
  }

  await writeAudit({
    userId: user.id,
    actorEmail: user.email,
    action: 'DELETE',
    targetType: 'ContactMethod',
    targetId: parsed.data.id,
    summary: '删除联系方式',
  });

  revalidatePath('/', 'layout');
  return { status: 'success', message: '联系方式已删除。' };
}
