import Link from 'next/link';
import { requireAdminPage } from '@/lib/auth/session';
import { tryDb } from '@/lib/db';
import { getAdminMessagesForRequest } from '@/lib/admin/i18n';
import { Alert } from '@/components/admin/form';
import { NewProductForm } from './new-product-form';

export const dynamic = 'force-dynamic';

export default async function AdminNewProductPage() {
  await requireAdminPage();
  const { locale, t } = await getAdminMessagesForRequest();

  const rows = await tryDb((db) =>
    db.productCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, slug: true, translations: { select: { locale: true, name: true } } },
    }),
  );

  const categories = (rows ?? []).map((row) => ({
    id: row.id,
    name:
      row.translations.find((item) => item.locale === locale)?.name ||
      row.translations.find((item) => item.locale === 'en')?.name ||
      row.slug,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/products" className="text-sm text-copper-700 hover:underline">
          ← {t.products.title}
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-navy-900">
          {t.products.newTitle}
        </h1>
      </div>

      {rows === null ? <Alert kind="error">{t.products.dbUnavailable}</Alert> : null}

      <section className="rounded-xl border border-navy-200 bg-white p-5">
        <NewProductForm categories={categories} />
      </section>
    </div>
  );
}
