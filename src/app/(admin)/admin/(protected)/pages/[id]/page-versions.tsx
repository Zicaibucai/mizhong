'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  createPageVersionAction,
  deletePageVersionAction,
  restorePageVersionAction,
} from '@/lib/admin/actions/pages';
import { initialFormState } from '@/lib/admin/action-state';
import { Alert, SubmitButton } from '@/components/admin/form';
import { useAdminLocale, useAdminT } from '@/components/admin/i18n-provider';
import { cn } from '@/lib/cn';

export interface PageVersionRow {
  id: string;
  kind: 'PUBLISHED' | 'MANUAL';
  createdAt: string;
  note: string | null;
  createdBy: string | null;
  /** 快照里的中文标题，用于一眼认出是哪一版 */
  snapshotTitle: string;
  /** 该版本是否属于同一批发布（releaseId 一致说明中文和各语言是一起上线的） */
  releaseId: string | null;
}

/**
 * 页面的版本历史 —— 与商品同一套规则：
 * 发布时自动留一版、也可以手动存档，最多保留三个，恢复写回**草稿**而不是直接改线上。
 *
 * `releaseId` 显示出来是有意的：它回答「这一版的中文和各语言是不是同一次发布出去的」。
 * 回滚一整组语言时，这就是判断边界的依据。
 */
export function PageVersions({
  pageId,
  versions,
}: {
  pageId: string;
  versions: PageVersionRow[];
}) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const router = useRouter();

  const [saveState, saveAction] = useActionState(createPageVersionAction, initialFormState);
  const [restoreState, restoreAction] = useActionState(restorePageVersionAction, initialFormState);
  const [deleteState, deleteAction] = useActionState(deletePageVersionAction, initialFormState);

  useEffect(() => {
    if (saveState.status === 'success' || restoreState.status === 'success' || deleteState.status === 'success') {
      router.refresh();
    }
  }, [saveState, restoreState, deleteState, router]);

  const notice =
    [saveState, restoreState, deleteState].find((state) => state.status === 'error' && state.message) ?? null;

  return (
    <div className="space-y-4">
      {notice ? <Alert kind="error">{notice.message}</Alert> : null}

      <form action={saveAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={pageId} />
        <label className="flex flex-1 flex-col gap-1 text-sm text-navy-800">
          {t.pageDetail.versionNote}
          <input
            type="text"
            name="note"
            maxLength={200}
            placeholder={t.pageDetail.versionNotePlaceholder}
            className="h-10 min-w-56 rounded-lg border border-navy-300 px-3 text-sm"
          />
        </label>
        <SubmitButton pendingText={t.common.saving}>{t.pageDetail.saveVersion}</SubmitButton>
      </form>

      {versions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-navy-200 px-5 py-6 text-sm text-muted">
          {t.pageDetail.noVersions}
        </p>
      ) : (
        <ul className="divide-y divide-navy-50 rounded-xl border border-navy-200">
          {versions.map((version) => (
            <li key={version.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs',
                  version.kind === 'PUBLISHED'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-navy-100 text-navy-700',
                )}
              >
                {version.kind === 'PUBLISHED' ? t.pageDetail.versionPublished : t.pageDetail.versionManual}
              </span>

              <span className="text-sm font-medium text-navy-900">
                {version.snapshotTitle || t.pageDetail.untitled}
              </span>

              {version.note ? <span className="text-xs text-muted">{version.note}</span> : null}

              <span className="text-xs text-muted">
                {new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(version.createdAt))}
                {version.createdBy ? ` · ${version.createdBy}` : ''}
              </span>

              {version.releaseId ? (
                <span className="font-mono text-[11px] text-navy-500" title={t.pageDetail.releaseHint}>
                  {version.releaseId.slice(0, 8)}
                </span>
              ) : null}

              <div className="ml-auto flex items-center gap-2">
                <form action={restoreAction}>
                  <input type="hidden" name="id" value={pageId} />
                  <input type="hidden" name="versionId" value={version.id} />
                  <button
                    type="submit"
                    className="rounded-full border border-navy-300 px-3 py-1 text-xs font-medium text-navy-800 transition-colors hover:bg-navy-50"
                  >
                    {t.pageDetail.restoreVersion}
                  </button>
                </form>
                <form action={deleteAction}>
                  <input type="hidden" name="id" value={pageId} />
                  <input type="hidden" name="versionId" value={version.id} />
                  <button
                    type="submit"
                    className="rounded-full border border-navy-200 px-3 py-1 text-xs text-muted transition-colors hover:bg-navy-50"
                  >
                    {t.common.delete}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs leading-relaxed text-muted">{t.pageDetail.versionHint}</p>
    </div>
  );
}
