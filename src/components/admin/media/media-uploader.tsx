'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useAdminT } from '@/components/admin/i18n-provider';
import { Alert } from '@/components/admin/form';
import { formatMessage } from '@/lib/admin/i18n';
import { cn } from '@/lib/cn';
import {
  ACCEPT_ATTRIBUTE,
  precheckFile,
  uploadMediaFile,
  type UploadOutcome,
} from './upload-client';
import { describeUploadError, formatFileSize } from './utils';

type ItemStatus = 'queued' | 'uploading' | 'success' | 'error';

interface UploadItem {
  /** 稳定的本地 key（同名文件可重复选择） */
  key: string;
  file: File;
  status: ItemStatus;
  percent: number;
  errorCode?: string;
  assetId?: string;
}

let sequence = 0;

export function MediaUploader() {
  const t = useAdminT();
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<UploadItem[]>([]);
  const runningRef = useRef(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);

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

        if (outcome.ok) {
          patchItem(target.key, { status: 'success', percent: 100, assetId: outcome.asset.id });
        } else {
          patchItem(target.key, { status: 'error', errorCode: outcome.code });
        }
      }
    } finally {
      runningRef.current = false;
    }
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const added: UploadItem[] = [];
    for (const file of Array.from(fileList)) {
      sequence += 1;
      // 客户端预检查只是为了更快给出反馈；服务端会重新嗅探真实类型
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
    patchItem(key, { status: 'queued', percent: 0, errorCode: undefined });
    void processQueue();
  }

  function removeItem(key: string) {
    commit(itemsRef.current.filter((item) => item.key !== key));
  }

  const busy = items.some((item) => item.status === 'queued' || item.status === 'uploading');
  const successCount = items.filter((item) => item.status === 'success').length;

  return (
    <div className="space-y-6">
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
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors',
          dragging ? 'border-copper-500 bg-copper-50' : 'border-navy-200 bg-white',
        )}
      >
        <p className="text-sm font-medium text-navy-900">{t.media.dropzone}</p>
        <p className="mt-1 text-xs text-muted">{t.media.dropzoneHint}</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-navy-900 px-5 text-sm font-medium text-ivory-50 transition-colors hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
        >
          {t.media.chooseFiles}
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
        <p className="mt-4 max-w-md text-xs text-muted">{t.media.limits}</p>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-navy-900">{t.media.selected}</h2>
          {busy ? <span className="text-xs text-muted">{t.media.uploading}</span> : null}
        </div>

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-navy-200 bg-white px-5 py-6 text-sm text-muted">
            {t.media.noFiles}
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.key}
                className="rounded-xl border border-navy-200 bg-white px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="min-w-0 flex-1 truncate font-medium text-navy-900">
                    {item.file.name}
                  </span>
                  <span className="text-xs text-muted">{formatFileSize(item.file.size)}</span>

                  {item.status === 'success' ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700">
                      {t.media.uploadSuccess}
                    </span>
                  ) : null}
                  {item.status === 'error' ? (
                    <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs text-red-700">
                      {t.media.uploadFailed}
                    </span>
                  ) : null}
                  {item.status === 'uploading' ? (
                    <span className="text-xs text-muted">
                      {t.media.uploading} {item.percent}%
                    </span>
                  ) : null}

                  {item.status === 'success' && item.assetId ? (
                    <Link
                      href={`/admin/media/${item.assetId}`}
                      className="text-sm text-copper-700 hover:underline"
                    >
                      {t.media.edit}
                    </Link>
                  ) : null}
                  {item.status === 'error' ? (
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

                {item.status === 'error' && item.errorCode ? (
                  <p role="alert" className="mt-2 text-xs text-red-700">
                    {describeUploadError(item.errorCode, t)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {!busy && successCount > 0 ? (
        <Alert kind="success">{formatMessage(t.media.uploadDone, { count: successCount })}</Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Link href="/admin/media" className="text-copper-700 hover:underline">
          ← {t.media.title}
        </Link>
      </div>
    </div>
  );
}
