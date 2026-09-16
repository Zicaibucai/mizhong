import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { requireAdminPage } from '@/lib/auth/session';
import { tryDb } from '@/lib/db';
import { adminDateLocale, formatMessage, getAdminMessagesForRequest } from '@/lib/admin/i18n';
import { SLOT_OPTIONS } from '@/lib/media';
import { Alert } from '@/components/admin/form';
import { MediaThumb } from '@/components/admin/media/media-thumb';
import { formatFileSize, pickLocalizedText } from '@/components/admin/media/utils';
import { MediaFilters } from './media-filters';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 24;
const TYPE_FILTERS = ['all', 'image', 'video'] as const;
const SORT_OPTIONS_LIST = ['newest', 'oldest', 'name'] as const;

type TypeFilter = (typeof TYPE_FILTERS)[number];
type SortOption = (typeof SORT_OPTIONS_LIST)[number];

/** 查询参数可能是数组，统一取第一个值 */
function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();
  const { locale, t } = await getAdminMessagesForRequest();
  const params = await searchParams;

  const q = firstParam(params.q).trim();

  const typeParam = firstParam(params.type);
  const type: TypeFilter = (TYPE_FILTERS as readonly string[]).includes(typeParam)
    ? (typeParam as TypeFilter)
    : 'all';

  const slotParam = firstParam(params.slot);
  const bindableSlots = SLOT_OPTIONS.map((option) => option.value as string);
  const slot =
    slotParam === 'unbound' || bindableSlots.includes(slotParam) ? slotParam : 'all';

  const sortParam = firstParam(params.sort);
  const sort: SortOption = (SORT_OPTIONS_LIST as readonly string[]).includes(sortParam)
    ? (sortParam as SortOption)
    : 'newest';

  const pageParam = Number.parseInt(firstParam(params.page), 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const where: Prisma.AssetWhereInput = {};
  if (q) {
    where.OR = [
      { originalName: { contains: q, mode: 'insensitive' } },
      { translations: { some: { title: { contains: q, mode: 'insensitive' } } } },
    ];
  }
  if (type !== 'all') where.type = type === 'image' ? 'IMAGE' : 'VIDEO';
  if (slot === 'unbound') where.slots = { none: {} };
  else if (slot !== 'all') where.slots = { some: { slot } };

  const orderBy: Prisma.AssetOrderByWithRelationInput[] =
    sort === 'oldest' ? [{ createdAt: 'asc' }] : sort === 'name' ? [{ originalName: 'asc' }] : [{ createdAt: 'desc' }];

  const result = await tryDb(async (db) => {
    const [rows, total] = await Promise.all([
      db.asset.findMany({
        where,
        orderBy,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { translations: true, slots: { orderBy: [{ position: 'asc' }] } },
      }),
      db.asset.count({ where }),
    ]);
    return { rows, total };
  });

  const rows = result?.rows ?? [];
  const total = result?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(q) || type !== 'all' || slot !== 'all';

  const dateFormat = new Intl.DateTimeFormat(adminDateLocale(locale), { dateStyle: 'medium' });

  const baseParams = new URLSearchParams();
  if (q) baseParams.set('q', q);
  if (type !== 'all') baseParams.set('type', type);
  if (slot !== 'all') baseParams.set('slot', slot);
  if (sort !== 'newest') baseParams.set('sort', sort);
  const pageHref = (target: number) => {
    const next = new URLSearchParams(baseParams);
    if (target > 1) next.set('page', String(target));
    const query = next.toString();
    return query ? `/admin/media?${query}` : '/admin/media';
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-navy-900">{t.media.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.media.subtitle}</p>
        </div>
        <Link
          href="/admin/media/new"
          className="inline-flex h-10 items-center justify-center rounded-full bg-navy-900 px-5 text-sm font-medium text-ivory-50 transition-colors hover:bg-navy-800"
        >
          {t.media.uploadNew}
        </Link>
      </header>

      {result === null ? <Alert kind="error">{t.media.dbUnavailable}</Alert> : null}

      <MediaFilters
        q={q}
        type={type}
        slot={slot}
        sort={sort}
        slotOptions={SLOT_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{formatMessage(t.media.total, { count: total })}</p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-navy-200 bg-white px-5 py-6 text-sm text-muted">
          {hasFilters ? t.media.emptyFiltered : t.media.empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-navy-200 bg-white">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-navy-100 bg-navy-50/60 text-xs uppercase tracking-wide text-navy-600">
              <tr>
                <th className="px-5 py-3 font-medium">{t.media.colPreview}</th>
                <th className="px-5 py-3 font-medium">{t.media.colName}</th>
                <th className="px-5 py-3 font-medium">{t.media.colType}</th>
                <th className="px-5 py-3 font-medium">{t.media.colSize}</th>
                <th className="px-5 py-3 font-medium">{t.media.colSlots}</th>
                <th className="px-5 py-3 font-medium">{t.media.colStatus}</th>
                <th className="px-5 py-3 font-medium">{t.media.colUpdated}</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {rows.map((asset) => {
                const name =
                  pickLocalizedText(asset.translations, 'title', locale) ||
                  asset.originalName ||
                  asset.key;
                const typeLabel = asset.type === 'VIDEO' ? t.media.filterVideos : t.media.filterImages;

                return (
                  <tr key={asset.id}>
                    <td className="px-5 py-3">
                      <MediaThumb
                        type={asset.type}
                        url={asset.url}
                        thumbnailUrl={asset.thumbnailUrl}
                        posterUrl={asset.posterUrl}
                        alt={name}
                        fallbackLabel={typeLabel}
                        className="h-12 w-12"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <span className="block font-medium text-navy-900">{name}</span>
                      <span className="block font-mono text-xs text-navy-500">{asset.mimeType}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-navy-100 px-2.5 py-0.5 text-xs text-navy-700">
                        {typeLabel}
                      </span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-navy-600">
                      {formatFileSize(asset.size)}
                    </td>
                    <td className="px-5 py-3">
                      {asset.slots.length === 0 ? (
                        <span className="text-xs text-muted">—</span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {asset.slots.map((binding) => (
                            <span
                              key={binding.id}
                              className="rounded-full bg-copper-100 px-2 py-0.5 font-mono text-[11px] text-copper-800"
                            >
                              {binding.slot}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={
                          asset.enabled
                            ? 'rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700'
                            : 'rounded-full bg-navy-100 px-2.5 py-0.5 text-xs text-navy-600'
                        }
                      >
                        {asset.enabled ? t.media.enabled : t.media.disabled}
                      </span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-navy-600">
                      {dateFormat.format(asset.updatedAt)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/admin/media/${asset.id}`}
                        className="text-sm text-copper-700 hover:underline"
                      >
                        {t.media.edit}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 ? (
        <nav className="flex items-center justify-center gap-3">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              aria-label={String(page - 1)}
              className="inline-flex h-9 items-center justify-center rounded-full border border-navy-300 px-4 text-sm text-navy-900 hover:bg-navy-50"
            >
              ←
            </Link>
          ) : null}
          <span className="text-sm text-muted">
            {page} / {pageCount}
          </span>
          {page < pageCount ? (
            <Link
              href={pageHref(page + 1)}
              aria-label={String(page + 1)}
              className="inline-flex h-9 items-center justify-center rounded-full border border-navy-300 px-4 text-sm text-navy-900 hover:bg-navy-50"
            >
              →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
