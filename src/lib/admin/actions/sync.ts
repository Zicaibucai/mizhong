'use server';

import { z } from 'zod';
import { getPrisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { getDbUnavailableState, requireAdminOrError } from '@/lib/admin/guard';
import { formatMessage, getAdminMessagesForRequest, type AdminMessages } from '@/lib/admin/i18n';
import { loadTranslationSettings } from '@/lib/translation/settings';
import { acquireTranslationSlot } from '@/lib/translation/rate-limit';
import {
  advanceJob,
  collectScope,
  createJob,
  createRetryJob,
  getJobProgress,
  type JobProgress,
} from '@/lib/translation/jobs';
import { isContentType } from '@/lib/translation/adapters';
import { describeJobError, toProgress } from '@/lib/admin/publish-sync';
import type { PublishProgress } from '@/lib/admin/action-state';

/**
 * 「语言同步」页的服务端动作。
 *
 * 每个动作只做**一轮**推进（十几秒），没跑完就把任务 id 交回界面继续调 ——
 * 需求明确禁止「一个持续超过 60 秒的浏览器请求」，因此这里不自己循环到底。
 * 也因此，关掉页面不会损坏任何东西：任务与进度都在数据库里，重新打开接着看。
 *
 * 每个动作都做三件事：管理员校验、限流、审计。全站同步会花真实的钱，
 * 这三道都不能省。
 */

export interface SyncFailureRow {
  entityType: string;
  entityId: string;
  label: string | null;
  locale: string;
  error: string | null;
}

export interface SyncActionResult {
  ok: boolean;
  message: string;
  jobId?: string;
  progress?: PublishProgress;
  /** 还有内容没处理完，界面应当继续调 advanceJobAction */
  hasMore?: boolean;
  /** 这次没有任何东西要做（也就没有发起请求） */
  idle?: boolean;
  failures?: SyncFailureRow[];
  /** 逐条内容的失败原因，供「查看错误」 */
  errors?: { entityType: string; entityId: string; locale: string; message: string }[];
}

function toResult(
  progress: JobProgress,
  t: AdminMessages,
  options: { message?: string } = {},
): SyncActionResult {
  return {
    ok: progress.failedItems === 0,
    message:
      options.message ??
      formatMessage(t.sync.jobSummary, {
        completed: progress.completedItems,
        total: progress.totalItems,
        failed: progress.failedItems,
      }),
    jobId: progress.id,
    progress: toProgress(progress),
    hasMore: progress.pendingItems > 0,
    failures: progress.failures,
    errors: progress.failures.map((item) => ({
      entityType: item.entityType,
      entityId: item.entityId,
      locale: item.locale,
      message: describeJobError(item.error, t),
    })),
  };
}

export async function advanceJobAction(input: { jobId: string }): Promise<SyncActionResult> {
  const { t } = await getAdminMessagesForRequest();
  const guard = await requireAdminOrError(t);
  if ('error' in guard) return { ok: false, message: guard.error.message ?? t.validation.invalidInput };
  const { user } = guard;

  const parsed = z.object({ jobId: z.string().trim().min(1).max(200) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: t.validation.invalidInput };

  const db = getPrisma();
  if (!db) return { ok: false, message: getDbUnavailableState(t).message ?? '' };

  const settings = await loadTranslationSettings(db);
  const slot = acquireTranslationSlot(user.id);
  if (!slot.ok) {
    return {
      ok: false,
      message: slot.reason === 'concurrency' ? t.translation.errorBusy : t.translation.errorRateLimited,
      jobId: parsed.data.jobId,
    };
  }

  try {
    const advanced = await advanceJob(db, settings, parsed.data.jobId);
    if (!advanced) return { ok: false, message: t.sync.notFound };

    // 另一个推进正在进行：把当前进度如实返回，让界面稍后再试
    if (advanced.busy) {
      return { ...toResult(advanced.progress, t), ok: true, message: t.sync.running };
    }

    if (advanced.progress.status === 'SUCCEEDED') {
      return toResult(advanced.progress, t, { message: t.sync.done });
    }
    return toResult(advanced.progress, t);
  } catch (error) {
    console.error('[admin] advance translation job failed:', error);
    return { ok: false, message: t.actions.operationFailed, jobId: parsed.data.jobId };
  } finally {
    slot.release();
  }
}

/**
 * 同步一条内容。
 *
 * 幂等键里带上内容与中文版本：连点两下只会命中同一个任务，不会翻两遍。
 */
export async function syncContentAction(input: {
  entityType: string;
  entityId: string;
  /** 强制重翻：已有的译文也重新生成 */
  force?: boolean;
}): Promise<SyncActionResult> {
  const { t } = await getAdminMessagesForRequest();
  const guard = await requireAdminOrError(t);
  if ('error' in guard) return { ok: false, message: guard.error.message ?? t.validation.invalidInput };
  const { user } = guard;

  const parsed = z
    .object({ entityType: z.string().trim().min(1).max(40), entityId: z.string().trim().min(1).max(200) })
    .safeParse(input);
  if (!parsed.success || !isContentType(parsed.data.entityType)) {
    return { ok: false, message: t.validation.invalidInput };
  }

  const db = getPrisma();
  if (!db) return { ok: false, message: getDbUnavailableState(t).message ?? '' };

  const settings = await loadTranslationSettings(db);
  const slot = acquireTranslationSlot(user.id);
  if (!slot.ok) {
    return {
      ok: false,
      message: slot.reason === 'concurrency' ? t.translation.errorBusy : t.translation.errorRateLimited,
    };
  }

  try {
    const { jobId, created } = await createJob(db, {
      kind: 'SYNC_ONE',
      targets: [
        { entityType: parsed.data.entityType, entityId: parsed.data.entityId, label: parsed.data.entityId },
      ],
      userId: user.id,
      force: input.force === true,
    });

    const advanced = await advanceJob(db, settings, jobId);
    if (!advanced) return { ok: false, message: t.sync.notFound };

    if (advanced.progress.totalItems === 0 && advanced.progress.pendingItems === 0 && created) {
      return { ok: true, message: t.sync.nothingToDo, jobId, idle: true };
    }

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'UPDATE',
      targetType: 'TranslationJob',
      targetId: jobId,
      summary: t.sync.syncOne,
      // 只有元数据：没有 Key、没有原文、没有译文
      detail: {
        entityType: parsed.data.entityType,
        entityId: parsed.data.entityId,
        requests: advanced.progress.requestCount,
        tokenEstimate: advanced.progress.tokenEstimate,
      },
    });

    return toResult(advanced.progress, t);
  } catch (error) {
    console.error('[admin] sync content failed:', error);
    return { ok: false, message: t.actions.operationFailed };
  } finally {
    slot.release();
  }
}

