import Link from 'next/link';
import { requireAdminPage } from '@/lib/auth/session';
import { tryDb } from '@/lib/db';
import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';
import { getAdminMessagesForRequest } from '@/lib/admin/i18n';
import { Alert } from '@/components/admin/form';
import { assetLabel, loadLibraryAssets } from '@/components/admin/products/asset-library';
import { ProductEditor } from '@/components/admin/products/product-editor';
import type { GalleryItemData } from '@/components/admin/products/gallery-editor';
import type {
  ProductEditorData,
  ProductTranslationValues,
} from '@/components/admin/products/types';
import { defaultLocale } from '@/lib/i18n/config';

export const dynamic = 'force-dynamic';

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const { locale, t } = await getAdminMessagesForRequest();

  const [product, categoryRows, coverAssets, galleryAssets] = await Promise.all([
    tryDb((db) =>
      db.product.findUnique({
        where: { id },
        include: {
          translations: true,
          media: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            include: { asset: { include: { translations: true } } },
          },
        },
      }),
    ),
    tryDb((db) =>
      db.productCategory.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, slug: true, translations: { select: { locale: true, name: true } } },
      }),
    ),
    loadLibraryAssets(['IMAGE'], locale),
    loadLibraryAssets(['IMAGE', 'VIDEO'], locale),
  ]);

  if (product === null) {
    return (
      <div className="space-y-4">
        <Alert kind="error">{t.products.dbUnavailable}</Alert>
        <Link href="/admin/products" className="text-sm text-copper-700 hover:underline">
          ← {t.products.title}
        </Link>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-4">
        <Alert kind="error">{t.products.notFound}</Alert>
        <Link href="/admin/products" className="text-sm text-copper-700 hover:underline">
          ← {t.products.title}
        </Link>
      </div>
    );
  }

  const translations = {} as Record<AdminLocale, ProductTranslationValues>;
  for (const target of ADMIN_LOCALES) {
    const row = product.translations.find((item) => item.locale === target);
    translations[target] = {
      name: row?.name ?? '',
      shortDescription: row?.shortDescription ?? '',
      description: row?.description ?? '',
      spec: row?.spec ?? '',
      application: row?.application ?? '',
      seoTitle: row?.seoTitle ?? '',
      seoDescription: row?.seoDescription ?? '',
    };
  }

  const media: GalleryItemData[] = product.media.map((row) => ({
    id: row.id,
    role: row.role,
    type: row.asset.type,
    url: row.asset.url,
    thumbnailUrl: row.asset.thumbnailUrl,
    posterUrl: row.asset.posterUrl,
    name: assetLabel(row.asset, locale),
  }));

  const data: ProductEditorData = {
    product: {
      id: product.id,
      slug: product.slug,
      sku: product.sku ?? '',
      categoryId: product.categoryId,
      featured: product.featured,
      published: product.published,
      sortOrder: product.sortOrder,
      coverAssetId: product.coverAssetId,
    },
    translations,
    categories: (categoryRows ?? []).map((row) => ({
      id: row.id,
      name:
        row.translations.find((item) => item.locale === locale)?.name ||
        row.translations.find((item) => item.locale === 'en')?.name ||
        row.slug,
    })),
    coverAssets,
    galleryAssets,
    media,
    previewHref: `/${defaultLocale}/products/${encodeURIComponent(product.slug)}`,
  };

  return <ProductEditor data={data} />;
}
