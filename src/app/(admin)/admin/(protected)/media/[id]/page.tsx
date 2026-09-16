import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/auth/session';
import { tryDb } from '@/lib/db';
import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';
import { getAdminMessagesForRequest } from '@/lib/admin/i18n';
import { SLOT_OPTIONS } from '@/lib/media';
import { Alert } from '@/components/admin/form';
import { collectAssetReferences } from '@/components/admin/media/asset-references';
import {
  formatDimensions,
  formatFileSize,
  pickLocalizedText,
} from '@/components/admin/media/utils';
import { AssetTranslationsForm, type AssetTranslationValues } from './asset-translations-form';
import { AssetStatusForm } from './asset-status-form';
import { AssetSlotSection } from './asset-slot-section';
import { AssetFileTools } from './asset-file-tools';
import { AssetDeleteForm } from './asset-delete-form';

export const dynamic = 'force-dynamic';

export default async function AdminMediaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const { locale, t } = await getAdminMessagesForRequest();

  const asset = await tryDb((db) =>
    db.asset.findUnique({
      where: { id },
      include: {
        translations: true,
        slots: { orderBy: [{ position: 'asc' }] },
        // 删除前需要展示的引用关系
        productMedia: { include: { product: { include: { translations: true } } } },
        productCovers: { include: { translations: true } },
        categoryCovers: { include: { translations: true } },
      },
    }),
  );

  if (asset === null) {
    return (
      <div className="space-y-4">
        <Alert kind="error">{t.media.dbUnavailable}</Alert>
        <Link href="/admin/media" className="text-sm text-copper-700 hover:underline">
          ← {t.media.title}
        </Link>
      </div>
    );
  }

  if (!asset) notFound();

  const translations = {} as Record<AdminLocale, AssetTranslationValues>;
  for (const contentLocale of ADMIN_LOCALES) {
    const tr = asset.translations.find((item) => item.locale === contentLocale);
    translations[contentLocale] = {
      title: tr?.title ?? '',
      caption: tr?.caption ?? '',
      alt: tr?.alt ?? '',
    };
  }

  const displayName =
    pickLocalizedText(asset.translations, 'title', locale) || asset.originalName || asset.key;
  const kind = asset.type === 'VIDEO' ? ('video' as const) : ('image' as const);
  const typeLabel = kind === 'video' ? t.media.filterVideos : t.media.filterImages;
  const references = collectAssetReferences(asset, locale, t);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/media" className="text-sm text-copper-700 hover:underline">
          ← {t.media.title}
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-navy-900">{displayName}</h1>
        <p className="mt-1 text-sm text-muted">{t.media.detailSubtitle}</p>
      </div>

      <section className="rounded-xl border border-navy-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-navy-900">{t.media.fileSection}</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex items-start justify-center rounded-lg bg-navy-50 p-3">
            {kind === 'video' ? (
              <video
                src={asset.url}
                poster={asset.posterUrl ?? undefined}
                controls
                preload="metadata"
                className="max-h-72 w-full rounded-lg bg-navy-900"
              >
                {t.media.previewUnavailable}
              </video>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element -- 素材为 /media 静态资源，非 Next 优化资源 */
              <img
                src={asset.url}
                alt={displayName}
                className="max-h-72 rounded-lg object-contain"
              />
            )}
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <dt className="text-xs uppercase tracking-wide text-navy-500">{t.media.fileType}</dt>
              <dd className="mt-0.5 text-navy-900">
                {typeLabel}
                <span className="ml-2 font-mono text-xs text-muted">{asset.mimeType}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-navy-500">{t.media.fileSize}</dt>
              <dd className="mt-0.5 text-navy-900">{formatFileSize(asset.size)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-navy-500">
                {t.media.fileDimensions}
              </dt>
              <dd className="mt-0.5 text-navy-900">
                {formatDimensions(asset.width, asset.height)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-navy-500">{t.media.fileName}</dt>
              <dd className="mt-0.5 break-all text-navy-900">
                {asset.originalName ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-navy-500">{t.media.fileUrl}</dt>
              <dd className="mt-0.5">
                <a
                  href={asset.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-copper-700 hover:underline"
                >
                  {asset.url}
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="rounded-xl border border-navy-200 bg-white p-5">
        <AssetFileTools id={asset.id} type={kind} posterUrl={asset.posterUrl} />
      </section>

      <section className="rounded-xl border border-navy-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-navy-900">{t.media.translationsSection}</h2>
        <AssetTranslationsForm id={asset.id} translations={translations} />
      </section>

      <section className="rounded-xl border border-navy-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-navy-900">{t.media.slotsSection}</h2>
        <AssetSlotSection
          id={asset.id}
          bindings={asset.slots.map((binding) => ({ id: binding.id, slot: binding.slot }))}
          slotOptions={SLOT_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />
      </section>

      <section className="rounded-xl border border-navy-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-navy-900">{t.media.statusSection}</h2>
        <AssetStatusForm id={asset.id} enabled={asset.enabled} />
      </section>

      <section className="rounded-xl border border-red-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-red-800">{t.common.delete}</h2>
        <AssetDeleteForm id={asset.id} references={references} />
      </section>
    </div>
  );
}