/**
 * 同步全部已发布的中文内容。
 *
 * 分批执行：这一轮只推进一段预算，剩下的交给界面继续调 `advanceJobAction`。
 * 断点就是每个工作项自己的状态，因此中途关掉页面、重新打开、再点一次，
 * 都是接着做而不是从头来。
 */
export async function syncAllContentAction(options: {
  /**
   * 强制重翻：忽略「已同步」的判断，把所有字段重新生成一遍。
   *
   * 默认关闭，所以「中文没变就不调用模型」这条性质不受影响。存在的理由是那条
   * 被有意采用的宽松规则：本功能上线前的旧译文、回滚后的快照，一律认下来不覆盖
   * （见 document.ts 的 diffUnits）。那是对的选择，但它漏掉一种情况 ——
   * 中文在上线之前改过、旧译文没跟着改。机器判断不出来，只能由人决定重翻。
   */
  force?: boolean;
} = {}): Promise<SyncActionResult> {
  const { t } = await getAdminMessagesForRequest();
  const guard = await requireAdminOrError(t);
  if ('error' in guard) return { ok: false, message: guard.error.message ?? t.validation.invalidInput };
  const { user } = guard;

  const db = getPrisma();
  if (!db) return { ok: false, message: getDbUnavailableState(t).message ?? '' };

  const settings = await loadTranslationSettings(db);
  const slot = acquireTranslationSlot(user.id);
  if (!slot.ok) {
    return {
      ok: false,
      message: slot.reason === 'concurrency' ? t.translation.errorBusy : t.translation.errorRateLimited,
    };
  }

  try {
    const targets = await collectScope(db);

    // 先算一遍：一条都不缺时就别建任务了，界面直接说「都已是最新」
    const { jobId, created, totalItems } = await createJob(db, {
      kind: 'SYNC_ALL',
      targets,
      userId: user.id,
      force: options.force === true,
    });

    const advanced = await advanceJob(db, settings, jobId);
    if (!advanced) return { ok: false, message: t.sync.notFound };

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'UPDATE',
      targetType: 'TranslationJob',
      targetId: jobId,
      summary: options.force ? t.sync.forceAll : t.sync.syncAll,
      detail: {
        entities: targets.length,
        items: totalItems,
        created,
        requests: advanced.progress.requestCount,
        tokenEstimate: advanced.progress.tokenEstimate,
      },
    });

    return toResult(advanced.progress, t);
  } catch (error) {
    console.error('[admin] sync all content failed:', error);
    return { ok: false, message: t.actions.operationFailed };
  } finally {
    slot.release();
  }
}

