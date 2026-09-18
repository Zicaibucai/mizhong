'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getPrisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { getDbUnavailableState, requireAdminOrError } from '@/lib/admin/guard';
import {
  ADMIN_LOCALES,
  makePageBaseSchema,
  makePageTranslationSchema,
  makeBlockTranslationSchema,
  parseForm,
  parseLocaleFields,
  type AdminLocale,
} from '@/lib/admin/validation';
import { formatMessage, getAdminMessagesForRequest } from '@/lib/admin/i18n';
import { acquireTranslationSlot } from '@/lib/translation/rate-limit';
import { loadTranslationSettings } from '@/lib/translation/settings';
import { syncEntity } from '@/lib/translation/engine';
import { recordRelease, invalidateTranslationState } from '@/lib/translation/state';
import {
  PAGE_TRANSACTION_OPTIONS,
  applyPageDraftToLive,
  clearPageDraft,
  duplicateBlockKeys,
  loadPageDraftState,
  recordPageVersion,
  restorePageVersionToDraft,
  savePageDraft,
} from '@/lib/admin/page-draft-store';
import { describeSyncFailure, runPublishSync, toProgress } from '@/lib/admin/publish-sync';
import { validatePageForPublish } from '@/lib/page-draft';
import type { FormState } from '@/lib/admin/action-state';

/**
 * 页面的编辑动作。
 *
 * 与商品同一套两段式：**保存写草稿，发布才写线上**。
 * 改造前页面是直接写线上的 —— 点保存的那一刻访客就看到了改到一半的内容，
 * 而且没有任何历史版本可以退回去。
 *
 * 「一键翻译」在这里的做法与商品略有不同：页面的表单是「页面信息 + 每个区块各一个」，
 * 浏览器一次只能提交一个。所以按钮先把所有表单**逐个交给服务端保存**（await 到每一
 * 个都完成），再让服务端按草稿里的最新中文去翻译 —— 依然满足「翻译前先读取表单
 * 里的最新内容」，只是那个「读」发生在服务端保存之后，而不是靠扫 DOM。
 */

// ---------------------------------------------------------------------------
// 保存（写草稿）
// ---------------------------------------------------------------------------

