import type { PrismaClient } from '@prisma/client';
import { loadTranslationSettings } from '@/lib/translation/settings';
import { syncForPublish, type JobProgress, type PublishSyncOutcome } from '@/lib/translation/jobs';
import type { AdminMessages } from '@/lib/admin/i18n';
import type { PublishProgress } from '@/lib/admin/action-state';

export type { PublishSyncOutcome };

/**
 * 发布与后台界面共用的同步编排。
 *
 * 刻意**不**放在 `'use server'` 模块里：那种模块的每一个导出都会变成一个
 * 客户端可以调用的服务端入口。这里的函数是内部编排，不该被外部直接调 ——
 * 真正对外的是 `src/lib/admin/actions/sync.ts` 里那几个做了管理员校验的 action。
 */

/**
 * 跑一轮发布同步。
 *
 * 只跑**一轮**（最多十几秒），没跑完就把任务 id 交回界面继续推进 ——
 * 需求明确禁止「一个持续超过 60 秒的浏览器请求」，所以这里不自己循环到底。
 */
export async function runPublishSync(
  db: PrismaClient,
  entityType: string,
  entityId: string,
  userId: string | null,
): Promise<{ outcome: PublishSyncOutcome; hasApiKey: boolean }> {
  const settings = await loadTranslationSettings(db);
  const outcome = await syncForPublish(db, settings, entityType, entityId, {
    userId,
    budgetMs: 15_000,
  });
  return { outcome, hasApiKey: settings.apiKey.length > 0 };
}

/** 任务进度 → 界面用的精简形状 */
export function toProgress(progress: JobProgress | null): PublishProgress | undefined {
  if (!progress) return undefined;
  return {
    total: progress.totalItems,
    completed: progress.completedItems,
    failed: progress.failedItems,
    pending: progress.pendingItems,
  };
}

/**
 * 把失败原因说成一句管理员能照着做的话。
 *
 * 「没配 Key」和「模型那边出错」对管理员来说是两件完全不同的事：
 * 前者要去翻译设置填 Key，后者只能等一会儿再试。所以分开说。
 */
export function describeSyncFailure(
  outcome: PublishSyncOutcome,
  hasApiKey: boolean,
  t: AdminMessages,
): string {
  if (!hasApiKey) return t.translation.publishSyncNotConfigured;

  const reason = outcome.progress?.lastError;
  if (reason === 'source-changed') return t.translation.publishSyncChanged;
  if (reason === 'still-pending') return t.translation.publishSyncStillPending;

  const failed = outcome.progress?.failures ?? [];
  if (failed.length > 0) {
    const locales = [...new Set(failed.map((item) => item.locale))].join('、');
    return `${t.translation.publishSyncFailed}（${locales}）`;
  }
  return t.translation.publishSyncFailed;
}

/** 把已归类的错误类别翻成一句人话，供「语言同步」页展示 */
export function describeJobError(reason: string | null | undefined, t: AdminMessages): string {
  switch (reason) {
    case 'not-configured':
      return t.sync.errorNotConfigured;
    case 'auth':
      return t.sync.errorAuth;
    case 'rate-limit':
      return t.sync.errorRateLimit;
    case 'timeout':
      return t.sync.errorTimeout;
    case 'network':
      return t.sync.errorNetwork;
    case 'server':
      return t.sync.errorServer;
    case 'bad-response':
      return t.sync.errorBadResponse;
    case 'incomplete':
      return t.sync.errorIncomplete;
    case 'source-changed':
      return t.sync.errorSourceChanged;
    case 'still-pending':
      return t.sync.errorStillPending;
    case null:
    case undefined:
      return t.sync.errorUnknown;
    default:
      return t.sync.errorUnknown;
  }
}

/** 内容类型 → 后台显示名 */
export function contentTypeLabel(type: string, t: AdminMessages): string {
  switch (type) {
    case 'product':
      return t.sync.contentTypeProduct;
    case 'page':
      return t.sync.contentTypePage;
    case 'company':
      return t.sync.contentTypeCompany;
    case 'contact':
      return t.sync.contentTypeContact;
    case 'nav':
      return t.sync.contentTypeNav;
    case 'category':
      return t.sync.contentTypeCategory;
    case 'asset':
      return t.sync.contentTypeAsset;
    default:
      return type;
  }
}

/** 任务状态 → 后台显示名 */
export function jobStatusLabel(status: string, t: AdminMessages): string {
  switch (status) {
    case 'PENDING':
      return t.sync.jobStatusPending;
    case 'RUNNING':
      return t.sync.jobStatusRunning;
    case 'SUCCEEDED':
      return t.sync.jobStatusSucceeded;
    case 'PARTIAL':
      return t.sync.jobStatusPartial;
    case 'FAILED':
      return t.sync.jobStatusFailed;
    default:
      return t.sync.jobStatusCancelled;
  }
}

/** 同步状态 → 后台显示名 */
export function syncStateLabel(state: string, t: AdminMessages): string {
  switch (state) {
    case 'synced':
      return t.sync.stateSynced;
    case 'partial':
      return t.sync.statePartial;
    case 'stale':
      return t.sync.stateStale;
    case 'failed':
      return t.sync.stateFailed;
    default:
      return t.sync.stateEmpty;
  }
}
