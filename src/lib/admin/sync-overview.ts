import type { PrismaClient } from '@prisma/client';
import { ADAPTERS, type ContentType } from '@/lib/translation/adapters';
import { planSync } from '@/lib/translation/state';

/**
 * 「语言同步」页的数据。
 *
 * 状态来自 `planSync` —— 与真正执行同步时用的是**同一个函数**。这一点很重要：
 * 如果这里另写一套「大概算一下」的判断，就会出现「列表说已同步、点同步却翻了一堆」
 * 或者反过来的情况，而这两种都会让管理员不再相信这个页面。
 */

export interface LocaleSyncRow {
  locale: string;
  /** synced / stale / partial / failed / empty */
  state: string;
  pendingCount: number;
  totalCount: number;
  translatedAt: string | null;
  error: string | null;
}

export interface SyncOverviewRow {
  entityType: string;
  entityId: string;
  label: string;
  hint?: string;
  revision: number;
  /** 中文自上次同步以来变过 */
  changed: boolean;
  syncedLocales: number;
  pendingLocales: number;
  failedLocales: number;
  totalLocales: number;
  lastSyncedAt: string | null;
  locales: LocaleSyncRow[];
  /** 对应的后台编辑页，点进去就能改中文 */
  editHref: string | null;
}

/** 每种内容类型对应的后台编辑页 */
function editHrefFor(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case 'product':
      return `/admin/products/${entityId}`;
    case 'page':
      return `/admin/pages/${entityId}`;
    case 'company':
      return '/admin/company';
    case 'contact':
      return '/admin/contacts';
    case 'nav':
      return '/admin/navigation';
    case 'category':
      return '/admin/product-categories';
    case 'asset':
      return `/admin/media/${entityId}`;
    default:
      return null;
  }
}

/**
 * 列出全部「已发布的中文内容」及各自的同步情况。
 *
 * 语言种数统计**不含**中文：这个页面回答的是「外语还差多少」，
 * 把中文算进去只会让「1 / 11」这种数字看起来像出了问题。
 */
export async function loadSyncOverview(db: PrismaClient): Promise<SyncOverviewRow[]> {
  const rows: SyncOverviewRow[] = [];

  for (const type of Object.keys(ADAPTERS) as ContentType[]) {
    const scope = await ADAPTERS[type].listScope(db);
    for (const entry of scope) {
      const plan = await planSync(db, type, entry.entityId);
      // 内容在这一瞬间被删掉了：跳过，不要让整页报错
      if (!plan) continue;

      const locales: LocaleSyncRow[] = plan.locales.map((item) => ({
        locale: item.locale,
        state: item.state,
        pendingCount: item.pendingCount,
        totalCount: item.totalCount,
        translatedAt: item.translatedAt?.toISOString() ?? null,
        error: item.lastError,
      }));

      const counted = locales.filter((item) => item.state !== 'empty');
      const lastSyncedAt = plan.locales
        .map((item) => item.translatedAt)
        .filter((value): value is Date => value !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0];

      rows.push({
        entityType: type,
        entityId: entry.entityId,
        label: entry.label,
        hint: entry.hint,
        revision: plan.revision,
        changed: plan.changed,
        syncedLocales: counted.filter((item) => item.state === 'synced').length,
        pendingLocales: counted.filter((item) => item.state !== 'synced').length,
        failedLocales: counted.filter((item) => item.state === 'failed').length,
        totalLocales: counted.length,
        lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
        locales,
        editHref: editHrefFor(type, entry.entityId),
      });
    }
  }

  // 有问题的排前面，其余按内容类型聚在一起 —— 管理员打开这一页最先要看的是「哪儿没同步」
  const rank = (row: SyncOverviewRow) => (row.failedLocales > 0 ? 0 : row.pendingLocales > 0 ? 1 : 2);
  rows.sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    if (a.entityType !== b.entityType) return a.entityType < b.entityType ? -1 : 1;
    return a.label.localeCompare(b.label);
  });

  return rows;
}

export interface SyncOverviewTotals {
  entities: number;
  pending: number;
  failed: number;
  synced: number;
}

export function totalsOf(rows: readonly SyncOverviewRow[]): SyncOverviewTotals {
  return {
    entities: rows.length,
    pending: rows.filter((row) => row.pendingLocales > 0).length,
    failed: rows.filter((row) => row.failedLocales > 0).length,
    synced: rows.filter((row) => row.pendingLocales === 0 && row.totalLocales > 0).length,
  };
}
