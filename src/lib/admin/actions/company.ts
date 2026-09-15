'use server';

import { revalidatePath } from 'next/cache';
import { getPrisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { requireAdminOrError, DB_UNAVAILABLE_STATE } from '@/lib/admin/guard';
import { ADMIN_LOCALES, companyTranslationSchema, parseLocaleFields } from '@/lib/admin/validation';
import type { FormState } from '@/lib/admin/action-state';

export async function saveCompanyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAdminOrError();
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const payload: Record<string, ReturnType<typeof companyTranslationSchema.parse>> = {};
  for (const locale of ADMIN_LOCALES) {
    const parsed = parseLocaleFields(companyTranslationSchema, locale, formData);
    if (!parsed.ok) return { status: 'error', message: parsed.message };
    payload[locale] = parsed.data;
  }

  const db = getPrisma();
  if (!db) return DB_UNAVAILABLE_STATE;

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
    return { status: 'error', message: '保存失败，请稍后重试。' };
  }

  await writeAudit({
    userId: user.id,
    actorEmail: user.email,
    action: 'UPDATE',
    targetType: 'CompanyProfile',
    targetId: 'primary',
    summary: '更新公司资料',
  });

  revalidatePath('/', 'layout');
  return { status: 'success', message: '公司资料已保存，前台已更新。' };
}
