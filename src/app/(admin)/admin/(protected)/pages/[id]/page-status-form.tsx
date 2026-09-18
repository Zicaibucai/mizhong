'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { setPageStatusAction } from '@/lib/admin/actions/pages';
import { advanceJobAction } from '@/lib/admin/actions/sync';
import { initialFormState } from '@/lib/admin/action-state';
import { formatMessage } from '@/lib/admin/i18n';
import { Alert } from '@/components/admin/form';
import { EmergencyPublishPanel } from '@/components/admin/emergency-publish';
import { useAdminT } from '@/components/admin/i18n-provider';

/**
 * Submit button for the publish control.
 *
 * The status value travels in a hidden input rather than on the button: React's form-action
 * serialisation does not include the submitter button's name/value, so a `<button name="status"
 * value="PUBLISHED">` arrives without `status` and the action always failed validation.
 */
function StatusSubmit({
  tone,
  pendingText,
  children,
}: {
  tone: 'primary' | 'secondary';
  pendingText: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        tone === 'primary'
          ? 'inline-flex h-10 items-center rounded-full bg-copper-700 px-5 text-sm font-medium text-ivory-50 transition-colors hover:bg-copper-800 disabled:opacity-60'
          : 'inline-flex h-10 items-center rounded-full border border-navy-300 px-5 text-sm font-medium text-navy-800 transition-colors hover:bg-navy-50 disabled:opacity-60'
      }
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function PageStatusForm({
  id,
  status,
}: {
  id: string;
  status: 'DRAFT' | 'PUBLISHED';
}) {
  const t = useAdminT();
  const router = useRouter();
  const [state, formAction] = useActionState(setPageStatusAction, initialFormState);
  const published = status === 'PUBLISHED';

  // 发布状态与草稿都会影响这一页的显示，成功后重新读取服务端数据
  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);

  /**
   * 发布自带的译文同步没跑完时把它推完 —— 与商品编辑器同一套做法。
   * 服务端每次只推进一段预算就返回，所以由前端接着调；跑完自动重新提交发布。
   * 同一个任务只自动重提一次，失败也不再重提，免得把 API 额度烧光。
   */
  const formRef = useRef<HTMLFormElement | null>(null);
  const resubmitted = useRef<string | null>(null);
  const jobId = state.jobId;

  useEffect(() => {
    if (!jobId || resubmitted.current === jobId) return;
    let cancelled = false;

    void (async () => {
      let guard = 0;
      while (!cancelled && guard < 200) {
        guard += 1;

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

        if (next.ok && (next.progress?.failed ?? 0) === 0) {
          resubmitted.current = jobId;
          formRef.current?.requestSubmit();
        }
        return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={published ? 'DRAFT' : 'PUBLISHED'} />

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-navy-700">
          {t.pageStatus.currentStatus}{' '}
          <span className={published ? 'text-emerald-700' : 'text-amber-700'}>
            {published ? t.pageStatus.published : t.pageStatus.draft}
          </span>
        </span>
        <StatusSubmit tone={published ? 'secondary' : 'primary'} pendingText={t.common.processing}>
          {published ? t.pageStatus.moveToDraft : t.pageStatus.publish}
        </StatusSubmit>
      </div>

      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}
      {state.status === 'success' && state.message ? (
        <Alert kind="success">{state.message}</Alert>
      ) : null}
      {state.status === 'idle' && state.message ? (
        <Alert kind="info">{state.message}</Alert>
      ) : null}

      {/* 译文同步的进度：让「发布还差多少种语言」看得见 */}
      {jobId && state.progress ? (
        <div className="space-y-1.5">
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
        eligible 的 offer，这时才渲染。
      */}
      {state.emergency ? (
        <EmergencyPublishPanel entityType="page" entityId={id} offer={state.emergency} />
      ) : null}
    </form>
  );
}
