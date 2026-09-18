'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getPrisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { getDbUnavailableState, requireAdminOrError } from '@/lib/admin/guard';
import { formatMessage, getAdminMessagesForRequest } from '@/lib/admin/i18n';
import { acquireTranslationSlot } from '@/lib/translation/rate-limit';
import { planSync } from '@/lib/translation/state';
import {
  buildEmergencyAuditDetail,
  classifyPublishFailure,
  confirmEmergencyNeed,
  localeCoverage,
  performEmergencyPublish,
} from '@/lib/admin/emergency-publish';
import { describeBlockedReason } from '@/lib/admin/emergency-labels';
import { loadProductDraftState } from '@/lib/admin/product-draft-store';
import { loadPageDraftState } from '@/lib/admin/page-draft-store';
import { validateForPublish } from '@/lib/product-draft';
import { validatePageForPublish } from '@/lib/page-draft';
import { describeSyncFailure, runPublishSync, toProgress } from '@/lib/admin/publish-sync';
import type { FormState } from '@/lib/admin/action-state';

/**
 * 应急发布：「应急发布中文，其他语言稍后同步」。
 *
 * 这是 DeepSeek 故障时的**兜底**，不是绕过翻译的常规出口。因此这里的每一步都在
 * 收紧而不是放松：
 *
 *   1. **服务端自己重试一次翻译**，只有失败原因确实是「服务暂时不可用」
 *      （超时 / 网络 / 429 / 5xx）才放行。客户端说可以不算数；
 *   2. **校验照跑**。slug、封面、标题、区块 key 这些通不过时一律拒绝 ——
 *      应急发布绕过的是翻译，不是内容规范；
 *   3. **不伪造任何同步状态**。中文自身的版本号照常推进（中文内容确实变了），
 *      但**各语言的**来源哈希与 sourceRevision 一律不动 —— 它们没有重新翻译过。
 *      没译文就是没译文，后台会一直显示待同步；
 *   4. **不动其它语言的内容**。线上已有的外语原样保留（沿用上一版），
 *      没有的仍然没有 —— 不会生成假的翻译行。
 */

const inputSchema = z.object({
  entityType: z.enum(['product', 'page']),
  id: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(2, 'reason-too-short').max(200),
});

