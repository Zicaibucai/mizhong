'use server';

import { revalidatePath } from 'next/cache';
import { getPrisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { getDbUnavailableState, requireAdminOrError } from '@/lib/admin/guard';
import {
  ADMIN_LOCALES,
  makeIdSchema,
  makeNavBaseSchema,
  makeNavTranslationSchema,
  parseForm,
  parseLocaleFields,
  type AdminLocale,
} from '@/lib/admin/validation';
import { getAdminMessagesForRequest } from '@/lib/admin/i18n';
import type { FormState } from '@/lib/admin/action-state';

export async function saveNavAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const base = parseForm(makeNavBaseSchema(t), formData, t);
  if (!base.ok) return { status: 'error', message: base.message };

  const translationSchema = makeNavTranslationSchema();
  const translations: { locale: AdminLocale; label: string }[] = [];
  for (const locale of ADMIN_LOCALES) {
    const parsed = parseLocaleFields(translationSchema, locale, formData, t);
    if (!parsed.ok) return { status: 'error', message: parsed.message };
    translations.push({ locale, label: parsed.data.label });
  }

  if (!translations.some((item) => item.label.trim().length > 0)) {
    return { status: 'error', message: t.actions.navNeedsLabel };
  }

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

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
      summary: base.data.id ? t.auditSummaries.navUpdated : t.auditSummaries.navCreated,
    });
  } catch (error) {
    console.error('[admin] save nav item failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePath('/', 'layout');
  return { status: 'success', message: t.actions.navSaved };
}

export async function deleteNavAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const parsed = parseForm(makeIdSchema(t), formData, t);
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    await db.navItem.delete({ where: { id: parsed.data.id } });
  } catch (error) {
    console.error('[admin] delete nav item failed:', error);
    return { status: 'error', message: t.actions.deleteFailed };
  }

  await writeAudit({
    userId: user.id,
    actorEmail: user.email,
    action: 'DELETE',
    targetType: 'NavItem',
    targetId: parsed.data.id,
    summary: t.auditSummaries.navDeleted,
  });

  revalidatePath('/', 'layout');
  return { status: 'success', message: t.actions.navDeleted };
}
