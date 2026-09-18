'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { setProductPublishedAction } from '@/lib/admin/actions/products';
import { advanceJobAction } from '@/lib/admin/actions/sync';
import { initialFormState } from '@/lib/admin/action-state';
import { formatMessage } from '@/lib/admin/i18n';
import { Alert } from '@/components/admin/form';
import { useAdminLocale, useAdminT } from '@/components/admin/i18n-provider';
import { cn } from '@/lib/cn';
import { EmergencyPublishPanel, PendingTranslationBanner } from '@/components/admin/emergency-publish';
import { useActiveTab, useSaveStatuses, type SaveStatus } from './tabs';
import type { ProductEditorData } from './types';

/** 汇总各分区的保存状态：失败 > 保存中 > 待保存 > 已保存 */
function aggregate(statuses: Record<string, SaveStatus>): SaveStatus {
  const values = Object.values(statuses);
  if (values.includes('error')) return 'error';
  if (values.includes('saving')) return 'saving';
  if (values.includes('pending')) return 'pending';
  if (values.includes('saved')) return 'saved';
  return 'idle';
}

/**
 * 商品编辑器的吸顶操作栏。
 *
 * 与改造前最大的不同：这里显示的是**保存状态**而不是「保存按钮」。
 * 改动会在停止输入 1.5 秒后自动写进草稿，所以顶部主要回答一个问题：
 * 「我的改动存下来了吗？」
 *
 * 「发布」是整个系统里唯一让改动对客人可见的动作 —— 在按下它之前，
 * 前台一直显示上一版内容。
 */