export async function savePageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const base = parseForm(makePageBaseSchema(t), formData, t);
  if (!base.ok) return { status: 'error', message: base.message };

  const translationSchema = makePageTranslationSchema(t);
  const translations: Record<AdminLocale, { title: string; seoTitle: string; seoDescription: string }> =
    {} as Record<AdminLocale, { title: string; seoTitle: string; seoDescription: string }>;
  for (const locale of ADMIN_LOCALES) {
    const parsed = parseLocaleFields(translationSchema, locale, formData, t);
    if (!parsed.ok) return { status: 'error', message: parsed.message };
    translations[locale] = parsed.data;
  }

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const state = await loadPageDraftState(db, base.data.id);
    if (!state) return { status: 'error', message: t.actions.pageMissing };

    const slugOwner = await db.page.findUnique({ where: { slug: base.data.slug } });
    if (slugOwner && slugOwner.id !== base.data.id) {
      return { status: 'error', message: t.actions.slugTaken };
    }

    await savePageDraft(db, base.data.id, { ...state.draft, slug: base.data.slug, translations });

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'UPDATE',
      targetType: 'Page',
      targetId: base.data.id,
      summary: formatMessage(t.auditSummaries.pageUpdated, { slug: state.draft.slug }),
      detail: { draft: true },
    });
  } catch (error) {
    console.error('[admin] save page draft failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  // 草稿不进前台，所以**不** revalidate —— 客人看到的东西一个字节都没变
  return { status: 'success', message: t.actions.pageSaved };
}

export async function saveBlockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const base = parseForm(
    z.object({
      id: z.string().trim().min(1, t.validation.invalidInput),
      enabled: z.coerce.boolean().default(false),
    }),
    formData,
    t,
  );
  if (!base.ok) return { status: 'error', message: base.message };

  const translationSchema = makeBlockTranslationSchema();
  const values: Record<AdminLocale, z.infer<typeof translationSchema>> = {} as Record<
    AdminLocale,
    z.infer<typeof translationSchema>
  >;
  for (const locale of ADMIN_LOCALES) {
    const parsed = parseLocaleFields(translationSchema, locale, formData, t);
    if (!parsed.ok) return { status: 'error', message: parsed.message };
    values[locale] = parsed.data;
  }

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const block = await db.pageBlock.findUnique({ where: { id: base.data.id } });
    if (!block) return { status: 'error', message: t.actions.blockMissing };

    const state = await loadPageDraftState(db, block.pageId);
    if (!state) return { status: 'error', message: t.actions.pageMissing };

    const blocks = state.draft.blocks.map((item) =>
      item.id === block.id ? { ...item, enabled: base.data.enabled, values } : item,
    );
    await savePageDraft(db, block.pageId, { ...state.draft, blocks });

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'UPDATE',
      targetType: 'PageBlock',
      targetId: block.id,
      summary: formatMessage(t.auditSummaries.blockUpdated, { key: block.key }),
      detail: { draft: true },
    });
  } catch (error) {
    console.error('[admin] save block draft failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  return { status: 'success', message: t.actions.blockSaved };
}

// ---------------------------------------------------------------------------
// 发布 / 取消发布
// ---------------------------------------------------------------------------

/**
 * 改变页面的发布状态。
 *
 * 发布时会走一遍与商品完全相同的流程：校验 → **同步译文** → 写线上 → 留一版 → 清草稿。
 * `status` 的取值与表单里那个隐藏字段保持一致，改名字会让现有按钮静默失效。
 */
export async function setPageStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const statusSchema = z.object({
    id: z.string().trim().min(1, t.validation.invalidInput),
    status: z.enum(['DRAFT', 'PUBLISHED']),
  });
  const parsed = parseForm(statusSchema, formData, t);
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  const publish = parsed.data.status === 'PUBLISHED';

  try {
    const state = await loadPageDraftState(db, parsed.data.id);
    if (!state) return { status: 'error', message: t.actions.pageMissing };

    if (publish) {
      const valid = validatePageForPublish(state.draft, {
        slugRequired: t.validation.slugRequired,
        slugFormat: t.validation.slugFormat,
        titleRequired: t.pages.validationTitle,
        seoWithoutTitle: t.pages.seoWithoutTitle,
      });
      if (!valid.ok) return { status: 'error', message: valid.message };

      // 区块 key 在页面内唯一：交给数据库报错的话，管理员看到的是一段英文约束名
      const duplicates = duplicateBlockKeys(state.draft);
      if (duplicates.length > 0) {
        return {
          status: 'error',
          message: formatMessage(t.pages.duplicateKeys, { keys: duplicates.join('、') }),
        };
      }

      const slugOwner = await db.page.findUnique({ where: { slug: state.draft.slug } });
      if (slugOwner && slugOwner.id !== parsed.data.id) {
        return { status: 'error', message: t.actions.slugTaken };
      }

      // 发布自带的同步保险 —— 与商品同一条通路、同一个引擎
      const { outcome, hasApiKey } = await runPublishSync(db, 'page', parsed.data.id, user.id);

      if (outcome.status === 'working') {
        return {
          status: 'idle',
          message: formatMessage(t.translation.publishSyncing, {
            completed: outcome.progress?.completedItems ?? 0,
            total: outcome.progress?.totalItems ?? 0,
          }),
          jobId: outcome.jobId ?? undefined,
          progress: toProgress(outcome.progress),
        };
      }
      if (outcome.status === 'failed') {
        return {
          status: 'error',
          message: describeSyncFailure(outcome, hasApiKey, t),
          jobId: outcome.jobId ?? undefined,
          progress: toProgress(outcome.progress),
        };
      }

      // 重新读一次：同步过程刚刚把译文写进了草稿，必须用最新的那一份去发布
      const fresh = await loadPageDraftState(db, parsed.data.id);
      if (!fresh) return { status: 'error', message: t.actions.pageMissing };

      await db.$transaction(async (tx) => {
        const releaseId = await recordRelease(tx, {
          entityType: 'page',
          entityId: parsed.data.id,
          revision: outcome.revision,
          locales: [...ADMIN_LOCALES],
          model: null,
          userId: user.id,
          result: { jobId: outcome.jobId, synced: outcome.progress?.completedItems ?? 0 },
        });

        await applyPageDraftToLive(tx, parsed.data.id, fresh.draft);
        await tx.page.update({ where: { id: parsed.data.id }, data: { status: 'PUBLISHED' } });
        await recordPageVersion(tx, {
          pageId: parsed.data.id,
          kind: 'PUBLISHED',
          snapshot: fresh.draft,
          userId: user.id,
          releaseId,
        });
        await clearPageDraft(tx, parsed.data.id);
      }, PAGE_TRANSACTION_OPTIONS);
    } else {
      await db.page.update({ where: { id: parsed.data.id }, data: { status: 'DRAFT' } });
    }

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: publish ? 'PUBLISH' : 'UNPUBLISH',
      targetType: 'Page',
      targetId: parsed.data.id,
      summary: publish
        ? formatMessage(t.auditSummaries.pagePublished, { slug: state.draft.slug })
        : formatMessage(t.auditSummaries.pageDrafted, { slug: state.draft.slug }),
    });
  } catch (error) {
    console.error('[admin] set page status failed:', error);
    return { status: 'error', message: t.actions.operationFailed };
  }

  revalidatePath('/', 'layout');
  return {
    status: 'success',
    message: publish ? t.actions.pagePublished : t.actions.pageDrafted,
  };
}

