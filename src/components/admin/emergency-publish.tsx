'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { emergencyPublishAction, retryCatchUpAction } from '@/lib/admin/actions/emergency';
import { advanceJobAction } from '@/lib/admin/actions/sync';
import { initialFormState } from '@/lib/admin/action-state';
import { Alert, Field, TextArea, SubmitButton } from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';
import { describeBlockedReason, describeFailureKind } from '@/lib/admin/emergency-labels';
import type { EmergencyOffer } from '@/lib/admin/action-state';

/**
 * 应急发布面板 —— 「应急发布中文，其他语言稍后同步」。
 *
 * 它**默认不出现**：只有发布因为翻译服务暂时不可用而失败时，调用方才拿到一个
 * `eligible` 的 offer，这时才渲染。
 *
 * 两道确认是刻意的：先点开面板，再填一句原因，最后按「仅发布中文」。
 * 这个按钮的后果（一部分语言暂时停在旧版本）不该由一次误触产生，
 * 而「填一句为什么」也正好是审计日志需要的那条信息。
 */
export function EmergencyPublishPanel({
  entityType,
  entityId,
  offer,
}: {
  entityType: 'product' | 'page';
  entityId: string;
  offer: EmergencyOffer;
}) {
  const t = useAdminT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(emergencyPublishAction, initialFormState);

  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);

  // 服务端最终判定不可应急时，如实说明原因 —— 只说「不行」帮不上忙，
  // 「没配 Key」和「内容有问题」的下一步完全不同
  if (!offer.eligible) {
    return (
      <div className="mt-3">
        <Alert kind="info">{describeBlockedReason(offer.reason, t)}</Alert>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
        <div className="text-sm text-amber-900">
          <p className="font-medium">{describeFailureKind(offer.failureKind, t)}</p>
          <p className="mt-0.5 text-xs">{t.emergency.hint}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ml-auto inline-flex h-9 shrink-0 items-center rounded-full border border-amber-400 bg-white px-4 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100"
        >
          {t.emergency.button}
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-4">
      <input type="hidden" name="entityType" value={entityType} />
      <input type="hidden" name="id" value={entityId} />

      <div className="text-sm text-amber-900">
        <p className="font-medium">{t.emergency.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed">{t.emergency.hint}</p>
      </div>

      <Field label={t.emergency.reasonLabel} htmlFor="emergency-reason">
        <TextArea
          id="emergency-reason"
          name="reason"
          rows={2}
          maxLength={200}
          required
          placeholder={t.emergency.reasonPlaceholder}
        />
      </Field>

      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}
      {state.status === 'success' && state.message ? (
        <Alert kind="success">{state.message}</Alert>
      ) : null}

      <div className="flex items-center gap-3">
        <SubmitButton pendingText={t.common.processing}>{t.emergency.confirm}</SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-navy-700 underline-offset-2 hover:underline"
        >
          {t.emergency.cancel}
        </button>
      </div>
    </form>
  );
}

/**
 * 「多语言待同步」的常驻提醒。
 *
 * 只要这条内容最近一次发布是应急发布，它就一直在 —— 不依赖某个人记得回来看。
 * 补齐任务跑完（自动或手动）之后，它自己会消失。
 */
export function PendingTranslationBanner({
  entityType,
  entityId,
  reason,
  failureKind,
  jobId,
}: {
  entityType: 'product' | 'page';
  entityId: string;
  reason: string | null;
  failureKind: string | null;
  /** 已排好的补齐任务；有它就显示进度，没有就现建一个 */
  jobId: string | null;
}) {
  const t = useAdminT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);

  const retry = () => {
    setNotice(null);
    startTransition(async () => {
      let result;
      try {
        result = await retryCatchUpAction({ entityType, entityId });
      } catch {
        setNotice({ kind: 'error', text: t.actions.networkFailed });
        return;
      }

      if (result.status === 'error') {
        setNotice({ kind: 'error', text: result.message ?? t.actions.operationFailed });
        return;
      }
      setNotice({ kind: result.status === 'success' ? 'success' : 'info', text: result.message ?? '' });

      // 任务没跑完就接着推，与发布那边的做法一致
      if (result.jobId) {
        const jobIdToDrive = result.jobId;
        let guard = 0;
        for (;;) {
          if (guard >= 200) break;
          guard += 1;
          await new Promise((resolve) => setTimeout(resolve, 800));

          let next: Awaited<ReturnType<typeof advanceJobAction>>;
          try {
            next = await advanceJobAction({ jobId: jobIdToDrive });
          } catch {
            setNotice({ kind: 'error', text: t.actions.networkFailed });
            return;
          }
          if (next.progress) setNotice({ kind: next.ok ? 'success' : 'info', text: next.message });
          if (!next.hasMore) break;
        }
      }
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
      <p className="font-semibold">{t.emergency.statusPending}</p>
      <p className="mt-1 text-xs leading-relaxed">{t.emergency.statusPendingHint}</p>
      {reason ? (
        <p className="mt-1 text-xs">
          {reason}
          {failureKind ? ` · ${describeFailureKind(failureKind, t)}` : ''}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={retry}
          className="inline-flex h-9 items-center rounded-full border border-amber-400 bg-white px-4 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-60"
        >
          {pending ? t.sync.running : t.emergency.retryNow}
        </button>
        {jobId ? <span className="font-mono text-[11px] text-amber-800">{jobId.slice(0, 8)}</span> : null}
      </div>

      {notice ? (
        <div className="mt-3">
          <Alert kind={notice.kind}>{notice.text}</Alert>
        </div>
      ) : null}
    </div>
  );
}
