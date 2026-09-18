import type { PrismaClient } from '@prisma/client';
import { ADMIN_LOCALES } from '@/lib/admin/validation';
import { revalidatePublicCatalogue } from '@/lib/admin/revalidate';
import { recordRelease } from '@/lib/translation/state';
import {
  DRAFT_TRANSACTION_OPTIONS,
  applyDraftToLive,
  clearDraft,
  loadProductDraftState,
  recordVersion,
} from '@/lib/admin/product-draft-store';
import {
  PAGE_TRANSACTION_OPTIONS,
  applyPageDraftToLive,
  clearPageDraft,
  loadPageDraftState,
  recordPageVersion,
} from '@/lib/admin/page-draft-store';
import { resolveDraftPrice, type ProductDraft } from '@/lib/product-draft';
import type { PageDraft } from '@/lib/page-draft';

/**
 * 「把一份已经确认过的草稿落进线上」—— 发布动作里最后那一段事务。
 *
 * 抽出来是因为现在有**两条**路径会走到它：
 *   1. 管理员点「发布」（校验与同步都在调用方完成）；
 *   2. 应急发布之后，补齐任务跑完，自动创建一次「语言补齐版本」。
 *
 * 两处各写一遍的话，早晚会出现「手动发布更新了 X、自动补齐忘了更新 X」这种
 * 只在故障恢复时才暴露的差异 —— 而故障恢复正是最不希望出意外的时候。
 *
 * 这里**不做校验**：调用方必须已经把内容验证过。自动补齐路径的依据是
 * 「它刚刚是从线上读出来、只多了译文」，结构上不可能不合法。
 */

export interface FinishPublishInput {
  userId: string | null;
  /** 本次发布钉住的中文版本号 */
  revision: number;
  /** 本次同步任务 id，仅用于发布记录 */
  jobId: string | null;
  kind: 'FULL' | 'EMERGENCY';
  /** 应急发布时管理员填写的原因 */
  reason?: string | null;
  /** 应急发布时翻译失败的类型 */
  failureKind?: string | null;
  /** 应急发布时：仍在上一版、尚未更新的语言 */
  staleLocales?: readonly string[];
  /** 应急发布时：完全没有译文的语言 */
  missingLocales?: readonly string[];
}

async function releaseResult(input: FinishPublishInput, synced: number) {
  return {
    jobId: input.jobId,
    synced,
    ...(input.kind === 'EMERGENCY'
      ? { staleLocales: input.staleLocales ?? [], missingLocales: input.missingLocales ?? [] }
      : {}),
  };
}

/**
 * 把一个商品的草稿发布到线上，并留下一条发布记录与一个版本快照。
 *
 * 返回 releaseId —— 商品版本快照带着它，因此「这些语言是不是同一次发布出去的」
 * 事后可以直接查证。
 */
export async function finishProductPublish(
  db: PrismaClient,
  productId: string,
  draft: ProductDraft,
  input: FinishPublishInput,
): Promise<string> {
  return db.$transaction(async (tx) => {
    const releaseId = await recordRelease(tx, {
      entityType: 'product',
      entityId: productId,
      revision: input.revision,
      // 应急发布只上线中文，其余语言沿用上一版 —— 发布记录要如实反映这一点
      locales: input.kind === 'EMERGENCY' ? ['zh'] : [...ADMIN_LOCALES],
      model: null,
      userId: input.userId,
      kind: input.kind,
      reason: input.reason ?? null,
      failureKind: input.failureKind ?? null,
      result: await releaseResult(input, draft.media.length),
    });

    await applyDraftToLive(tx, productId, draft, resolveDraftPrice(draft));
    await tx.product.update({ where: { id: productId }, data: { published: true } });
    await recordVersion(tx, {
      productId,
      kind: 'PUBLISHED',
      snapshot: draft,
      userId: input.userId,
      releaseId,
    });
    await clearDraft(tx, productId);

    return releaseId;
  }, DRAFT_TRANSACTION_OPTIONS);
}

/** 页面的版本，语义与上面完全一致 */
export async function finishPagePublish(
  db: PrismaClient,
  pageId: string,
  draft: PageDraft,
  input: FinishPublishInput,
): Promise<string> {
  return db.$transaction(async (tx) => {
    const releaseId = await recordRelease(tx, {
      entityType: 'page',
      entityId: pageId,
      revision: input.revision,
      locales: input.kind === 'EMERGENCY' ? ['zh'] : [...ADMIN_LOCALES],
      model: null,
      userId: input.userId,
      kind: input.kind,
      reason: input.reason ?? null,
      failureKind: input.failureKind ?? null,
      result: await releaseResult(input, draft.blocks.length),
    });

    await applyPageDraftToLive(tx, pageId, draft);
    await tx.page.update({ where: { id: pageId }, data: { status: 'PUBLISHED' } });
    await recordPageVersion(tx, {
      pageId,
      kind: 'PUBLISHED',
      snapshot: draft,
      userId: input.userId,
      releaseId,
    });
    await clearPageDraft(tx, pageId);

    return releaseId;
  }, PAGE_TRANSACTION_OPTIONS);
}

/**
 * 补齐任务跑完之后，自动把内容正式发布一次。
 *
 * 这是需求里「全部语言成功后自动创建一次语言补齐版本」的落点。
 * 调用方（任务收尾）已经确认过全部语言都同步成功，所以这里不再校验，
 * 只负责把草稿落进线上、留一版、清掉草稿。
 *
 * 返回 null 表示内容已经不存在了（同步过程中被删掉）。
 */
export async function autoCompletePublish(
  db: PrismaClient,
  entityType: string,
  entityId: string,
  userId: string | null,
): Promise<{ releaseId: string; revision: number } | null> {
  if (entityType === 'product') {
    const state = await loadProductDraftState(db, entityId);
    if (!state) return null;
    const revision = await currentRevision(db, entityType, entityId);
    const releaseId = await finishProductPublish(db, entityId, state.draft, {
      userId,
      revision,
      jobId: null,
      kind: 'FULL',
    });
    revalidatePublicCatalogue();
    return { releaseId, revision };
  }

  if (entityType === 'page') {
    const state = await loadPageDraftState(db, entityId);
    if (!state) return null;
    const revision = await currentRevision(db, entityType, entityId);
    const releaseId = await finishPagePublish(db, entityId, state.draft, {
      userId,
      revision,
      jobId: null,
      kind: 'FULL',
    });
    revalidatePublicCatalogue();
    return { releaseId, revision };
  }

  return null;
}

async function currentRevision(db: PrismaClient, entityType: string, entityId: string): Promise<number> {
  const row = await db.contentRevision.findUnique({
    where: { entityType_entityId: { entityType, entityId } },
    select: { revision: true },
  });
  return row?.revision ?? 0;
}
