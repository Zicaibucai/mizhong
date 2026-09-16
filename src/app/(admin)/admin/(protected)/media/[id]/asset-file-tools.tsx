'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { replaceAssetFileAction, setAssetPosterAction } from '@/lib/admin/actions/media';
import { Alert } from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';
import { cn } from '@/lib/cn';
import {
  ACCEPT_ATTRIBUTE,
  IMAGE_MIME_TYPES,
  precheckFile,
  uploadMediaFile,
} from '@/components/admin/media/upload-client';
import { describeUploadError } from '@/components/admin/media/utils';

type BusyKind = 'replace' | 'poster' | null;

interface TaskState {
  busy: BusyKind;
  percent: number;
  error: string | null;
  success: string | null;
}

const IDLE: TaskState = { busy: null, percent: 0, error: null, success: null };

/**
 * 替换文件 + 视频封面。
 *
 * 两个操作都先走上传接口（原始字节流 + 真实进度），上传成功后再调用 Server Action：
 *   - 替换：保留同一个素材 id，只换文件字段，因此商品图库 / 槽位绑定引用全部存活；
 *   - 封面：把新上传图片的地址写入 Asset.posterUrl。
 */
export function AssetFileTools({
  id,
  type,
  posterUrl,
}: {
  id: string;
  type: 'image' | 'video';
  posterUrl: string | null;
}) {
  const t = useAdminT();
  const router = useRouter();
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);
  const [task, setTask] = useState<TaskState>(IDLE);

  function patch(next: Partial<TaskState>) {
    setTask((previous) => ({ ...previous, ...next }));
  }

  async function pick(file: File | undefined, kind: Exclude<BusyKind, null>) {
    if (!file) return;
    setTask({ busy: kind, percent: 0, error: null, success: null });

    const problem = precheckFile(file);
    if (problem) {
      patch({ busy: null, error: describeUploadError(problem, t) });
      return;
    }

    const outcome = await uploadMediaFile(file, (percent) => patch({ percent })).promise;
    if (!outcome.ok) {
      patch({ busy: null, error: describeUploadError(outcome.code, t) });
      return;
    }

    const result =
      kind === 'replace'
        ? await replaceAssetFileAction({ assetId: id, sourceAssetId: outcome.asset.id })
        : await setAssetPosterAction({ assetId: id, posterAssetId: outcome.asset.id });

    if (result.status === 'error') {
      patch({ busy: null, error: result.message ?? t.actions.saveFailed });
      return;
    }

    patch({ busy: null, percent: 100, success: result.message ?? t.media.uploadSuccess });
    router.refresh();
  }

  async function removePoster() {
    setTask({ busy: 'poster', percent: 0, error: null, success: null });
    const result = await setAssetPosterAction({ assetId: id, posterAssetId: null });
    if (result.status === 'error') {
      patch({ busy: null, error: result.message ?? t.actions.saveFailed });
      return;
    }
    patch({ busy: null, success: null });
    router.refresh();
  }

  const progress = (
    <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-navy-100">
      <div
        className="h-full rounded-full bg-copper-500 transition-[width]"
        style={{ width: `${task.percent}%` }}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-navy-800">{t.media.replaceLabel}</h3>
        <p className="text-xs text-muted">{t.media.replaceHint}</p>
        <input
          ref={replaceInputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          onChange={(event) => {
            void pick(event.target.files?.[0], 'replace');
            event.target.value = '';
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => replaceInputRef.current?.click()}
            disabled={task.busy !== null}
            className={cn(
              'inline-flex h-10 items-center justify-center rounded-full border border-navy-300 px-5 text-sm text-navy-900 transition-colors hover:bg-navy-50',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            {task.busy === 'replace' ? `${t.media.uploading} ${task.percent}%` : t.media.replaceButton}
          </button>
          {task.busy === 'replace' ? progress : null}
        </div>
      </div>

      {type === 'video' ? (
        <div className="space-y-3 border-t border-navy-100 pt-5">
          <h3 className="text-sm font-medium text-navy-800">{t.media.posterLabel}</h3>
          <p className="text-xs text-muted">{t.media.posterHint}</p>

          {posterUrl ? (
            <div className="flex flex-wrap items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- 封面为 /media 静态资源 */}
              <img
                src={posterUrl}
                alt=""
                className="h-20 w-32 rounded-lg border border-navy-200 object-cover"
              />
              <div className="space-y-2">
                <span className="block text-xs text-muted">{t.media.posterCurrent}</span>
                <button
                  type="button"
                  onClick={() => void removePoster()}
                  disabled={task.busy !== null}
                  className="rounded-full border border-red-200 px-4 py-1.5 text-sm text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t.media.posterRemove}
                </button>
              </div>
            </div>
          ) : null}

          <input
            ref={posterInputRef}
            type="file"
            accept={IMAGE_MIME_TYPES.join(',')}
            className="sr-only"
            onChange={(event) => {
              void pick(event.target.files?.[0], 'poster');
              event.target.value = '';
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => posterInputRef.current?.click()}
              disabled={task.busy !== null}
              className={cn(
                'inline-flex h-10 items-center justify-center rounded-full border border-navy-300 px-5 text-sm text-navy-900 transition-colors hover:bg-navy-50',
                'disabled:cursor-not-allowed disabled:opacity-60',
              )}
            >
              {task.busy === 'poster'
                ? `${t.media.uploading} ${task.percent}%`
                : t.media.posterUpload}
            </button>
            {task.busy === 'poster' ? progress : null}
          </div>
        </div>
      ) : null}

      {task.error ? <Alert kind="error">{task.error}</Alert> : null}
      {task.success ? <Alert kind="success">{task.success}</Alert> : null}
    </div>
  );
}