export async function emergencyPublishAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const parsed = inputSchema.safeParse({
    entityType: formData.get('entityType') ?? '',
    id: formData.get('id') ?? '',
    reason: formData.get('reason') ?? '',
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? t.validation.invalidInput };
  }

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  const { entityType, id, reason } = parsed.data;

  // ---- 第一步：服务端自己确认「确实是因为服务不可用」 ----
  //
  // 这一步会真的再试一次翻译。代价是多一次可能失败的调用，换来的是
  // 「应急发布不可能被用来绕过结构错误、配置错误或内容错误」这条性质。
  const needs = await confirmEmergencyNeed(db, entityType, id);
  if (!needs.plan) return { status: 'error', message: t.emergency.publishFailed };
  if (!needs.needed) return { status: 'error', message: t.emergency.blockedNoneNeeded };

  const slot = acquireTranslationSlot(user.id);
  if (!slot.ok) {
    return {
      status: 'error',
      message: slot.reason === 'concurrency' ? t.translation.errorBusy : t.translation.errorRateLimited,
    };
  }

  let offer;
  try {
    const attempt = await runPublishSync(db, entityType, id, user.id);
    offer = classifyPublishFailure(attempt.outcome.progress);

    // 同步其实成功了（服务恢复了）→ 直接用正常发布，不需要应急
    if (attempt.outcome.status === 'ready') {
      return { status: 'error', message: t.emergency.blockedNoneNeeded };
    }

    if (!offer.eligible) {
      return {
        status: 'error',
        message: `${describeSyncFailure(attempt.outcome, attempt.hasApiKey, t)} ${describeBlockedReason(offer.reason, t)}`,
        jobId: attempt.outcome.jobId ?? undefined,
        progress: toProgress(attempt.outcome.progress),
        emergency: offer,
      };
    }
  } finally {
    slot.release();
  }

  // ---- 第二步：内容本身必须合法 ----
  //
  // 应急发布绕过的是「翻译」，不是「内容规范」。这里与正常发布用同一套校验。
  try {
    if (entityType === 'product') {
      const state = await loadProductDraftState(db, id);
      if (!state) return { status: 'error', message: t.products.notFound };

      const valid = validateForPublish(state.draft, {
        slugRequired: t.validation.slugRequired,
        slugFormat: t.products.validationSlug,
        nameRequired: t.products.validationName,
        nameRequiredForLocale: t.products.nameCannotBeCleared,
        coverRequired: t.products.validationCover,
        priceMinRequired: t.products.priceMinRequired,
        priceRangeInvalid: t.products.priceRangeInvalid,
      });
      if (!valid.ok) {
        return {
          status: 'error',
          message: `${t.products.validationTitle}: ${valid.message}`,
        };
      }

      const coverage = await localeCoverage(db, entityType, id);
      const revision = needs.plan.revision;

      const { releaseId } = await performEmergencyPublish(db, {
        entityType,
        entityId: id,
        reason,
        failureKind: offer.failureKind,
        revision,
        sourceHash: needs.plan.hash,
        coverage,
        userId: user.id,
      });

      await writeAudit({
        userId: user.id,
        actorEmail: user.email,
        action: 'PUBLISH',
        targetType: 'Product',
        targetId: id,
        summary: t.emergency.auditSummary,
        // 只有元数据：没有 Key、没有原文、没有译文（构造过程本身有测试锁着）
        detail: buildEmergencyAuditDetail({
          releaseId,
          reason,
          failureKind: offer.failureKind,
          revision,
          staleLocales: coverage.staleLocales,
          missingLocales: coverage.missingLocales,
        }),
      });
    } else {
      const state = await loadPageDraftState(db, id);
      if (!state) return { status: 'error', message: t.actions.pageMissing };

      const valid = validatePageForPublish(state.draft, {
        slugRequired: t.validation.slugRequired,
        slugFormat: t.validation.slugFormat,
        titleRequired: t.pages.validationTitle,
        seoWithoutTitle: t.pages.seoWithoutTitle,
      });
      if (!valid.ok) return { status: 'error', message: valid.message };

      const coverage = await localeCoverage(db, entityType, id);
      const revision = needs.plan.revision;

      const { releaseId } = await performEmergencyPublish(db, {
        entityType,
        entityId: id,
        reason,
        failureKind: offer.failureKind,
        revision,
        sourceHash: needs.plan.hash,
        coverage,
        userId: user.id,
      });

      await writeAudit({
        userId: user.id,
        actorEmail: user.email,
        action: 'PUBLISH',
        targetType: 'Page',
        targetId: id,
        summary: t.emergency.auditSummary,
        detail: buildEmergencyAuditDetail({
          releaseId,
          reason,
          failureKind: offer.failureKind,
          revision,
          staleLocales: coverage.staleLocales,
          missingLocales: coverage.missingLocales,
        }),
      });
    }
  } catch (error) {
    console.error('[admin] emergency publish failed:', error);
    return { status: 'error', message: t.emergency.publishFailed };
  }

  revalidatePath('/', 'layout');

  const missing = await localeCoverage(db, entityType, id);
  return {
    status: 'success',
    message: [
      t.emergency.queued,
      missing.staleLocales.length > 0
        ? formatMessage(t.emergency.staleWarning, { locales: missing.staleLocales.join('、') })
        : '',
      missing.missingLocales.length > 0
        ? formatMessage(t.emergency.missingWarning, { locales: missing.missingLocales.join('、') })
        : '',
    ]
      .filter(Boolean)
      .join(' '),
  };
}


/**
 * 手动「立即重试」。
 *
 * 与自动补齐走的是同一个任务：有未完成的任务就推它一把，没有就现建一个。
 * 管理员不需要知道任务机制，只要知道「这条内容还没补齐，点这里催一下」。
 */
export async function retryCatchUpAction(input: {
  entityType: 'product' | 'page';
  entityId: string;
}): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const parsed = z
    .object({
      entityType: z.enum(['product', 'page']),
      entityId: z.string().trim().min(1).max(200),
    })
    .safeParse(input);
  if (!parsed.success) return { status: 'error', message: t.validation.invalidInput };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  const plan = await planSync(db, parsed.data.entityType, parsed.data.entityId);
  if (!plan) return { status: 'error', message: t.sync.notFound };

  const slot = acquireTranslationSlot(user.id);
  if (!slot.ok) {
    return {
      status: 'error',
      message: slot.reason === 'concurrency' ? t.translation.errorBusy : t.translation.errorRateLimited,
    };
  }

  try {
    const outcome = await runPublishSync(db, parsed.data.entityType, parsed.data.entityId, user.id);

    if (outcome.outcome.status === 'ready') {
      return { status: 'success', message: t.emergency.allDone };
    }
    if (outcome.outcome.status === 'working') {
      return {
        status: 'idle',
        message: formatMessage(t.translation.publishSyncing, {
          completed: outcome.outcome.progress?.completedItems ?? 0,
          total: outcome.outcome.progress?.totalItems ?? 0,
        }),
        jobId: outcome.outcome.jobId ?? undefined,
        progress: toProgress(outcome.outcome.progress),
      };
    }

    return {
      status: 'error',
      message: describeSyncFailure(outcome.outcome, outcome.hasApiKey, t),
      emergency: classifyPublishFailure(outcome.outcome.progress),
      progress: toProgress(outcome.outcome.progress),
    };
  } finally {
    slot.release();
  }
}
