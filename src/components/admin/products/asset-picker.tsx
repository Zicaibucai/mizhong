'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { PlayIcon } from '@/components/ui/icons';

/** An asset from the media library, as passed down to the admin forms (plain JSON). */
export interface PickerAsset {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  posterUrl: string | null;
  type: 'IMAGE' | 'VIDEO';
  name: string;
}

export interface AssetPickerLabels {
  /** Open the library and pick one */
  choose: string;
  /** Open the library and pick another one */
  change: string;
  remove: string;
  /** Nothing selected yet */
  none: string;
  /** The media library is empty */
  empty: string;
  /** 已选素材当前不可用（被停用或已删除）时的提示 */
  unavailable: string;
}

/**
 * 缩略图地址。
 *
 * 视频**没有封面时返回 null**（而不是回退到 .mp4 地址）：把视频地址塞进 `<img>` 只会得到
 * 一张破图。调用方在 null 时渲染带播放图标的占位块，比破图清楚得多。
 */
function previewUrl(
  asset: Pick<PickerAsset, 'url' | 'thumbnailUrl' | 'posterUrl' | 'type'>,
): string | null {
  if (asset.type === 'VIDEO') return asset.posterUrl ?? asset.thumbnailUrl ?? null;
  return asset.thumbnailUrl ?? asset.url;
}

/** 素材缩略图：没有可用静态图时渲染占位块（视频为播放图标） */
export function AssetThumb({
  asset,
  className,
  imgClassName,
}: {
  asset: Pick<PickerAsset, 'url' | 'thumbnailUrl' | 'posterUrl' | 'type' | 'name'>;
  className?: string;
  imgClassName?: string;
}) {
  const src = previewUrl(asset);
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 素材来自 OSS 动态域名，接入 next/image remotePatterns 后统一替换
      <img src={src} alt={asset.name} loading="lazy" className={imgClassName} />
    );
  }
  return (
    <span
      role="img"
      aria-label={asset.name}
      className={cn(
        'flex items-center justify-center bg-navy-900 text-ivory-50',
        className ?? 'h-full w-full',
      )}
    >
      <PlayIcon className="h-5 w-5" />
    </span>
  );
}

/**
 * Single-asset picker backed by the media library.
 *
 * Renders a hidden input carrying the selected asset id, so it can be dropped into any
 * `<form action={serverAction}>` without extra wiring. Uncontrolled by design (matching the
 * rest of the admin forms) except for the current selection and the open/closed state.
 * All copy is passed in by the caller so the same widget serves the product and category screens.
 */
export function AssetPicker({
  name,
  assets,
  initialId,
  labels,
}: {
  name: string;
  assets: PickerAsset[];
  initialId: string | null;
  labels: AssetPickerLabels;
}) {
  const [selectedId, setSelectedId] = useState(initialId ?? '');
  const [open, setOpen] = useState(false);
  const lastInitial = useRef(initialId ?? '');

  // Follow the server value when it changes (e.g. after the media tab saved), but never clobber
  // a selection the admin just made in this form.
  useEffect(() => {
    const next = initialId ?? '';
    if (lastInitial.current !== next) {
      lastInitial.current = next;
      setSelectedId(next);
    }
  }, [initialId]);

  const selected = assets.find((asset) => asset.id === selectedId) ?? null;
  // 已选素材可能不在候选列表里：它在绑定之后被停用了（媒体库只提供已启用素材），
  // 或者已从媒体库删除。此时必须仍然能「移除」——否则这个字段既清不掉、又会挡住整份保存。
  const missingSelection = Boolean(selectedId) && !selected;

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={selectedId} />

      <div className="flex flex-wrap items-center gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-navy-200 bg-navy-50">
          {selected ? (
            <AssetThumb asset={selected} imgClassName="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-muted">
              {labels.none}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="inline-flex h-9 items-center rounded-full border border-navy-300 px-4 text-sm font-medium text-navy-800 transition-colors hover:bg-navy-50"
          >
            {selected ? labels.change : labels.choose}
          </button>
          {selected || missingSelection ? (
            <button
              type="button"
              onClick={() => {
                setSelectedId('');
                setOpen(false);
              }}
              className="inline-flex h-9 items-center rounded-full px-3 text-sm text-navy-600 transition-colors hover:bg-navy-100"
            >
              {labels.remove}
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="rounded-xl border border-navy-200 bg-navy-50/60 p-3">
          {assets.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted">{labels.empty}</p>
          ) : (
            <ul className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-6">
              {assets.map((asset) => (
                <li key={asset.id}>
                  <button
                    type="button"
                    aria-pressed={asset.id === selectedId}
                    onClick={() => {
                      setSelectedId(asset.id);
                      setOpen(false);
                    }}
                    className={cn(
                      'block w-full overflow-hidden rounded-lg border bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500',
                      asset.id === selectedId
                        ? 'border-copper-500 ring-2 ring-copper-500/30'
                        : 'border-navy-200 hover:border-navy-300',
                    )}
                  >
                    <AssetThumb asset={asset} imgClassName="aspect-square w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {selected ? <p className="text-xs text-muted">{selected.name}</p> : null}
      {missingSelection ? (
        <p className="text-xs text-amber-700">{labels.unavailable}</p>
      ) : null}
    </div>
  );
}
