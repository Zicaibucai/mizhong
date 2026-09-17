'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { saveProductMediaSettingsAction } from '@/lib/admin/actions/products';
import { initialFormState } from '@/lib/admin/action-state';
import { Alert, SubmitButton } from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';
import { AssetPicker } from './asset-picker';
import { AddMediaForm, GalleryEditor } from './gallery-editor';
import { ProductMediaUploader } from './product-uploader';
import { useAutoSaveForm } from './tabs';
import type { ProductEditorData } from './types';

/**
 * 图片与视频。
 *
 * 四个分区，各自职责单一且**都在同一个商品编辑器内**，不需要先离开商品去媒体库：
 *   1. 产品封面 / 悬停视频 —— 从媒体库指定，明确区分两个角色；
 *   2. 直接上传 —— 拖放或选择文件，上传完成后立即绑定到本商品；
 *   3. 从媒体库添加 —— 已有素材直接加入图库；
 *   4. 详情图库 —— 排序、设为封面 / 悬停视频、移除（只解除关联，不删除媒体库文件）。
 *
 * 表单 id 固定为 `product-form-media`，顶部操作栏的「保存草稿」按这个 id 提交。
 */
export function MediaTab({ data }: { data: ProductEditorData }) {
  const t = useAdminT();
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(saveProductMediaSettingsAction, initialFormState);
  useAutoSaveForm('media', 'product-form-media', state, isPending);
  

  // 保存封面 / 悬停视频后重新读取，让图库上的「当前封面 / 悬停视频」标记同步
  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);

  return (
    <div className="space-y-5">
      <form
        id="product-form-media"
        action={formAction}
        
        className="space-y-5"
      >
        <input type="hidden" name="id" value={data.product.id} />

        <section className="space-y-4 rounded-xl border border-navy-200 bg-white p-5">
          <div>
            <h2 className="text-sm font-semibold text-navy-900">{t.products.mediaSection}</h2>
          </div>

          {state.status === 'error' && state.message ? (
            <Alert kind="error">{state.message}</Alert>
          ) : null}
          {state.status === 'success' && state.message ? (
            <Alert kind="success">{state.message}</Alert>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-navy-800">{t.products.coverLabel}</p>
              <div className="mt-2">
                <AssetPicker
                  name="coverAssetId"
                  assets={data.coverAssets}
                  initialId={data.product.coverAssetId}
                  labels={{
                    choose: t.products.chooseCover,
                    change: t.products.changeCover,
                    remove: t.products.removeCover,
                    none: t.productCategories.noCover,
                    empty: t.products.noAssets,
                    unavailable: t.products.assetUnavailable,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">{t.products.coverHint}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-navy-800">{t.products.hoverVideoLabel}</p>
              <div className="mt-2">
                <AssetPicker
                  name="hoverVideoAssetId"
                  assets={data.videoAssets}
                  initialId={data.product.hoverVideoAssetId}
                  labels={{
                    choose: t.products.chooseHoverVideo,
                    change: t.products.changeHoverVideo,
                    remove: t.products.removeHoverVideo,
                    none: t.products.noVideos,
                    empty: t.products.noVideos,
                    unavailable: t.products.assetUnavailable,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">{t.products.hoverVideoHint}</p>
            </div>
          </div>

          <div className="flex justify-end">
            <SubmitButton pendingText={t.common.saving}>{t.products.saveDraft}</SubmitButton>
          </div>
        </section>
      </form>

      <section className="space-y-4 rounded-xl border border-navy-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-semibold text-navy-900">{t.products.uploadSection}</h2>
          <p className="mt-1 text-xs text-muted">{t.products.uploadHint}</p>
        </div>
        <ProductMediaUploader productId={data.product.id} />
      </section>

      <section className="space-y-4 rounded-xl border border-navy-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-semibold text-navy-900">{t.products.librarySection}</h2>
        </div>
        <AddMediaForm productId={data.product.id} assets={data.galleryAssets} />
      </section>

      <section className="space-y-4 rounded-xl border border-navy-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-semibold text-navy-900">{t.products.galleryLabel}</h2>
          <p className="mt-1 text-xs text-muted">{t.products.galleryHint}</p>
        </div>

        <GalleryEditor
          productId={data.product.id}
          items={data.media}
          coverAssetId={data.product.coverAssetId}
          hoverVideoAssetId={data.product.hoverVideoAssetId}
        />
      </section>
    </div>
  );
}
