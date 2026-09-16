'use client';

import { useActionState } from 'react';
import { saveProductCoverAction } from '@/lib/admin/actions/products';
import { initialFormState } from '@/lib/admin/action-state';
import { Alert, SubmitButton } from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';
import { AssetPicker } from './asset-picker';
import { AddMediaForm, GalleryEditor } from './gallery-editor';
import { useDirtyForm } from './tabs';
import type { ProductEditorData } from './types';

/** Cover image plus the ordered gallery (images → GALLERY, videos → VIDEO). */
export function MediaTab({ data }: { data: ProductEditorData }) {
  const t = useAdminT();
  const [state, formAction] = useActionState(saveProductCoverAction, initialFormState);
  const dirty = useDirtyForm('media', state);

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-xl border border-navy-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-navy-900">{t.products.coverLabel}</h2>

        <form action={formAction} onChange={dirty.markDirty} className="space-y-5">
          <input type="hidden" name="id" value={data.product.id} />

          {state.status === 'error' && state.message ? (
            <Alert kind="error">{state.message}</Alert>
          ) : null}
          {state.status === 'success' && state.message ? (
            <Alert kind="success">{state.message}</Alert>
          ) : null}

          <div>
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
              }}
            />
            <p className="mt-2 text-xs text-muted">{t.products.coverHint}</p>
          </div>

          <div className="flex justify-end">
            <SubmitButton pendingText={t.common.saving}>{t.products.saveDraft}</SubmitButton>
          </div>
        </form>
      </section>

      <section className="space-y-4 rounded-xl border border-navy-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-semibold text-navy-900">{t.products.galleryLabel}</h2>
          <p className="mt-1 text-xs text-muted">{t.products.galleryHint}</p>
        </div>

        <AddMediaForm productId={data.product.id} assets={data.galleryAssets} />

        <GalleryEditor productId={data.product.id} items={data.media} />
      </section>
    </div>
  );
}
