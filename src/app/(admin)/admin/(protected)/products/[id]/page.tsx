import Link from 'next/link';
import { requireAdminPage } from '@/lib/auth/session';
import { tryDb } from '@/lib/db';
import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';
import { getAdminMessagesForRequest } from '@/lib/admin/i18n';
import { loadProductDraftState } from '@/lib/admin/product-draft-store';
import { changedSections, validateForPublish, type ProductDraft } from '@/lib/product-draft';
import { formatPrice } from '@/lib/product-format';
import { Alert } from '@/components/admin/form';
import { assetLabel, loadLibraryAssets } from '@/components/admin/products/asset-library';
import { ProductEditor } from '@/components/admin/products/product-editor';
import type { GalleryItemData } from '@/components/admin/products/gallery-editor';
import type {
  ProductEditorData,
  ProductTranslationValues,
  ProductVersionData,
  SpecRowData,
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

  /**
   * 编辑器读的是**正在编辑的内容**（有草稿就是草稿，没有就是线上内容）。
   *
   * `live` 也一并取回，用来算「有哪几块改动待发布」—— 这是管理员在顶部看到的提示，
   * 也是「草稿与线上确实不同」这件事唯一的判断依据。
   */
  const [state, categoryRows, coverAssets, videoAssets, galleryAssets] = await Promise.all([
    tryDb((db) => loadProductDraftState(db, id)),
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

  if (state === null) {
    return (
      <div className="space-y-4">
        <Alert kind="error">{t.products.dbUnavailable}</Alert>
        <Link href="/admin/products" className="text-sm text-copper-700 hover:underline">
          ← {t.products.title}
        </Link>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="space-y-4">
        <Alert kind="error">{t.products.notFound}</Alert>
        <Link href="/admin/products" className="text-sm text-copper-700 hover:underline">
          ← {t.products.title}
        </Link>
      </div>
    );
  }

  const { draft, live, hasDraft, published, draftUpdatedAt } = state;

  // 草稿里的图库只是一串素材 id，缩略图要回素材表取。
  // 刻意**不做 enabled 过滤**：被停用的素材仍要显示出来，否则媒体页上再也点不到、清不掉。
  const mediaAssetIds = [...new Set(draft.media.map((item) => item.assetId))];
  const mediaAssets =
    mediaAssetIds.length > 0
      ? await tryDb((db) =>
          db.asset.findMany({
            where: { id: { in: mediaAssetIds } },
            include: { translations: true },
          }),
        )
      : [];
  const assetById = new Map((mediaAssets ?? []).map((asset) => [asset.id, asset]));

  const versions = await tryDb((db) =>
    db.productVersion.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        kind: true,
        note: true,
        snapshot: true,
        createdAt: true,
        createdBy: { select: { email: true, name: true } },
      },
    }),
  );

  const translations = {} as Record<AdminLocale, ProductTranslationValues>;
  for (const target of ADMIN_LOCALES) {
    translations[target] = { ...draft.translations[target] };
  }

  const specifications: SpecRowData[] = draft.specs.map((row, index) => ({
    // 草稿里的新增行还没有主键，用下标做一个稳定的 React key
    key: row.id ?? `draft-${index}`,
    id: row.id,
    values: row.values,
  }));

  const media: GalleryItemData[] = draft.media.flatMap((item) => {
    const asset = assetById.get(item.assetId);
    if (!asset) return [];
    return [
      {
        assetId: item.assetId,
        role: item.role,
        type: asset.type,
        url: asset.url,
        thumbnailUrl: asset.thumbnailUrl,
        posterUrl: asset.posterUrl,
        name: assetLabel(asset, locale),
      },
    ];
  });

  const blockers = validateForPublish(draft, {
    slugRequired: t.validation.slugRequired,
    slugFormat: t.products.validationSlug,
    nameRequired: t.products.validationName,
    nameRequiredForLocale: t.products.nameCannotBeCleared,
    coverRequired: t.products.validationCover,
    priceMinRequired: t.products.priceMinRequired,
    priceRangeInvalid: t.products.priceRangeInvalid,
  });

  const versionRows: ProductVersionData[] = (versions ?? []).map((row) => {
    const snapshot = row.snapshot as unknown as ProductDraft | null;
    return {
      id: row.id,
      kind: row.kind,
      createdAt: row.createdAt.toISOString(),
      note: row.note,
      createdBy: row.createdBy?.name || row.createdBy?.email || null,
      snapshotName: snapshotName(snapshot),
      snapshotPrice: snapshotPrice(snapshot, locale),
    };
  });

  const data: ProductEditorData = {
    product: {
      id,
      slug: draft.basic.slug,
      sku: draft.basic.sku,
      categoryId: draft.basic.categoryId,
      featured: draft.basic.featured,
      published,
      sortOrder: draft.basic.sortOrder,
      coverAssetId: draft.basic.coverAssetId,
      hoverVideoAssetId: draft.basic.hoverVideoAssetId,
      priceMode: draft.pricing.priceMode,
      currency: draft.pricing.currency as ProductEditorData['product']['currency'],
      priceMin: draft.pricing.priceMin ?? '',
      priceMax: draft.pricing.priceMax ?? '',
      priceUnit: draft.pricing.priceUnit ?? '',
      moq: draft.pricing.moq === null ? '' : String(draft.pricing.moq),
      moqUnit: draft.pricing.moqUnit ?? '',
    },
    translations,
    specifications,
    specTable: draft.specTable,
    variantGroups: draft.variantGroups,
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
    previewHref: `/${defaultLocale}/products/${encodeURIComponent(draft.basic.slug)}/preview`,
    pendingChanges: hasDraft ? changedSections(draft, live) : [],
    publishBlockers: blockers.ok ? [] : [blockers.message],
    versions: versionRows,
    draftUpdatedAt: draftUpdatedAt?.toISOString() ?? null,
  };

  return <ProductEditor data={data} />;
}

/** 版本列表里显示的产品名：优先中文，其次英文，最后随便取一个非空的 */
function snapshotName(snapshot: ProductDraft | null): string {
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.translations) return '';
  for (const target of ['zh', 'en', 'vi'] as const) {
    const name = snapshot.translations[target]?.name?.trim();
    if (name) return name;
  }
  return '';
}

/**
 * 版本列表里显示的价格摘要。
 *
 * 直接复用前台的 `formatPrice`（草稿的 pricing 与它的入参形状一致），
 * 所以「面议 / 固定价 / 区间价」的写法与客人看到的一模一样，不会两处跑偏。
 */
function snapshotPrice(snapshot: ProductDraft | null, locale: AdminLocale): string {
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.pricing) return '';
  return formatPrice(snapshot.pricing, locale);
}
