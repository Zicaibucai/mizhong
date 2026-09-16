'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { initialFormState, type FormState } from '@/lib/admin/action-state';
import {
  addProductMediaAction,
  moveProductMediaAction,
  removeProductMediaAction,
  reorderProductMediaAction,
  setProductAssetRoleAction,
} from '@/lib/admin/actions/products';
import { Alert, SubmitButton } from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';
import { PlayIcon } from '@/components/ui/icons';
import { AssetThumb, type PickerAsset } from './asset-picker';

/** One row of `ProductMedia`, flattened for the client. */
export interface GalleryItemData {
  id: string;
  /** 素材主键：用于「设为封面 / 设为悬停视频」 */
  assetId: string;
  role: 'GALLERY' | 'VIDEO';
  type: 'IMAGE' | 'VIDEO';
  url: string;
  thumbnailUrl: string | null;
  posterUrl: string | null;
  name: string;
}

/** 缩略图地址：视频没有封面时返回 null，由调用方渲染占位块而不是破图 */
function thumbSrc(
  item: Pick<GalleryItemData, 'type' | 'url' | 'thumbnailUrl' | 'posterUrl'>,
): string | null {
  if (item.type === 'VIDEO') return item.posterUrl ?? item.thumbnailUrl ?? null;
  return item.thumbnailUrl ?? item.url;
}

/** 图库缩略图：没有静态图时用深色块 + 播放图标占位 */
function GalleryThumb({
  item,
  className,
  imgClassName,
}: {
  item: Pick<GalleryItemData, 'type' | 'url' | 'thumbnailUrl' | 'posterUrl' | 'name'>;
  className?: string;
  imgClassName?: string;
}) {
  const src = thumbSrc(item);
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 素材来自 OSS 动态域名，接入 next/image remotePatterns 后统一替换
      <img src={src} alt={item.name} loading="lazy" className={imgClassName} />
    );
  }
  return (
    <span
      role="img"
      aria-label={item.name}
      className={cn('flex items-center justify-center bg-navy-900 text-ivory-50', className)}
    >
      <PlayIcon className="h-5 w-5" />
    </span>
  );
}

/**
 * Multi-select media-library picker + "add to gallery" form.
 *
 * Images are added with role GALLERY and videos with role VIDEO (decided server-side), so the
 * picker itself only has to collect asset ids.
 */
