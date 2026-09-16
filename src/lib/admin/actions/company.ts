'use server';

import { revalidatePublicSite } from '@/lib/admin/revalidate';
import { getPrisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { getDbUnavailableState, requireAdminOrError } from '@/lib/admin/guard';
import {
  ADMIN_LOCALES,
  makeCompanyTranslationSchema,
  parseLocaleFields,
  type CompanyTranslationInput,
} from '@/lib/admin/validation';
import { getAdminMessagesForRequest } from '@/lib/admin/i18n';
import type { FormState } from '@/lib/admin/action-state';

export async function saveCompanyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const schema = makeCompanyTranslationSchema(t);
  const payload: Record<string, CompanyTranslationInput> = {};
  for (const locale of ADMIN_LOCALES) {
    const parsed = parseLocaleFields(schema, locale, formData, t);
    if (!parsed.ok) return { status: 'error', message: parsed.message };
    payload[locale] = parsed.data;
  }

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const profile = await db.companyProfile.upsert({
      where: { slug: 'primary' },
      update: {},
      create: { slug: 'primary' },
    });

    for (const locale of ADMIN_LOCALES) {
      const data = payload[locale];
      await db.companyProfileTranslation.upsert({
        where: { profileId_locale: { profileId: profile.id, locale } },
        update: data,
        create: { profileId: profile.id, locale, ...data },
      });
    }
  } catch (error) {
    console.error('[admin] save company profile failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  await writeAudit({
    userId: user.id,
    actorEmail: user.email,
    action: 'UPDATE',
    targetType: 'CompanyProfile',
    targetId: 'primary',
    summary: t.auditSummaries.companyProfileUpdated,
  });

  // 三语正式首页、页头页脚、metadata 与设计预览立即刷新，不需要等 ISR 到期
  revalidatePublicSite();
  return { status: 'success', message: t.actions.companySaved };
}