// ---------------------------------------------------------------------------
// 一键翻译
// ---------------------------------------------------------------------------

export interface TranslatePageResult {
  ok: boolean;
  message: string;
  /** 逐语言的完成情况，用于显示「哪些语言没翻成」 */
  failures: { locale: string; error: string }[];
  translated: number;
  requestCount: number;
}

/**
 * 把页面的中文改动补齐到全部目标语言，写进**草稿**。
 *
 * 调用方（页面编辑器上那个按钮）会先把页面上所有表单逐个保存完，再调这里 ——
 * 于是翻译读到的就是表单里最新的中文，而不是数据库里的旧值。
 */
export async function translatePageAction(input: { pageId: string }): Promise<TranslatePageResult> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) {
    return { ok: false, message: guard.error.message ?? t.validation.invalidInput, failures: [], translated: 0, requestCount: 0 };
  }
  const { user } = guard;

  const parsed = z.object({ pageId: z.string().trim().min(1).max(200) }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: t.validation.invalidInput, failures: [], translated: 0, requestCount: 0 };
  }

  const db = getPrisma();
  if (!db) {
    return { ok: false, message: getDbUnavailableState(t).message ?? '', failures: [], translated: 0, requestCount: 0 };
  }

  const settings = await loadTranslationSettings(db);
  if (!settings.apiKey) {
    return { ok: false, message: t.translation.notConfigured, failures: [], translated: 0, requestCount: 0 };
  }

  const slot = acquireTranslationSlot(user.id);
  if (!slot.ok) {
    return {
      ok: false,
      message: slot.reason === 'concurrency' ? t.translation.errorBusy : t.translation.errorRateLimited,
      failures: [],
      translated: 0,
      requestCount: 0,
    };
  }

  try {
    const result = await syncEntity(db, settings, 'page', parsed.data.pageId, { budgetMs: 25_000 });
    if (!result) {
      return { ok: false, message: t.sync.notFound, failures: [], translated: 0, requestCount: 0 };
    }

    if (result.nothingToDo) {
      return { ok: true, message: t.sync.nothingToDo, failures: [], translated: 0, requestCount: 0 };
    }

    const failures = result.locales
      .filter((item) => item.outcome === 'failed')
      .map((item) => ({ locale: item.locale, error: item.error ?? 'unknown' }));
    const translated = result.locales.reduce((sum, item) => sum + item.translated, 0);

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'UPDATE',
      targetType: 'Page',
      targetId: parsed.data.pageId,
      summary: t.translation.auditSummary,
      // 只有元数据：没有 Key、没有原文、没有译文
      detail: {
        requests: result.requestCount,
        tokenEstimate: result.tokenEstimate,
        translated,
        failedLocales: failures.map((item) => item.locale),
        model: settings.model,
      },
    });

    return {
      ok: failures.length === 0,
      message:
        failures.length === 0
          ? formatMessage(t.translation.success, { fields: translated, languages: result.locales.length })
          : formatMessage(t.translation.partial, { locales: failures.map((item) => item.locale).join('、') }),
      failures,
      translated,
      requestCount: result.requestCount,
    };
  } catch (error) {
    console.error('[admin] translate page failed:', error);
    return { ok: false, message: t.actions.operationFailed, failures: [], translated: 0, requestCount: 0 };
  } finally {
    slot.release();
  }
}

