'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { attachUploadedAssetsAction } from '@/lib/admin/actions/products';
import { useAdminT } from '@/components/admin/i18n-provider';
import { cn } from '@/lib/cn';
import { describeUploadError, formatFileSize } from '@/components/admin/media/utils';
import {
  ACCEPT_ATTRIBUTE,
  precheckFile,
  uploadMediaFile,
  type UploadOutcome,
} from '@/components/admin/media/upload-client';

type ItemStatus = 'queued' | 'uploading' | 'success' | 'error';

interface UploadItem {
  key: string;
  file: File;
  status: ItemStatus;
  percent: number;
  errorCode?: string;
  /** 素材已创建但绑定失败时为 true，提示用户改用「从媒体库添加」 */
  bindFailed?: boolean;
}

let sequence = 0;

/**
 * 商品编辑器内直接上传。
 *
 * 上传与绑定分两步，但都在**同一个页面**里自动完成，管理员不需要先跳到媒体库：
 *   1. `POST /api/admin/media/upload`（原始字节流 + magic bytes 嗅探 + 大小上限）
 *      —— 复用与媒体库完全相同的接口，没有另写一套上传逻辑；
 *   2. `attachUploadedAssetsAction` 把新素材挂到当前商品（图片 → 图库，视频 → 图库视频）。
 *
 * 逐个上传（而不是并行）：大视频之间不会互相抢带宽，进度条也始终对应文件本身。
 */
export function ProductMediaUploader({ productId }: { productId: string }) {
  const t = useAdminT();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<UploadItem[]>([]);
  const runningRef = useRef(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [, startTransition] = useTransition();

  function commit(next: UploadItem[]) {
    itemsRef.current = next;
    setItems(next);
  }

  function patchItem(key: string, patch: Partial<UploadItem>) {
    commit(itemsRef.current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  async function processQueue() {
    if (runningRef.current) return;
    runningRef.current = true;
    let boundAny = false;

    try {
      for (;;) {
        const target = itemsRef.current.find((item) => item.status === 'queued');
        if (!target) break;

        patchItem(target.key, { status: 'uploading', percent: 0, errorCode: undefined });

        let outcome: UploadOutcome;
        try {
          outcome = await uploadMediaFile(target.file, (percent) =>
            patchItem(target.key, { percent }),
          ).promise;
        } catch {
          outcome = { ok: false, code: 'UPLOAD_FAILED' };
        }

        if (!outcome.ok) {
          patchItem(target.key, { status: 'error', errorCode: outcome.code });
          continue;
        }

        // 上传成功 → 立即绑定到当前商品；绑定失败不丢文件，只提示改用媒体库手动添加
        const attached = await attachUploadedAssetsAction({
          productId,
          assetIds: [outcome.asset.id],
        });

        if (attached.status === 'error') {
          patchItem(target.key, { status: 'error', errorCode: undefined, bindFailed: true });
          continue;
        }

        boundAny = true;
        patchItem(target.key, { status: 'success', percent: 100 });
      }
    } finally {
      runningRef.current = false;
      if (boundAny) startTransition(() => router.refresh());
    }
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const added: UploadItem[] = [];
    for (const file of Array.from(fileList)) {
      sequence += 1;
      // 客户端预检查只是为了更快反馈；服务端会重新嗅探真实类型
      const problem = precheckFile(file);
      added.push({
        key: `${sequence}-${file.name}-${file.size}`,
        file,
        status: problem ? 'error' : 'queued',
        percent: 0,
        errorCode: problem ?? undefined,
      });
    }
    commit([...itemsRef.current, ...added]);
    void processQueue();
  }

  function retry(key: string) {
    patchItem(key, { status: 'queued', percent: 0, errorCode: undefined, bindFailed: false });
    void processQueue();
  }

  function removeItem(key: string) {
    commit(itemsRef.current.filter((item) => item.key !== key));
  }

  const busy = items.some((item) => item.status === 'queued' || item.status === 'uploading');
  const successCount = items.filter((item) => item.status === 'success').length;

  return (
    <div className="space-y-3">
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
          dragging ? 'border-copper-500 bg-copper-50' : 'border-navy-200 bg-navy-50/40',
        )}
      >
        <p className="text-sm font-medium text-navy-900">{t.products.uploadDropzone}</p>
        <p className="mt-1 text-xs text-muted">{t.products.uploadDropzoneHint}</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-3 inline-flex h-9 items-center justify-center rounded-full bg-navy-900 px-5 text-sm font-medium text-ivory-50 transition-colors hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
        >
          {t.products.uploadChoose}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          onChange={(event) => {
            addFiles(event.target.files);
            // 允许重复选择同一个文件
            event.target.value = '';
          }}
        />
        <p className="mt-3 max-w-md text-xs text-muted">{t.products.uploadLimits}</p>
      </div>

      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.key} className="rounded-xl border border-navy-200 bg-white px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="min-w-0 flex-1 truncate font-medium text-navy-900">
                  {item.file.name}
                </span>
                <span className="text-xs text-muted">{formatFileSize(item.file.size)}</span>

                {item.status === 'success' ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700">
                    {t.products.uploadSuccess}
                  </span>
                ) : null}
                {item.status === 'error' ? (
                  <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs text-red-700">
                    {t.media.uploadFailed}
                  </span>
                ) : null}
                {item.status === 'uploading' ? (
                  <span className="text-xs text-muted">
                    {t.products.uploadBusy} {item.percent}%
                  </span>
                ) : null}

                {item.status === 'error' && !item.bindFailed ? (
                  <button
                    type="button"
                    onClick={() => retry(item.key)}
                    className="rounded-full border border-navy-300 px-3 py-1 text-xs text-navy-800 hover:bg-navy-50"
                  >
                    {t.media.retry}
                  </button>
                ) : null}
                {item.status !== 'uploading' ? (
                  <button
                    type="button"
                    onClick={() => removeItem(item.key)}
                    className="rounded-full px-3 py-1 text-xs text-navy-600 hover:bg-navy-100"
                  >
                    {t.media.remove}
                  </button>
                ) : null}
              </div>

              {item.status === 'uploading' ? (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-navy-100">
                  <div
                    className="h-full rounded-full bg-copper-500 transition-[width]"
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              ) : null}

              {item.status === 'error' ? (
                <p role="alert" className="mt-2 text-xs text-red-700">
                  {item.bindFailed
                    ? t.products.uploadBindFailed
                    : describeUploadError(item.errorCode ?? 'UPLOAD_FAILED', t)}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!busy && successCount > 0 ? (
        <p role="status" className="text-xs text-emerald-700">
          {t.products.uploadSuccess}
        </p>
      ) : null}
    </div>
  );
}
