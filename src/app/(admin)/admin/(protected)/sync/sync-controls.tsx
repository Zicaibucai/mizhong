'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  advanceJobAction,
  retryFailedAction,
  syncAllContentAction,
  syncContentAction,
  type SyncActionResult,
} from '@/lib/admin/actions/sync';
import { formatMessage } from '@/lib/admin/i18n';
import type { PublishProgress } from '@/lib/admin/action-state';
import { Alert } from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';
import { cn } from '@/lib/cn';

/**
 * 「语言同步」页的按钮与进度。
 *
 * 长任务的关键在这一段：按钮点下去之后，服务端**只推进一轮**（十几秒）并把任务 id
 * 返回；这里再接着调 `advanceJobAction`，直到没有待处理项为止。这样做的好处是
 * 每个请求都很短 —— 不会出现一个挂满 60 秒的请求被代理掐断，而任务状态早就
 * 落在数据库里了，所以就算这一页被关掉，下次打开还是接着做，不会重来。
 *
 * 所有 Server Action 调用都包 try/catch：调用它们本质是一次 fetch，断网、重启、
 * 代理超时都会让它抛异常。抛在 transition 里会被 React 升成渲染错误、
 * 整页白屏 —— 同步失败可以重来，白屏不行。
 */

/** 两轮推进之间的间隔：给限流留一点余量，也让界面有机会刷新进度 */
const ADVANCE_INTERVAL_MS = 800;

/** 失败明细的条目 */
type SyncErrorRow = NonNullable<SyncActionResult['errors']>[number];