export function AddMediaForm({ productId, assets }: { productId: string; assets: PickerAsset[] }) {
  const t = useAdminT();
  const router = useRouter();
  const [state, formAction] = useActionState(addProductMediaAction, initialFormState);
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.status !== 'success') return;
    setSelected([]);
    setOpen(false);
    router.refresh();
  }, [state, router]);

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />
      {selected.map((id) => (
        <input key={id} type="hidden" name="assetIds" value={id} />
      ))}

      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}
      {state.status === 'success' && state.message ? (
        <Alert kind="success">{state.message}</Alert>
      ) : null}

      {assets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-navy-200 bg-white px-5 py-6 text-sm text-muted">
          {t.products.noAssets}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="inline-flex h-9 items-center rounded-full border border-navy-300 px-4 text-sm font-medium text-navy-800 transition-colors hover:bg-navy-50"
          >
            {t.products.addMedia}
          </button>
          {selected.length > 0 ? (
            <SubmitButton pendingText={t.common.processing}>{t.products.addSelected}</SubmitButton>
          ) : null}
        </div>
      )}

      {open && assets.length > 0 ? (
        <div className="rounded-xl border border-navy-200 bg-navy-50/60 p-3">
          <ul className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-6">
            {assets.map((asset) => {
              const isSelected = selected.includes(asset.id);
              return (
                <li key={asset.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggle(asset.id)}
                    title={asset.name}
                    className={cn(
                      'relative block w-full overflow-hidden rounded-lg border bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500',
                      isSelected
                        ? 'border-copper-500 ring-2 ring-copper-500/30'
                        : 'border-navy-200 hover:border-navy-300',
                    )}
                  >
                    <AssetThumb asset={asset} imgClassName="aspect-square w-full object-cover" />
                    {asset.type === 'VIDEO' ? (
                      <span className="absolute bottom-1 left-1 rounded bg-navy-900/80 px-1.5 py-0.5 text-[10px] text-ivory-50">
                        {t.products.asVideo}
                      </span>
                    ) : null}
                    {isSelected ? (
                      <span
                        aria-hidden
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-copper-600 text-xs text-ivory-50"
                      >
                        ✓
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </form>
  );
}

/**
 * Gallery list with working ordering: "Move up"/"Move down" persist `sortOrder` through the
 * server action, and HTML5 drag-and-drop reorders as a progressive enhancement (also persisted).
 * Both paths update the list optimistically, then refresh from the server.
 *
 * Each row can also be promoted to the product cover or the hover video without leaving the page,
 * and links to the media library entry in a new tab — that is where a file is replaced and where a
 * video actually plays. Opening it in a new tab keeps this editor's unsaved state intact.
 */
export function GalleryEditor({
  productId,
  items,
  coverAssetId,
  hoverVideoAssetId,
}: {
  productId: string;
  items: GalleryItemData[];
  /** 当前封面 / 悬停视频的素材 id，用于在列表上标出「已用于…」 */
  coverAssetId: string | null;
  hoverVideoAssetId: string | null;
}) {
  const t = useAdminT();
  const router = useRouter();
  const [order, setOrder] = useState(items);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const signature = items.map((item) => item.id).join(',');

  useEffect(() => {
    setOrder((current) => (current.map((item) => item.id).join(',') === signature ? current : items));
  }, [items, signature]);

  const run = (optimistic: GalleryItemData[], task: () => Promise<FormState>) => {
    setError(null);
    setNotice(null);
    setOrder(optimistic);
    startTransition(async () => {
      const result = await task();
      if (result.status === 'error') {
        setError(result.message ?? null);
        setOrder(items);
        return;
      }
      if (result.message) setNotice(result.message);
      router.refresh();
    });
  };

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    next.splice(index, 1);
    next.splice(target, 0, order[index]);
    run(next, () =>
      moveProductMediaAction(productId, order[index].id, delta === -1 ? 'up' : 'down'),
    );
  };

  const drop = (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      return;
    }
    const next = [...order];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    setDragIndex(null);
    run(next, () => reorderProductMediaAction(productId, next.map((item) => item.id)));
  };

  const remove = (id: string) => {
    setConfirmingId(null);
    run(
      order.filter((item) => item.id !== id),
      () => removeProductMediaAction(productId, id),
    );
  };

  const assignRole = (item: GalleryItemData, role: 'cover' | 'hover') => {
    run(order, () => setProductAssetRoleAction({ productId, assetId: item.assetId, role }));
  };

  if (order.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-navy-200 bg-white px-5 py-6 text-sm text-muted">
        {t.products.noMedia}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <Alert kind="error">{error}</Alert> : null}
      {notice && !error ? <Alert kind="success">{notice}</Alert> : null}

      <ul className="space-y-2">
        {order.map((item, index) => {
          const isCover = Boolean(coverAssetId) && item.assetId === coverAssetId;
          const isHover = Boolean(hoverVideoAssetId) && item.assetId === hoverVideoAssetId;

          return (
            <li
              key={item.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                drop(index);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-xl border border-navy-200 bg-white p-3',
                dragIndex === index ? 'opacity-60' : null,
              )}
            >
              <span aria-hidden className="cursor-grab select-none text-navy-300">
                ⠿
              </span>

              {/* 视频缩略图点开就是真实播放器（素材详情页），图片同理可以进去替换文件 */}
              <a
                href={`/admin/media/${item.assetId}`}
                target="_blank"
                rel="noreferrer"
                aria-label={item.type === 'VIDEO' ? t.products.videoPreview : t.products.openAsset}
                className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-navy-200 bg-navy-50 transition-colors hover:border-copper-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
              >
                <GalleryThumb
                  item={item}
                  className="h-full w-full"
                  imgClassName="h-full w-full object-cover"
                />
                {item.type === 'VIDEO' ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-navy-950/35">
                    <PlayIcon className="h-4 w-4 text-ivory-50" />
                  </span>
                ) : null}
              </a>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-navy-900">{item.name || item.url}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      'inline-block rounded-full px-2 py-0.5 text-xs',
                      item.role === 'VIDEO'
                        ? 'bg-navy-100 text-navy-700'
                        : 'bg-copper-100 text-copper-700',
                    )}
                  >
                    {item.role === 'VIDEO' ? t.products.asVideo : t.products.asGallery}
                  </span>
                  {isCover ? (
                    <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                      {t.products.currentCover}
                    </span>
                  ) : null}
                  {isHover ? (
                    <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                      {t.products.currentHoverVideo}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {item.type === 'IMAGE' && !isCover ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => assignRole(item, 'cover')}
                    className="rounded-full border border-navy-200 px-3 py-1.5 text-xs text-navy-700 transition-colors hover:bg-navy-50 disabled:opacity-40"
                  >
                    {t.products.setAsCover}
                  </button>
                ) : null}

                {item.type === 'VIDEO' && !isHover ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => assignRole(item, 'hover')}
                    className="rounded-full border border-navy-200 px-3 py-1.5 text-xs text-navy-700 transition-colors hover:bg-navy-50 disabled:opacity-40"
                  >
                    {t.products.setAsHoverVideo}
                  </button>
                ) : null}

                <a
                  href={`/admin/media/${item.assetId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-navy-200 px-3 py-1.5 text-xs text-navy-700 transition-colors hover:bg-navy-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
                >
                  {t.products.openAsset}
                </a>

                <button
                  type="button"
                  disabled={pending || index === 0}
                  onClick={() => move(index, -1)}
                  className="rounded-full border border-navy-200 px-3 py-1.5 text-xs text-navy-700 transition-colors hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t.products.moveUp}
                </button>
                <button
                  type="button"
                  disabled={pending || index === order.length - 1}
                  onClick={() => move(index, 1)}
                  className="rounded-full border border-navy-200 px-3 py-1.5 text-xs text-navy-700 transition-colors hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t.products.moveDown}
                </button>

                {confirmingId === item.id ? (
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => remove(item.id)}
                      className="rounded-full border border-red-200 px-3 py-1.5 text-xs text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
                    >
                      {t.common.confirmDelete}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className="rounded-full px-2 py-1.5 text-xs text-navy-600 hover:bg-navy-100"
                    >
                      {t.common.cancel}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(item.id)}
                    className="rounded-full px-3 py-1.5 text-xs text-navy-600 transition-colors hover:bg-navy-100"
                  >
                    {t.products.removeFromGallery}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {pending ? <p className="text-xs text-muted">{t.common.processing}</p> : null}
    </div>
  );
}
