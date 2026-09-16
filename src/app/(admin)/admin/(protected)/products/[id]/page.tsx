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
  SpecRowData,
} from '@/components/admin/products/types';
import { decimalToString, normalizeCurrency } from '@/lib/pricing';
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

  const [product, categoryRows, coverAssets, videoAssets, galleryAssets] = await Promise.all([
    tryDb((db) =>
      db.product.findUnique({
        where: { id },
        include: {
          translations: true,
          media: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            include: { asset: { include: { translations: true } } },
          },
          specifications: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            include: { translations: true },
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
    loadLibraryAssets(['VIDEO'], locale),
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
      sizeSummary: row?.sizeSummary ?? '',
      spec: row?.spec ?? '',
      application: row?.application ?? '',
      seoTitle: row?.seoTitle ?? '',
      seoDescription: row?.seoDescription ?? '',
    };
  }

  // 结构化参数：每种语言的名称 / 值都摊平成字符串，缺语言的行留空由编辑器补
  const specifications: SpecRowData[] = product.specifications.map((row) => {
    const values = {} as SpecRowData['values'];
    for (const target of ADMIN_LOCALES) {
      const tr = row.translations.find((item) => item.locale === target);
      values[target] = { name: tr?.name ?? '', value: tr?.value ?? '' };
    }
    return { key: row.id, id: row.id, values };
  });

  const media: GalleryItemData[] = product.media.map((row) => ({
    id: row.id,
    assetId: row.assetId,
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
      hoverVideoAssetId: product.hoverVideoAssetId,
      priceMode: product.priceMode,
      currency: normalizeCurrency(product.currency),
      // Decimal 一律转字符串：客户端不做金额运算，也不会遇到浮点精度问题
      priceMin: decimalToString(product.priceMin) ?? '',
      priceMax: decimalToString(product.priceMax) ?? '',
      priceUnit: product.priceUnit ?? '',
      moq: product.moq === null ? '' : String(product.moq),
      moqUnit: product.moqUnit ?? '',
    },
    translations,
    specifications,
    categories: (categoryRows ?? []).map((row) => ({
      id: row.id,
      name:
        row.translations.find((item) => item.locale === locale)?.name ||
        row.translations.find((item) => item.locale === 'en')?.name ||
        row.slug,
    })),
    coverAssets,
    videoAssets,
    galleryAssets,
    media,
    // 指向草稿预览路由：未发布商品在正式详情页会 404，而「预览产品」的意义正是看草稿
    previewHref: `/${defaultLocale}/products/${encodeURIComponent(product.slug)}/preview`,
  };

  return <ProductEditor data={data} />;
}