/** 只重试上一次任务里失败的那部分。成功的不会重翻，也就不会重复付费。 */
export async function retryFailedAction(input: { jobId: string }): Promise<SyncActionResult> {
  const { t } = await getAdminMessagesForRequest();
  const guard = await requireAdminOrError(t);
  if ('error' in guard) return { ok: false, message: guard.error.message ?? t.validation.invalidInput };
  const { user } = guard;

  const parsed = z.object({ jobId: z.string().trim().min(1).max(200) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: t.validation.invalidInput };

  const db = getPrisma();
  if (!db) return { ok: false, message: getDbUnavailableState(t).message ?? '' };

  const settings = await loadTranslationSettings(db);
  const slot = acquireTranslationSlot(user.id);
  if (!slot.ok) {
    return {
      ok: false,
      message: slot.reason === 'concurrency' ? t.translation.errorBusy : t.translation.errorRateLimited,
    };
  }

  try {
    const retry = await createRetryJob(db, parsed.data.jobId, { userId: user.id });
    if (!retry) return { ok: false, message: t.sync.nothingToDo };

    const advanced = await advanceJob(db, settings, retry.jobId);
    if (!advanced) return { ok: false, message: t.sync.notFound };

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'UPDATE',
      targetType: 'TranslationJob',
      targetId: retry.jobId,
      summary: t.sync.retryFailed,
      detail: { sourceJobId: parsed.data.jobId, items: retry.totalItems, created: retry.created },
    });

    return toResult(advanced.progress, t);
  } catch (error) {
    console.error('[admin] retry failed translations failed:', error);
    return { ok: false, message: t.actions.operationFailed };
  } finally {
    slot.release();
  }
}

/** 只读：拉一次某个任务的当前进度（界面轮询用） */
export async function jobStatusAction(input: { jobId: string }): Promise<SyncActionResult> {
  const { t } = await getAdminMessagesForRequest();
  const guard = await requireAdminOrError(t);
  if ('error' in guard) return { ok: false, message: guard.error.message ?? t.validation.invalidInput };

  const parsed = z.object({ jobId: z.string().trim().min(1).max(200) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: t.validation.invalidInput };

  const db = getPrisma();
  if (!db) return { ok: false, message: getDbUnavailableState(t).message ?? '' };

  try {
    const progress = await getJobProgress(db, parsed.data.jobId);
    return toResult(progress, t);
  } catch {
    return { ok: false, message: t.sync.notFound };
  }
}
