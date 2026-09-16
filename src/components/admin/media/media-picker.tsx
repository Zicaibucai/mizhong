'use client';

import { useState, useTransition } from 'react';
import { listMediaAssetsAction, type MediaPickerAsset } from '@/lib/admin/actions/media';
import { formatFileSize } from './utils';
import { MediaThumb } from './media-thumb';

/**
 * 媒体库选择器（可复用）。
 *
 * 供商品封面、分类封面等模块使用：表单里放一个隐藏字段承载所选素材 id。
 * 文案全部由调用方从后台字典传入（本组件不硬编码任何用户可见文案），
 * 数据通过 Server Action `listMediaAssetsAction` 读取，因此不需要新增 API 路由。
 */
export interface MediaPickerLabels {
  choose: string;
  change: string;
  remove: string;
  noSelection: string;
  dialogTitle: string;
  search: string;
  allTypes: string;
  images: string;
  videos: string;
  empty: string;
  close: string;
  loading: string;
}

export function MediaPicker({
  name,
  assetId = null,
  previewUrl = null,
  accept = 'image',
  labels,
}: {
  /** 隐藏表单字段名（提交所选的素材 id） */
  name: string;
  assetId?: string | null;
  previewUrl?: string | null;
  accept?: 'image' | 'video' | 'all';
  labels: MediaPickerLabels;
}) {
  const [selected, setSelected] = useState<{ id: string | null; url: string | null }>({
    id: assetId,
    url: previewUrl,
  });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'image' | 'video'>('image');
  const [assets, setAssets] = useState<MediaPickerAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  function load(nextQuery: string, nextType: 'image' | 'video') {
    setLoading(true);
    startTransition(async () => {
      const result = await listMediaAssetsAction({
        q: nextQuery,
        type: accept === 'all' ? nextType : accept,
      });
      setAssets(result.assets);
      setLoading(false);
    });
  }

  function openPicker() {
    setOpen(true);
    load(query, type);
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={selected.id ?? ''} />

      <div className="flex flex-wrap items-center gap-3">
        {selected.url ? (
          <MediaThumb
            type={accept === 'video' ? 'video' : 'image'}
            url={selected.url}
            thumbnailUrl={selected.url}
            alt=""
            fallbackLabel={labels.noSelection}
            className="h-16 w-16"
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openPicker}
            className="inline-flex h-9 items-center justify-center rounded-full border border-navy-300 px-4 text-sm text-navy-900 transition-colors hover:bg-navy-50"
          >
            {selected.id ? labels.change : labels.choose}
          </button>
          {selected.id ? (
            <button
              type="button"
              onClick={() => setSelected({ id: null, url: null })}
              className="rounded-full px-3 py-1.5 text-sm text-navy-600 hover:bg-navy-100"
            >
              {labels.remove}
            </button>
          ) : (
            <span className="text-sm text-muted">{labels.noSelection}</span>
          )}
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={labels.dialogTitle}
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-navy-200 bg-white"
          >
            <div className="flex items-center justify-between gap-4 border-b border-navy-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-navy-900">{labels.dialogTitle}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-3 py-1.5 text-sm text-navy-600 hover:bg-navy-100"
              >
                {labels.close}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-navy-100 px-5 py-3">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  load(query, type);
                }}
                className="flex flex-1 items-center gap-2"
              >
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={labels.search}
                  className="block w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-navy-300 focus:border-copper-500 focus:outline-none focus:ring-2 focus:ring-copper-500/30"
                />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center justify-center rounded-full border border-navy-300 px-4 text-sm text-navy-900 hover:bg-navy-50"
                >
                  {labels.search}
                </button>
              </form>

              {accept === 'all' ? (
                <div className="flex items-center gap-1">
                  {(
                    [
                      ['image', labels.images],
                      ['video', labels.videos],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setType(value);
                        load(query, value);
                      }}
                      className={
                        type === value
                          ? 'rounded-full bg-navy-900 px-3 py-1 text-xs text-ivory-50'
                          : 'rounded-full border border-navy-300 px-3 py-1 text-xs text-navy-800 hover:bg-navy-50'
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {loading ? (
                <span className="text-sm text-muted">{labels.loading}</span>
              ) : assets.length === 0 ? (
                <p className="text-sm text-muted">{labels.empty}</p>
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {assets.map((asset) => (
                    <li key={asset.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected({
                            id: asset.id,
                            url: asset.thumbnailUrl ?? asset.url,
                          });
                          setOpen(false);
                        }}
                        className="w-full space-y-2 rounded-xl border border-navy-200 p-2 text-left transition-colors hover:border-copper-400 hover:bg-copper-50"
                      >
                        <MediaThumb
                          type={asset.type}
                          url={asset.url}
                          thumbnailUrl={asset.thumbnailUrl}
                          alt={asset.label}
                          fallbackLabel={labels.videos}
                          className="h-24 w-full"
                        />
                        <span className="block truncate text-xs font-medium text-navy-900">
                          {asset.label}
                        </span>
                        <span className="block text-[11px] text-muted">
                          {formatFileSize(asset.size)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