// ---------------------------------------------------------------------------
// 版本
// ---------------------------------------------------------------------------

export async function createPageVersionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const parsed = parseForm(
    z.object({
      id: z.string().trim().min(1, t.validation.invalidInput),
      note: z.preprocess((value) => (typeof value === 'string' ? value.trim().slice(0, 200) : ''), z.string()),
    }),
    formData,
    t,
  );
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const state = await loadPageDraftState(db, parsed.data.id);
    if (!state) return { status: 'error', message: t.actions.pageMissing };

    await db.$transaction(async (tx) => {
      await recordPageVersion(tx, {
        pageId: parsed.data.id,
        kind: 'MANUAL',
        snapshot: state.draft,
        userId: user.id,
        note: parsed.data.note,
      });
    }, PAGE_TRANSACTION_OPTIONS);

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'UPDATE',
      targetType: 'Page',
      targetId: parsed.data.id,
      summary: t.pages.versionSaved,
      detail: { kind: 'MANUAL' },
    });
  } catch (error) {
    console.error('[admin] create page version failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  return { status: 'success', message: t.pages.versionSaved };
}

/**
 * 恢复一个历史版本。
 *
 * 内容写回**草稿**而不是直接改线上（与商品一致）：恢复后它成为「待发布的改动」，
 * 确认无误再点发布，误点也能再退回去。
 *
 * 同时把译文同步状态清掉 —— 这条内容是**整体换掉的**，没经过翻译引擎。
 * 不清的话，同步状态会描述一个已经不存在的版本，界面会显示「已是最新」而实际不是。
 */
export async function restorePageVersionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const parsed = parseForm(
    z.object({
      id: z.string().trim().min(1, t.validation.invalidInput),
      versionId: z.string().trim().min(1, t.validation.invalidInput),
    }),
    formData,
    t,
  );
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const version = await db.pageVersion.findUnique({ where: { id: parsed.data.versionId } });
    if (!version || version.pageId !== parsed.data.id) {
      return { status: 'error', message: t.pages.versionMissing };
    }

    const restored = await restorePageVersionToDraft(db, parsed.data.id, version.snapshot);
    if (!restored) return { status: 'error', message: t.pages.versionMissing };

    await invalidateTranslationState(db, 'page', parsed.data.id);

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'UPDATE',
      targetType: 'Page',
      targetId: parsed.data.id,
      summary: t.pages.versionRestored,
      detail: { versionId: version.id },
    });
  } catch (error) {
    console.error('[admin] restore page version failed:', error);
    return { status: 'error', message: t.actions.operationFailed };
  }

  return { status: 'success', message: t.pages.versionRestored };
}

export async function deletePageVersionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const parsed = parseForm(
    z.object({
      id: z.string().trim().min(1, t.validation.invalidInput),
      versionId: z.string().trim().min(1, t.validation.invalidInput),
    }),
    formData,
    t,
  );
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const version = await db.pageVersion.findUnique({ where: { id: parsed.data.versionId } });
    if (!version || version.pageId !== parsed.data.id) {
      return { status: 'error', message: t.pages.versionMissing };
    }
    await db.pageVersion.delete({ where: { id: version.id } });

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'DELETE',
      targetType: 'Page',
      targetId: parsed.data.id,
      summary: t.pages.versionDeleted,
      detail: { versionId: version.id },
    });
  } catch (error) {
    console.error('[admin] delete page version failed:', error);
    return { status: 'error', message: t.actions.operationFailed };
  }

  return { status: 'success', message: t.pages.versionDeleted };
}

