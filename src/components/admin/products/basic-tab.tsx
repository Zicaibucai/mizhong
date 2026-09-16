'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  deleteProductAction,
  duplicateProductAction,
  saveProductBasicAction,
  setProductPublishedAction,
} from '@/lib/admin/actions/products';
import { initialFormState } from '@/lib/admin/action-state';
import {
  Alert,
  Checkbox,
  Field,
  Select,
  SubmitButton,
  TextInput,
} from '@/components/admin/form';
import { DeleteForm } from '@/components/admin/delete-form';
import { useAdminT } from '@/components/admin/i18n-provider';
import { cn } from '@/lib/cn';
import { AssetPicker } from './asset-picker';
import { useDirtyForm } from './tabs';
import type { ProductEditorData } from './types';

/**
 * Submit button for the publish control.
 *
 * The target value travels in a hidden input rather than on the button itself: React's form-action
 * serialisation does not include the submitter button's name/value, so `<button name="target"
 * value="publish">` would arrive without `target` and every publish attempt failed validation.
 */
function StatusSubmit({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'primary' | 'secondary';
}) {
  const t = useAdminT();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'inline-flex h-10 items-center rounded-full px-5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        tone === 'primary'
          ? 'bg-copper-700 text-ivory-50 hover:bg-copper-800'
          : 'border border-navy-300 text-navy-800 hover:bg-navy-50',
      )}
    >
      {pending ? t.common.processing : children}
    </button>
  );
}

/** Basic information, publish control, duplicate / delete and the public-site preview link. */
export function BasicTab({ data }: { data: ProductEditorData }) {
  const t = useAdminT();
  const router = useRouter();
  const { product, categories, coverAssets, previewHref } = data;

  const [state, formAction] = useActionState(saveProductBasicAction, initialFormState);
  const dirty = useDirtyForm('basic', state);

  const [statusState, statusAction] = useActionState(setProductPublishedAction, initialFormState);
  const [duplicateState, duplicateAction] = useActionState(
    duplicateProductAction,
    initialFormState,
  );

  // Publishing changes the badge in the header and the public site — re-read the server data.
  useEffect(() => {
    if (statusState.status === 'success') router.refresh();
  }, [statusState, router]);

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-xl border border-navy-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-navy-900">{t.products.basicSection}</h2>

        <form action={formAction} onChange={dirty.markDirty} className="space-y-5">
          <input type="hidden" name="id" value={product.id} />

          {state.status === 'error' && state.message ? (
            <Alert kind="error">{state.message}</Alert>
          ) : null}
          {state.status === 'success' && state.message ? (
            <Alert kind="success">{state.message}</Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.products.slug} htmlFor="slug" hint={t.products.slugHint}>
              <TextInput id="slug" name="slug" defaultValue={product.slug} required />
            </Field>
            <Field label={t.products.sku} htmlFor="sku" hint={t.products.skuHint}>
              <TextInput id="sku" name="sku" defaultValue={product.sku} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.products.category} htmlFor="categoryId">
              <Select
                id="categoryId"
                name="categoryId"
                defaultValue={product.categoryId ?? ''}
                options={[
                  { value: '', label: t.products.noCategory },
                  ...categories.map((category) => ({
                    value: category.id,
                    label: category.name,
                  })),
                ]}
              />
            </Field>
            <Field
              label={t.products.sortOrder}
              htmlFor="sortOrder"
              hint={t.products.sortOrderHint}
            >
              <TextInput
                id="sortOrder"
                name="sortOrder"
                type="number"
                defaultValue={String(product.sortOrder)}
              />
            </Field>
          </div>

          <div>
            <Checkbox
              name="featured"
              id="featured"
              label={t.products.featured}
              defaultChecked={product.featured}
            />
            <p className="mt-1 text-xs text-muted">{t.products.featuredHint}</p>
          </div>

          <Field label={t.products.coverLabel} hint={t.products.coverHint}>
            <AssetPicker
              name="coverAssetId"
              assets={coverAssets}
              initialId={product.coverAssetId}
              labels={{
                choose: t.products.chooseCover,
                change: t.products.changeCover,
                remove: t.products.removeCover,
                none: t.productCategories.noCover,
                empty: t.products.noAssets,
              }}
            />
          </Field>

          <div className="flex justify-end">
            <SubmitButton pendingText={t.common.saving}>{t.products.saveDraft}</SubmitButton>
          </div>
        </form>
      </section>

      <section className="space-y-3 rounded-xl border border-navy-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-navy-900">{t.products.publishStatus}</h2>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs',
                product.published
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700',
              )}
            >
              {product.published ? t.products.statusPublished : t.products.statusDraft}
            </span>
            <form action={statusAction}>
              <input type="hidden" name="id" value={product.id} />
              <input
                type="hidden"
                name="target"
                value={product.published ? 'draft' : 'publish'}
              />
              <StatusSubmit tone={product.published ? 'secondary' : 'primary'}>
                {product.published ? t.products.unpublish : t.products.publish}
              </StatusSubmit>
            </form>
          </div>

          {statusState.status === 'error' && statusState.message ? (
            <Alert kind="error">{statusState.message}</Alert>
          ) : null}
          {statusState.status === 'success' && statusState.message ? (
            <Alert kind="success">{statusState.message}</Alert>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-navy-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={previewHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center rounded-full border border-navy-300 px-5 text-sm font-medium text-navy-800 transition-colors hover:bg-navy-50"
          >
            {t.products.preview} ↗
          </Link>

          <form action={duplicateAction}>
            <input type="hidden" name="id" value={product.id} />
            <SubmitButton variant="secondary" pendingText={t.common.processing}>
              {t.products.duplicate}
            </SubmitButton>
          </form>
        </div>

        {duplicateState.status === 'error' && duplicateState.message ? (
          <Alert kind="error">{duplicateState.message}</Alert>
        ) : null}
        {duplicateState.status === 'success' && duplicateState.message ? (
          <Alert kind="success">{duplicateState.message}</Alert>
        ) : null}

        <div className="border-t border-navy-100 pt-4">
          <DeleteForm
            action={deleteProductAction}
            id={product.id}
            label={t.products.delete}
            confirmText={t.products.deleteConfirm}
          />
        </div>
      </section>
    </div>
  );
}
