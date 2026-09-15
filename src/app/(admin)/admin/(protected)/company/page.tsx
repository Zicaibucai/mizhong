import { requireAdminPage } from '@/lib/auth/session';
import { getSiteContent } from '@/lib/content';
import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';
import { CompanyForm, type CompanyValues } from './company-form';

export const dynamic = 'force-dynamic';

export default async function AdminCompanyPage() {
  await requireAdminPage();

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
        <h1 className="text-xl font-semibold tracking-tight text-navy-900">公司资料</h1>
        <p className="mt-1 text-sm text-muted">
          三种语言的公司名称、简介、业务定位、地址、营业时间与默认 SEO。保存后前台立即生效。
        </p>
      </header>
      <CompanyForm values={values} />
    </div>
  );
}
