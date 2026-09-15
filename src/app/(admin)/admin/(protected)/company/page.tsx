import { requireAdminPage } from '@/lib/auth/session';
import { getSiteContent } from '@/lib/content';
import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';
import { getAdminMessagesForRequest } from '@/lib/admin/i18n';
import { CompanyForm, type CompanyValues } from './company-form';

export const dynamic = 'force-dynamic';

export default async function AdminCompanyPage() {
  await requireAdminPage();
  const { t } = await getAdminMessagesForRequest();

  const values = {} as Record<AdminLocale, CompanyValues>;
  for (const locale of ADMIN_LOCALES) {
    const content = await getSiteContent(locale);
    values[locale] = {
      name: content.company.name,
      tagline: content.company.tagline,
      about: content.company.about,
      positioning: content.company.positioning,
      address: content.company.address,
      businessHours: content.company.businessHours,
      seoTitle: content.company.seoTitle,
      seoDescription: content.company.seoDescription,
    };
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-navy-900">{t.company.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.company.subtitle}</p>
      </header>
      <CompanyForm values={values} />
    </div>
  );
}
