import { tryDb } from '@/lib/db';
import type { AdminLocale } from '@/lib/admin/validation';
import type { PickerAsset } from './asset-picker';

type AssetType = 'IMAGE' | 'VIDEO';

interface AssetRow {
  id: string;
  type: AssetType;
  url: string;
  thumbnailUrl: string | null;
  posterUrl: string | null;
  originalName: string | null;
  key: string;
  translations: { locale: AdminLocale; title: string | null }[];
}

/** Human-readable label for a library asset: admin-language title → English → file name → key. */
export function assetLabel(row: AssetRow, locale: AdminLocale): string {
  const title =
    row.translations.find((item) => item.locale === locale)?.title ||
    row.translations.find((item) => item.locale === 'en')?.title ||
    null;
  if (title) return title;
  if (row.originalName) return row.originalName;
  return row.key.split('/').pop() ?? row.key;
}

/**
 * Loads media-library assets for the cover / gallery pickers.
 *
 * Disabled assets are never offered, and a database hiccup degrades to an empty library instead
 * of breaking the screen (matching the rest of the admin's read paths).
 */
export async function loadLibraryAssets(
  types: AssetType[],
  locale: AdminLocale,
): Promise<PickerAsset[]> {
  const rows = await tryDb((db) =>
    db.asset.findMany({
      where: { enabled: true, type: { in: types } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { translations: true },
    }),
  );

  if (!rows) return [];

  return rows.map((row) => ({
    id: row.id,
    url: row.url,
    thumbnailUrl: row.thumbnailUrl,
    posterUrl: row.posterUrl,
    type: row.type,
    name: assetLabel(row, locale),
  }));
}