export function SyncControls({
  initial,
}: {
  /** 初始进度：如果进来时正好有任务在跑，直接接着显示 */
  initial: { id: string; progress: PublishProgress } | null;
}) {
  const t = useAdminT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [job, setJob] = useState<{ id: string; progress: PublishProgress | undefined } | null>(initial);
  const [errors, setErrors] = useState<SyncErrorRow[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const stopped = useRef(false);

  useEffect(() => () => { stopped.current = true; }, []);

  /** 一轮一轮推进，直到服务端说没有待处理项 */
  const drive = useCallback(
    async (jobId: string) => {
      const current = jobId;
      let guard = 0;

      while (!stopped.current && guard < 200) {
        guard += 1;

        let result: SyncActionResult;
        try {
          result = await advanceJobAction({ jobId: current });
        } catch {
          setNotice({ kind: 'error', text: t.actions.networkFailed });
          return;
        }

        if (result.progress) setJob({ id: current, progress: result.progress });
        if (result.errors?.length) setErrors((prev) => mergeErrors(prev, result.errors!));

        if (!result.ok && !result.hasMore) {
          setNotice({ kind: 'error', text: result.message });
          router.refresh();
          return;
        }

        if (!result.hasMore) {
          setNotice({
            kind: result.ok ? 'success' : 'info',
            text: result.message,
          });
          router.refresh();
          return;
        }

        // 还没做完：稍等一下再来一轮
        await new Promise((resolve) => setTimeout(resolve, ADVANCE_INTERVAL_MS));
      }
    },
    [router, t.actions.networkFailed],
  );

  const run = (fn: () => Promise<SyncActionResult>) => {
    setNotice(null);
    setErrors([]);
    startTransition(async () => {
      let result: SyncActionResult;
      try {
        result = await fn();
      } catch {
        setNotice({ kind: 'error', text: t.actions.networkFailed });
        return;
      }

      if (result.progress) setJob(result.jobId ? { id: result.jobId, progress: result.progress } : null);
      if (result.errors?.length) setErrors(result.errors);

      if (result.idle) {
        setNotice({ kind: 'info', text: result.message });
        return;
      }

      if (!result.ok && !result.hasMore) {
        setNotice({ kind: 'error', text: result.message });
        router.refresh();
        return;
      }

      if (!result.hasMore) {
        setNotice({ kind: result.ok ? 'success' : 'info', text: result.message });
        router.refresh();
        return;
      }

      setNotice({ kind: 'info', text: result.message });
      if (result.jobId) await drive(result.jobId);
    });
  };

  const progress = job?.progress;
  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round(((progress.completed + progress.failed) / progress.total) * 100))
      : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => syncAllContentAction())}
          className="inline-flex h-10 items-center rounded-full bg-copper-700 px-5 text-sm font-medium text-ivory-50 transition-colors hover:bg-copper-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? t.sync.running : t.sync.syncAll}
        </button>

        {/*
          「重新翻译全部语言」是一个单独按钮，不藏在选项里。
          它会把人工写过的措辞一起覆盖掉，所以要人明确点一次、并且先看到后果说明。
        */}
        <button
          type="button"
          disabled={pending}
          title={t.sync.forceHint}
          onClick={() => {
            if (!window.confirm(`${t.sync.forceAll}\n\n${t.sync.forceHint}`)) return;
            run(() => syncAllContentAction({ force: true }));
          }}
          className="inline-flex h-10 items-center rounded-full border border-navy-300 px-5 text-sm font-medium text-navy-800 transition-colors hover:bg-navy-50 disabled:opacity-60"
        >
          {t.sync.forceAll}
        </button>

        {job ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => retryFailedAction({ jobId: job.id }))}
            className="inline-flex h-10 items-center rounded-full border border-navy-300 px-5 text-sm font-medium text-navy-800 transition-colors hover:bg-navy-50 disabled:opacity-60"
          >
            {t.sync.retryFailed}
          </button>
        ) : null}

        {errors.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowErrors((value) => !value)}
            className="text-sm text-copper-700 underline-offset-2 hover:underline"
          >
            {showErrors ? t.sync.hideErrors : t.sync.viewErrors}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => router.refresh()}
          className="ml-auto text-sm text-navy-700 underline-offset-2 hover:underline"
        >
          {t.sync.refresh}
        </button>
      </div>

      {progress && pending ? (
        <div className="space-y-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy-100">
            <div
              className="h-full rounded-full bg-copper-600 transition-[width] duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-xs text-muted">
            {formatMessage(t.sync.jobSummary, {
              completed: progress.completed,
              total: progress.total,
              failed: progress.failed,
            })}
            {progress.failed > 0 ? ` · ${t.sync.viewErrors}` : ''}
          </p>
        </div>
      ) : null}

      {notice ? <Alert kind={notice.kind}>{notice.text}</Alert> : null}

      {showErrors && errors.length > 0 ? (
        <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {errors.map((item, index) => (
            <li key={`${item.entityType}-${item.entityId}-${item.locale}-${index}`}>
              <span className="font-mono">{item.entityType}</span>
              {' · '}
              <span className="font-mono">{item.locale}</span>
              {' — '}
              {item.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function mergeErrors(prev: SyncErrorRow[], next: SyncErrorRow[]): SyncErrorRow[] {
  const seen = new Set(prev.map((item) => `${item.entityType}:${item.entityId}:${item.locale}`));
  return [...prev, ...next.filter((item) => !seen.has(`${item.entityType}:${item.entityId}:${item.locale}`))];
}

/** 单条内容的「同步」按钮 */
export function SyncOneButton({ entityType, entityId }: { entityType: string; entityId: string }) {
  const t = useAdminT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const run = () => {
    setMessage(null);
    startTransition(async () => {
      let result: SyncActionResult;
      try {
        result = await syncContentAction({ entityType, entityId });
      } catch {
        setMessage(t.actions.networkFailed);
        setFailed(true);
        return;
      }

      setFailed(!result.ok);
      setMessage(result.message);

      const jobId = result.jobId;
      let hasMore = result.hasMore;
      let guard = 0;
      while (jobId && hasMore && guard < 200) {
        guard += 1;
        await new Promise((resolve) => setTimeout(resolve, ADVANCE_INTERVAL_MS));

        let next: SyncActionResult;
        try {
          next = await advanceJobAction({ jobId });
        } catch {
          setFailed(true);
          setMessage(t.actions.networkFailed);
          break;
        }

        hasMore = Boolean(next.hasMore);
        setFailed(!next.ok);
        setMessage(next.message);
      }

      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className="rounded-full border border-navy-300 px-3 py-1 text-xs font-medium text-navy-800 transition-colors hover:bg-navy-50 disabled:opacity-60"
      >
        {pending ? t.sync.running : t.sync.syncOne}
      </button>
      {message ? (
        <span className={cn('text-xs', failed ? 'text-copper-700' : 'text-muted')}>{message}</span>
      ) : null}
    </div>
  );
}