export function ProductActionBar({
  data,
  saveFormIds,
}: {
  data: ProductEditorData;
  /** A visual editor has several independent server-action forms on screen. */
  saveFormIds?: string[];
}) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const router = useRouter();
  const active = useActiveTab();
  const statuses = useSaveStatuses();
  const product = data.product;

  const [state, formAction] = useActionState(setProductPublishedAction, initialFormState);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const status = aggregate(statuses);

  // 记下最后一次保存成功的时间：只在「刚保存完」时打一次时间戳
  useEffect(() => {
    if (status !== 'saved') return;
    setSavedAt(
      // 后台界面只有中/英两种语言
      new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
        timeStyle: 'short',
      }).format(new Date()),
    );
  }, [status, locale]);

  // 发布状态与草稿都会影响前台，所以在发布后重新读取服务端数据
  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);

  /**
   * 发布自带的译文同步没跑完时，在这里把它推完。
   *
   * 服务端每次只推进一段预算就返回（不会有一个挂满 60 秒的请求），所以由前端接着
   * 调 `advanceJobAction`；跑完之后自动再提交一次发布，管理员不需要再点第二下。
   *
   * 两条防重复：同一个任务 id 只自动重提一次；失败时不再重提 ——
   * 否则「翻译一直失败」会变成「一直自动重试」，把 API 额度烧光。
   */
  const publishFormRef = useRef<HTMLFormElement | null>(null);
  const resubmitted = useRef<string | null>(null);
  const jobId = state.jobId;

  useEffect(() => {
    if (!jobId || resubmitted.current === jobId) return;
    let cancelled = false;

    void (async () => {
      let guard = 0;
      while (!cancelled && guard < 200) {
        guard += 1;

        // 调用 Server Action 本质是一次 fetch：断网、服务器重启、代理超时都会让它
        // 抛异常。这里没有表单会被毁掉，所以静默停下即可 —— 任务状态还在数据库里，
        // 再点一次发布就从这里继续。但仍然要接住异常：未处理的拒绝不该流淌到 React 外面。
        let next: Awaited<ReturnType<typeof advanceJobAction>>;
        try {
          next = await advanceJobAction({ jobId });
        } catch {
          return;
        }

        if (next.hasMore) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          continue;
        }

        // 同步完成且没有失败 → 自动重新提交发布，这一次会真正写进线上
        if (next.ok && (next.progress?.failed ?? 0) === 0) {
          resubmitted.current = jobId;
          publishFormRef.current?.requestSubmit();
        }
        return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  /**
   * 有没有待发布的改动。
   *
   * 服务端的 `pendingChanges` 是页面加载时的快照；本次会话里刚自动保存的改动还没
   * 经过刷新，所以要把客户端状态一并算进来：正在保存（saving）或排队等待保存（pending）
   * 都算「有改动」—— 否则在自动保存进行中的那一两秒里，顶部会以为无事发生。
   *
   * 这个判断只用来**禁用**按钮，绝不用来切换按钮的动作（见下方两个按钮的说明）。
   */
  const busy = Array.from(Object.values(statuses)).some(
    (value) => value === 'saving' || value === 'pending',
  );
  const pending = data.pendingChanges.length > 0 || status === 'saved' || busy;

  const statusText =
    status === 'error'
      ? t.products.saveStatusFailed
      : status === 'saving'
        ? t.products.saveStatusSaving
        : status === 'pending'
          ? t.products.saveStatusPending
          : savedAt
            ? `${t.products.saveStatusIdle} · ${savedAt}`
            : t.products.saveStatusIdle;

  const blocked = data.publishBlockers.length > 0;
  /** 发布自带的译文同步正在跑：按钮显示「同步中」并禁用，避免重复触发 */
  const syncing = Boolean(jobId);
  const saveTargets = active === 'visual' ? saveFormIds ?? [] : [];
  const saveVisualForms = () => {
    for (const formId of saveTargets) {
      const form = document.getElementById(formId);
      if (form instanceof HTMLFormElement) form.requestSubmit();
    }
  };

  return (
    <div className="sticky top-0 z-20 -mx-5 border-b border-navy-200 bg-ivory-50/95 px-5 py-3 backdrop-blur lg:-mx-8 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs',
            product.published ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
          )}
        >
          {product.published ? t.products.statusPublished : t.products.statusDraft}
        </span>

        <span
          aria-live="polite"
          className={cn(
            'flex items-center gap-1.5 text-xs',
            status === 'error' ? 'font-medium text-copper-700' : 'text-muted',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              status === 'error'
                ? 'bg-copper-600'
                : status === 'pending' || status === 'saving'
                  ? 'bg-navy-400'
                  : 'bg-emerald-500',
            )}
          />
          {statusText}
        </span>

        <p className="hidden text-xs text-muted xl:block">{t.products.autosaveHint}</p>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {saveTargets.length > 0 ? (
            <button
              type="button"
              onClick={saveVisualForms}
              className="inline-flex h-10 items-center rounded-full border border-navy-300 px-5 text-sm font-medium text-navy-800 transition-colors hover:bg-navy-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
            >
              {t.products.saveDraft}
            </button>
          ) : null}

          {/*
            发布与取消发布是**两个独立的按钮**，不是一个按钮按状态改文案。
            合成一个的话，按钮的含义会取决于一个客户端猜测的「有没有待发布改动」：
            在自动保存进行中的那一两秒里猜错，点「发布」就会变成「取消发布」——
            而这是个上线/下架级别的大动作。文案写死，猜错的代价最多是按钮禁用。
          */}
          {!product.published ? (
            <form action={formAction} ref={publishFormRef}>
              <input type="hidden" name="id" value={product.id} />
              <input type="hidden" name="target" value="publish" />
              <button
                type="submit"
                disabled={syncing}
                className="inline-flex h-10 items-center rounded-full bg-copper-700 px-5 text-sm font-medium text-ivory-50 transition-colors hover:bg-copper-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {syncing ? t.sync.running : t.products.publish}
              </button>
            </form>
          ) : (
            <>
              <form action={formAction} ref={publishFormRef}>
                <input type="hidden" name="id" value={product.id} />
                <input type="hidden" name="target" value="publish" />
                <button
                  type="submit"
                  disabled={(!pending && !busy) || syncing}
                  className="inline-flex h-10 items-center rounded-full bg-copper-700 px-5 text-sm font-medium text-ivory-50 transition-colors hover:bg-copper-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {syncing ? t.sync.running : t.products.publishChanges}
                </button>
              </form>
              <form action={formAction}>
                <input type="hidden" name="id" value={product.id} />
                <input type="hidden" name="target" value="draft" />
                <button
                  type="submit"
                  className="inline-flex h-10 items-center rounded-full border border-navy-300 px-5 text-sm font-medium text-navy-800 transition-colors hover:bg-navy-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
                >
                  {t.products.unpublish}
                </button>
              </form>
            </>
          )}

          <Link
            href={data.previewHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center rounded-full border border-navy-300 px-5 text-sm font-medium text-navy-800 transition-colors hover:bg-navy-50"
          >
            {t.products.preview} ↗
          </Link>
        </div>
      </div>

      {pending ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <span className="font-medium">
            {data.pendingChanges.length === 1
              ? t.products.pendingChangesOne
              : formatMessage(t.products.pendingChanges, {
                  count: Math.max(data.pendingChanges.length, 1),
                })}
          </span>
          <span className="text-xs">{t.products.pendingChangesHint}</span>
        </div>
      ) : null}

      {blocked && !product.published ? (
        <div className="mt-3">
          <Alert kind="error">
            {`${t.products.validationTitle}: ${data.publishBlockers.join(' ')}`}
          </Alert>
        </div>
      ) : null}

      {state.status === 'error' && state.message ? (
        <div className="mt-3">
          <Alert kind="error">{state.message}</Alert>
        </div>
      ) : null}
      {state.status === 'success' && state.message ? (
        <div className="mt-3">
          <Alert kind="success">{state.message}</Alert>
        </div>
      ) : null}
      {state.status === 'idle' && state.message ? (
        <div className="mt-3">
          <Alert kind="info">{state.message}</Alert>
        </div>
      ) : null}

      {/* 译文同步的进度条：让「发布还差多少种语言」这件事看得见 */}
      {syncing && state.progress ? (
        <div className="mt-3 space-y-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy-100">
            <div
              className="h-full rounded-full bg-copper-600 transition-[width] duration-500"
              style={{
                width: `${
                  state.progress.total > 0
                    ? Math.min(
                        100,
                        Math.round(
                          ((state.progress.completed + state.progress.failed) / state.progress.total) * 100,
                        ),
                      )
                    : 0
                }%`,
              }}
            />
          </div>
          <p className="text-xs text-muted">
            {formatMessage(t.sync.jobSummary, {
              completed: state.progress.completed,
              total: state.progress.total,
              failed: state.progress.failed,
            })}
          </p>
        </div>
      ) : null}

      {/*
        应急发布：只有发布因为翻译服务暂时不可用而失败时，服务端才会带回来一个
        eligible 的 offer，这时才渲染。其余情况（内容问题、配置问题）显示的是
        「为什么不能应急、下一步做什么」。
      */}
      {state.emergency ? (
        <EmergencyPublishPanel entityType="product" entityId={product.id} offer={state.emergency} />
      ) : null}

      {/* 常驻提醒：只要这条内容最近一次发布是应急发布就一直显示 */}
      {data.pendingEmergency ? (
        <div className="mt-3">
          <PendingTranslationBanner
            entityType="product"
            entityId={product.id}
            reason={data.pendingEmergency.reason}
            failureKind={data.pendingEmergency.failureKind}
            jobId={data.pendingEmergency.jobId}
          />
        </div>
      ) : null}
    </div>
  );
}
