'use server';

import { revalidatePath } from 'next/cache';
import { getPrisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { getDbUnavailableState, requireAdminOrError } from '@/lib/admin/guard';
import {
  ADMIN_LOCALES,
  makeContactBaseSchema,
  makeContactTranslationSchema,
  makeIdSchema,
  parseForm,
  parseLocaleFields,
  type AdminLocale,
} from '@/lib/admin/validation';
import { getAdminMessagesForRequest } from '@/lib/admin/i18n';
import type { FormState } from '@/lib/admin/action-state';

export async function saveContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const base = parseForm(makeContactBaseSchema(t), formData, t);
  if (!base.ok) return { status: 'error', message: base.message };

  const translationSchema = makeContactTranslationSchema();
  const translations: { locale: AdminLocale; label: string; value: string }[] = [];
  for (const locale of ADMIN_LOCALES) {
    const parsed = parseLocaleFields(translationSchema, locale, formData, t);
    if (!parsed.ok) return { status: 'error', message: parsed.message };
    translations.push({ locale, ...parsed.data });
  }

  const hasAnyValue =
    base.data.value.trim().length > 0 || translations.some((item) => item.value.trim().length > 0);
  if (!hasAnyValue) {
    return { status: 'error', message: t.actions.contactNeedsValue };
  }

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

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
      summary: base.data.id
        ? t.auditSummaries.contactUpdated
        : t.auditSummaries.contactCreated,
    });
  } catch (error) {
    console.error('[admin] save contact method failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePath('/', 'layout');
  return { status: 'success', message: t.actions.contactSaved };
}

export async function deleteContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const parsed = parseForm(makeIdSchema(t), formData, t);
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    await db.contactMethod.delete({ where: { id: parsed.data.id } });
  } catch (error) {
    console.error('[admin] delete contact method failed:', error);
    return { status: 'error', message: t.actions.deleteFailed };
  }

  await writeAudit({
    userId: user.id,
    actorEmail: user.email,
    action: 'DELETE',
    targetType: 'ContactMethod',
    targetId: parsed.data.id,
    summary: t.auditSummaries.contactDeleted,
  });

  revalidatePath('/', 'layout');
  return { status: 'success', message: t.actions.contactDeleted };
}
