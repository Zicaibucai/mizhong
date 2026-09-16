import { requireAdminPage } from '@/lib/auth/session';
import { tryDb } from '@/lib/db';
import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';
import { formatMessage, getAdminMessagesForRequest } from '@/lib/admin/i18n';
import { Alert } from '@/components/admin/form';
import { loadLibraryAssets } from '@/components/admin/products/asset-library';
import { CategoryForm, type CategoryValues } from './category-form';
import { CategoryDeleteForm } from './category-delete-form';

export const dynamic = 'force-dynamic';

interface TranslationRow {
  locale: AdminLocale;
  name: string;
}

/** Translation for the admin UI language, falling back to English (then the raw slug). */
function pickName(rows: TranslationRow[], locale: AdminLocale, fallback: string): string {
  return (
    rows.find((row) => row.locale === locale)?.name ||
    rows.find((row) => row.locale === 'en')?.name ||
    rows.find((row) => row.locale === 'zh')?.name ||
    fallback
  );
}

export default async function AdminProductCategoriesPage() {
  await requireAdminPage();
  const { locale, t } = await getAdminMessagesForRequest();

  const [rows, productRows, images] = await Promise.all([
    tryDb((db) =>
      db.productCategory.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          translations: true,
          coverAsset: true,
          _count: { select: { products: true } },
        },
      }),
    ),
    tryDb((db) =>
      db.product.findMany({
        where: { categoryId: { not: null } },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          slug: true,
          categoryId: true,
          translations: { select: { locale: true, name: true } },
        },
      }),
    ),
    loadLibraryAssets(['IMAGE'], locale),
  ]);

  const categories: (CategoryValues & { id: string; productCount: number; coverUrl: string | null })[] =
    (rows ?? []).map((row) => {
      const translations = {} as CategoryValues['translations'];
      for (const target of ADMIN_LOCALES) {
        const tr = row.translations.find((item) => item.locale === target);
        translations[target] = { name: tr?.name ?? '', description: tr?.description ?? '' };
      }
      return {
        id: row.id,
        slug: row.slug,
        sortOrder: row.sortOrder,
        enabled: row.enabled,
        coverAssetId: row.coverAssetId,
        productCount: row._count.products,
        coverUrl: row.coverAsset?.thumbnailUrl ?? row.coverAsset?.url ?? null,
        translations,
      };
    });

  const productsByCategory = new Map<string, { id: string; name: string }[]>();
  for (const product of productRows ?? []) {
    if (!product.categoryId) continue;
    const list = productsByCategory.get(product.categoryId) ?? [];
    list.push({
      id: product.id,
      name: pickName(product.translations, locale, product.slug),
    });
    productsByCategory.set(product.categoryId, list);
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-navy-900">
          {t.productCategories.title}
        </h1>
        <p className="mt-1 text-sm text-muted">{t.productCategories.subtitle}</p>
      </header>

      {rows === null ? <Alert kind="error">{t.productCategories.dbUnavailable}</Alert> : null}

      <section className="space-y-4">
        {categories.length === 0 ? (
          <p className="rounded-xl border border-dashed border-navy-200 bg-white px-5 py-6 text-sm text-muted">
            {t.productCategories.empty}
          </p>
        ) : (
          categories.map((category) => {
            const products = productsByCategory.get(category.id) ?? [];
            const targets = categories
              .filter((item) => item.id !== category.id)
              .map((item) => ({
                id: item.id,
                name: pickName(
                  ADMIN_LOCALES.map((code) => ({
                    locale: code,
                    name: item.translations[code].name,
                  })),
                  locale,
                  item.slug,
                ),
              }));

            return (
              <details key={category.id} className="rounded-xl border border-navy-200 bg-white">
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5 text-sm">
                  {category.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 素材来自 OSS 动态域名，接入 next/image remotePatterns 后统一替换
                    <img
                      src={category.coverUrl}
                      alt=""
                      className="h-9 w-9 rounded-md border border-navy-200 object-cover"
                    />
                  ) : null}
                  <span className="font-medium text-navy-900">
                    {pickName(
                      ADMIN_LOCALES.map((code) => ({
                        locale: code,
                        name: category.translations[code].name,
                      })),
                      locale,
                      category.slug,
                    )}
                  </span>
                  <span className="font-mono text-xs text-navy-500">{category.slug}</span>
                  <span className="text-xs text-muted">
                    {formatMessage(t.products.total, { count: category.productCount })}
                  </span>
                  <span
                    className={
                      category.enabled
                        ? 'ml-auto rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700'
                        : 'ml-auto rounded-full bg-navy-100 px-2.5 py-0.5 text-xs text-navy-600'
                    }
                  >
                    {category.enabled ? t.common.enabled : t.common.disabled}
                  </span>
                  <span className="text-xs text-muted">
                    {formatMessage(t.common.orderValue, { order: category.sortOrder })}
                  </span>
                </summary>

                <div className="space-y-5 border-t border-navy-100 px-5 py-5">
                  <CategoryForm
                    category={category}
                    assets={images}
                    submitLabel={t.common.saveChanges}
                  />
                  <div className="border-t border-navy-100 pt-4">
                    <CategoryDeleteForm
                      id={category.id}
                      products={products}
                      targets={targets}
                    />
                  </div>
                </div>
              </details>
            );
          })
        )}
      </section>

      <section className="rounded-xl border border-navy-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-navy-900">{t.productCategories.newTitle}</h2>
        <div className="mt-4">
          <CategoryForm assets={images} submitLabel={t.productCategories.save} />
        </div>
      </section>
    </div>
  );
}
