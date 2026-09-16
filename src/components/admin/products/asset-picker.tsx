'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

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
}

function previewUrl(asset: Pick<PickerAsset, 'url' | 'thumbnailUrl' | 'posterUrl' | 'type'>): string {
  if (asset.type === 'VIDEO') return asset.posterUrl ?? asset.thumbnailUrl ?? asset.url;
  return asset.thumbnailUrl ?? asset.url;
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

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={selectedId} />

      <div className="flex flex-wrap items-center gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-navy-200 bg-navy-50">
          {selected ? (
            // eslint-disable-next-line @next/next/no-img-element -- 素材来自 OSS 动态域名，接入 next/image remotePatterns 后统一替换
            <img
              src={previewUrl(selected)}
              alt={selected.name}
              className="h-full w-full object-cover"
            />
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
          {selected ? (
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
                    {/* eslint-disable-next-line @next/next/no-img-element -- 素材来自 OSS 动态域名，接入 next/image remotePatterns 后统一替换 */}
                    <img
                      src={previewUrl(asset)}
                      alt={asset.name}
                      loading="lazy"
                      className="aspect-square w-full object-cover"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {selected ? <p className="text-xs text-muted">{selected.name}</p> : null}
    </div>
  );
}
