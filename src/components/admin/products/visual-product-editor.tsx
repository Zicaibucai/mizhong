'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  addProductMediaAction,
  moveProductMediaAction,
  removeProductMediaAction,
  saveProductVisualAction,
  setProductAssetRoleAction,
} from '@/lib/admin/actions/products';
import { initialFormState } from '@/lib/admin/action-state';
import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';
import { defaultLocale } from '@/lib/i18n/config';
import { CURRENCY_CODES, TRADE_UNITS, type PriceMode } from '@/lib/pricing';
import { cn } from '@/lib/cn';
import { getContentLocaleLabel } from '@/lib/admin/labels';
import { Alert, Checkbox, Field, Select, SubmitButton, TextArea, TextInput } from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';
import { PlayIcon } from '@/components/ui/icons';
import { AssetThumb, type PickerAsset } from './asset-picker';
import { ProductMediaUploader } from './product-uploader';
import { SeoTab } from './seo-tab';
import { SpecsTab } from './specs-tab';
import { useAutoSaveForm } from './tabs';
import type { GalleryItemData } from './gallery-editor';
import type { ProductEditorData } from './types';

/** The shared input styling used by the two compact controls below. */
const compactControl =
  'block w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-navy-300 focus:border-copper-500 focus:outline-none focus:ring-2 focus:ring-copper-500/30';

function mediaThumbSrc(item: Pick<GalleryItemData, 'type' | 'url' | 'thumbnailUrl' | 'posterUrl'>) {
  if (item.type === 'VIDEO') return item.posterUrl ?? item.thumbnailUrl;
  return item.thumbnailUrl ?? item.url;
}

/**
 * A customer-facing media canvas for the admin editor.
 *
 * The existing media tab remains available for detailed ordering and library maintenance.
 * This smaller canvas handles the common flow: preview the current media, add another item
 * with the plus tile, and assign the cover/hover role without leaving the product page.
 */
function VisualMediaGallery({
  productId,
  items,
  assets,
  coverAssetId,
  hoverVideoAssetId,
  className,
}: {
  productId: string;
  items: GalleryItemData[];
  assets: PickerAsset[];
  coverAssetId: string | null;
  hoverVideoAssetId: string | null;
  className?: string;
}) {
  const t = useAdminT();
  const router = useRouter();
  const [order, setOrder] = useState(items);
  const [activeId, setActiveId] = useState<string | null>(items[0]?.assetId ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [addState, addAction] = useActionState(addProductMediaAction, initialFormState);

  const signature = items.map((item) => item.assetId).join(',');

  useEffect(() => {
    setOrder((current) => (current.map((item) => item.assetId).join(',') === signature ? current : items));
  }, [items, signature]);

  useEffect(() => {
    if (activeId && order.some((item) => item.assetId === activeId)) return;
    setActiveId(order[0]?.assetId ?? null);
  }, [activeId, order]);

  useEffect(() => {
    if (addState.status !== 'success') return;
    setSelected([]);
    setPickerOpen(false);
    router.refresh();
  }, [addState, router]);

  const current = order.find((item) => item.assetId === activeId) ?? order[0] ?? null;
  const availableAssets = assets.filter((asset) => !order.some((item) => item.assetId === asset.id));

  const run = (optimistic: GalleryItemData[], task: () => Promise<{ status: string; message?: string }>) => {
    setError(null);
    setOrder(optimistic);
    startTransition(async () => {
      const result = await task();
      if (result.status === 'error') {
        setError(result.message ?? t.actions.saveFailed);
        setOrder(items);
        return;
      }
      router.refresh();
    });
  };

  const removeCurrent = () => {
    if (!current) return;
    setConfirmingId(null);
    const next = order.filter((item) => item.assetId !== current.assetId);
    setActiveId(next[0]?.assetId ?? null);
    run(next, () => removeProductMediaAction(productId, current.assetId));
  };

  const moveCurrent = (direction: 'up' | 'down') => {
    if (!current) return;
    const index = order.findIndex((item) => item.assetId === current.assetId);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= order.length) return;
    const next = [...order];
    next.splice(index, 1);
    next.splice(target, 0, current);
    run(next, () => moveProductMediaAction(productId, current.assetId, direction));
  };

  const setRole = (role: 'cover' | 'hover') => {
    if (!current) return;
    setError(null);
    startTransition(async () => {
      const result = await setProductAssetRoleAction({ productId, assetId: current.assetId, role });
      if (result.status === 'error') setError(result.message ?? t.actions.saveFailed);
      else router.refresh();
    });
  };

  const toggleAsset = (id: string) => {
    setSelected((currentSelection) =>
      currentSelection.includes(id)
        ? currentSelection.filter((item) => item !== id)
        : [...currentSelection, id],
    );
  };

  return (
    <section className={cn('min-w-0 space-y-4 rounded-2xl border border-navy-200 bg-white p-4 sm:p-5', className)}>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-navy-900">{t.products.mediaSection}</h2>
          <span className="text-xs text-muted">{order.length} / {t.products.galleryLabel}</span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted">{t.products.visualMediaHint}</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-navy-200 bg-navy-950">
        {current ? (
          <div className="relative aspect-square w-full">
            {current.type === 'VIDEO' ? (
              <video
                className="absolute inset-0 h-full w-full object-contain"
                controls
                preload="metadata"
                poster={current.posterUrl ?? current.thumbnailUrl ?? undefined}
                aria-label={current.name}
              >
                <source src={current.url} />
              </video>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- media URLs come from the configured storage provider
              <img src={current.url} alt={current.name} className="absolute inset-0 h-full w-full object-contain" />
            )}
            <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
              {current.assetId === coverAssetId ? (
                <span className="rounded-full bg-emerald-600/90 px-2.5 py-1 text-[11px] font-medium text-white">
                  {t.products.currentCover}
                </span>
              ) : null}
              {current.assetId === hoverVideoAssetId ? (
                <span className="rounded-full bg-navy-950/80 px-2.5 py-1 text-[11px] font-medium text-white">
                  {t.products.currentHoverVideo}
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex aspect-square w-full flex-col items-center justify-center gap-3 text-center text-ivory-50 transition-colors hover:bg-navy-900 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-copper-500"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-ivory-50/70 text-3xl font-light">
              +
            </span>
            <span className="text-sm">{t.products.addMediaTile}</span>
          </button>
        )}
      </div>

      {current ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending || current.type !== 'IMAGE' || current.assetId === coverAssetId}
            onClick={() => setRole('cover')}
            className="rounded-full border border-navy-200 px-3 py-1.5 text-xs text-navy-700 transition-colors hover:border-copper-500 hover:bg-copper-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t.products.setAsCover}
          </button>
          <button
            type="button"
            disabled={pending || current.type !== 'VIDEO' || current.assetId === hoverVideoAssetId}
            onClick={() => setRole('hover')}
            className="rounded-full border border-navy-200 px-3 py-1.5 text-xs text-navy-700 transition-colors hover:border-copper-500 hover:bg-copper-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t.products.setAsHoverVideo}
          </button>
          <button
            type="button"
            disabled={pending || order.indexOf(current) === 0}
            onClick={() => moveCurrent('up')}
            className="rounded-full border border-navy-200 px-3 py-1.5 text-xs text-navy-700 transition-colors hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t.products.moveUp}
          </button>
          <button
            type="button"
            disabled={pending || order.indexOf(current) === order.length - 1}
            onClick={() => moveCurrent('down')}
            className="rounded-full border border-navy-200 px-3 py-1.5 text-xs text-navy-700 transition-colors hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t.products.moveDown}
          </button>
          {confirmingId === current.assetId ? (
            <span className="flex items-center gap-1">
              <button
                type="button"
                disabled={pending}
                onClick={removeCurrent}
                className="rounded-full border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-40"
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
              disabled={pending}
              onClick={() => setConfirmingId(current.assetId)}
              className="rounded-full px-3 py-1.5 text-xs text-navy-600 transition-colors hover:bg-navy-100 disabled:opacity-40"
            >
              {t.products.removeFromGallery}
            </button>
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {order.map((item) => {
          const src = mediaThumbSrc(item);
          const isCurrent = item.assetId === current?.assetId;
          return (
            <button
              key={item.assetId}
              type="button"
              onClick={() => setActiveId(item.assetId)}
              aria-label={item.name}
              aria-pressed={isCurrent}
              className={cn(
                'relative aspect-square overflow-hidden rounded-lg border bg-navy-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500',
                isCurrent ? 'border-copper-500 ring-2 ring-copper-500/30' : 'border-navy-200 hover:border-copper-500',
              )}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element -- media URLs come from the configured storage provider
                <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-navy-900 text-ivory-50">
                  <PlayIcon className="h-5 w-5" />
                </span>
              )}
              {item.type === 'VIDEO' ? (
                <span className="absolute inset-0 flex items-center justify-center bg-navy-950/30">
                  <PlayIcon className="h-5 w-5 text-ivory-50" />
                </span>
              ) : null}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          aria-expanded={pickerOpen}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-navy-300 bg-navy-50 text-navy-600 transition-colors hover:border-copper-500 hover:bg-copper-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
        >
          <span className="text-2xl font-light leading-none">+</span>
          <span className="text-[10px] leading-tight">{t.products.addMediaTile}</span>
        </button>
      </div>

      {error ? <Alert kind="error">{error}</Alert> : null}

      {pickerOpen ? (
        <div className="space-y-3 rounded-xl border border-navy-200 bg-navy-50/70 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-navy-900">{t.products.librarySection}</p>
            <button
              type="button"
              onClick={() => setUploadOpen((open) => !open)}
              className="rounded-full border border-navy-300 px-3 py-1.5 text-xs text-navy-800 hover:bg-white"
            >
              {t.products.uploadSection}
            </button>
          </div>

          <form action={addAction} className="space-y-3">
            <input type="hidden" name="productId" value={productId} />
            {selected.map((id) => <input key={id} type="hidden" name="assetIds" value={id} />)}
            {addState.status === 'error' && addState.message ? <Alert kind="error">{addState.message}</Alert> : null}
            {availableAssets.length === 0 ? (
              <p className="rounded-lg border border-dashed border-navy-200 bg-white px-3 py-4 text-xs text-muted">
                {t.products.noAssets}
              </p>
            ) : (
              <ul className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
                {availableAssets.map((asset) => {
                  const isSelected = selected.includes(asset.id);
                  return (
                    <li key={asset.id}>
                      <button
                        type="button"
                        onClick={() => toggleAsset(asset.id)}
                        aria-pressed={isSelected}
                        title={asset.name}
                        className={cn(
                          'relative block w-full overflow-hidden rounded-lg border bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500',
                          isSelected ? 'border-copper-500 ring-2 ring-copper-500/30' : 'border-navy-200 hover:border-navy-300',
                        )}
                      >
                        <AssetThumb asset={asset} imgClassName="aspect-square w-full object-cover" />
                        {asset.type === 'VIDEO' ? (
                          <span className="absolute bottom-1 left-1 rounded bg-navy-950/80 px-1 py-0.5 text-[9px] text-white">
                            {t.products.asVideo}
                          </span>
                        ) : null}
                        {isSelected ? <span className="absolute right-1 top-1 text-sm text-copper-700">✓</span> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {selected.length > 0 ? (
              <SubmitButton pendingText={t.common.processing}>{t.products.addSelected}</SubmitButton>
            ) : null}
          </form>

          {uploadOpen ? (
            <div className="border-t border-navy-200 pt-3">
              <ProductMediaUploader productId={productId} />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function VisualLocaleFields({
  locale,
  data,
  t,
}: {
  locale: AdminLocale;
  data: ProductEditorData;
  t: ReturnType<typeof useAdminT>;
}) {
  const values = data.translations[locale];
  return (
    <>
      <section className="space-y-4 rounded-2xl border border-navy-200 bg-white p-4 sm:p-5 lg:self-start">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-copper-700">
            {getContentLocaleLabel(t, locale)}
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-navy-950">{t.products.nameLabel}</h2>
        </div>
        <Field label={t.products.nameLabel} htmlFor={`visual-${locale}-name`}>
          <TextInput
            id={`visual-${locale}-name`}
            name={`${locale}_name`}
            defaultValue={values.name}
            placeholder={t.products.nameLabel}
          />
        </Field>
        <Field label={t.products.shortDescriptionLabel} htmlFor={`visual-${locale}-shortDescription`}>
          <TextArea
            id={`visual-${locale}-shortDescription`}
            name={`${locale}_shortDescription`}
            defaultValue={values.shortDescription}
            rows={3}
            placeholder={t.products.shortDescriptionLabel}
          />
        </Field>
      </section>
    </>
  );
}

function VisualPricingFields({
  data,
  t,
}: {
  data: ProductEditorData;
  t: ReturnType<typeof useAdminT>;
}) {
  const [mode, setMode] = useState<PriceMode>(data.product.priceMode);

  return (
    <section className="space-y-4 rounded-2xl border border-navy-200 bg-white p-4 sm:p-5 lg:self-start">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-copper-700">{t.products.pricingSection}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">{t.products.pricingHint}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.products.priceMode} htmlFor="visual-priceMode">
          <select
            id="visual-priceMode"
            name="priceMode"
            value={mode}
            onChange={(event) => setMode(event.target.value as PriceMode)}
            className={compactControl}
          >
            <option value="NEGOTIABLE">{t.products.priceModeNegotiable}</option>
            <option value="FIXED">{t.products.priceModeFixed}</option>
            <option value="RANGE">{t.products.priceModeRange}</option>
          </select>
        </Field>
        <Field label={t.products.currency} htmlFor="visual-currency">
          <Select id="visual-currency" name="currency" defaultValue={data.product.currency} options={CURRENCY_CODES.map((code) => ({ value: code, label: code }))} />
        </Field>
      </div>
      {mode === 'NEGOTIABLE' ? (
        <p className="rounded-xl border border-navy-100 bg-navy-50/60 px-4 py-3 text-xs leading-relaxed text-navy-700">
          {t.products.priceNegotiableNote}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.products.priceMin} htmlFor="visual-priceMin">
            <TextInput id="visual-priceMin" name="priceMin" defaultValue={data.product.priceMin} placeholder="0.00" />
          </Field>
          {mode === 'RANGE' ? (
            <Field label={t.products.priceMax} htmlFor="visual-priceMax">
              <TextInput id="visual-priceMax" name="priceMax" defaultValue={data.product.priceMax} placeholder="0.00" />
            </Field>
          ) : null}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.products.priceUnit} htmlFor="visual-priceUnit">
          <input id="visual-priceUnit" name="priceUnit" defaultValue={data.product.priceUnit} list="visual-price-units" className={compactControl} />
          <datalist id="visual-price-units">{TRADE_UNITS.map((unit) => <option key={unit} value={unit} />)}</datalist>
        </Field>
        <Field label={t.products.moq} htmlFor="visual-moq">
          <TextInput id="visual-moq" name="moq" type="number" defaultValue={data.product.moq} placeholder="1000" />
        </Field>
      </div>
      <Field label={t.products.moqUnit} htmlFor="visual-moqUnit">
        <input id="visual-moqUnit" name="moqUnit" defaultValue={data.product.moqUnit} list="visual-moq-units" className={compactControl} />
        <datalist id="visual-moq-units">{TRADE_UNITS.map((unit) => <option key={unit} value={unit} />)}</datalist>
      </Field>
    </section>
  );
}

function VisualDetailsFields({
  locale,
  data,
  t,
}: {
  locale: AdminLocale;
  data: ProductEditorData;
  t: ReturnType<typeof useAdminT>;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-navy-200 bg-white p-4 sm:p-5 lg:col-span-2">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-copper-700">{t.products.detailsSection}</p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-navy-950">{t.products.detailsSection}</h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.8fr)]">
        <Field label={t.products.sizeSummaryLabel} htmlFor={`visual-${locale}-sizeSummary`} hint={t.products.sizeSummaryHint}>
          <TextInput id={`visual-${locale}-sizeSummary`} name={`${locale}_sizeSummary`} defaultValue={data.translations[locale].sizeSummary} placeholder="25 mm × 2 mm" />
        </Field>
        <Field label={t.products.descriptionLabel} htmlFor={`visual-${locale}-description`}>
          <TextArea id={`visual-${locale}-description`} name={`${locale}_description`} defaultValue={data.translations[locale].description} rows={5} placeholder={t.products.descriptionLabel} />
        </Field>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label={t.products.specLabel} htmlFor={`visual-${locale}-spec`}>
          <TextArea id={`visual-${locale}-spec`} name={`${locale}_spec`} defaultValue={data.translations[locale].spec} rows={3} />
        </Field>
        <Field label={t.products.applicationLabel} htmlFor={`visual-${locale}-application`}>
          <TextArea id={`visual-${locale}-application`} name={`${locale}_application`} defaultValue={data.translations[locale].application} rows={3} />
        </Field>
      </div>
    </section>
  );
}

function VisualBasicFields({ data, t, state }: { data: ProductEditorData; t: ReturnType<typeof useAdminT>; state: { status: string; message?: string } }) {
  return (
    <section className="space-y-4 rounded-2xl border border-navy-200 bg-white p-4 sm:p-5 lg:col-span-2">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-copper-700">{t.products.requiredFields}</p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-navy-950">{t.products.basicSection}</h2>
      </div>
      {state.status === 'error' && state.message ? <Alert kind="error">{state.message}</Alert> : null}
      {state.status === 'success' && state.message ? <Alert kind="success">{state.message}</Alert> : null}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <p className="text-sm font-medium text-navy-800">{t.products.requiredFields}</p>
          <Field label={`${t.products.slug} *`} htmlFor="visual-slug" hint={t.products.slugHint}>
            <TextInput id="visual-slug" name="slug" defaultValue={data.product.slug} required />
          </Field>
          <div className="rounded-xl border border-navy-100 bg-navy-50/60 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-navy-800">{t.products.coverLabel}</span>
              <span className={cn('rounded-full px-2.5 py-1 text-xs', data.product.coverAssetId ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                {data.product.coverAssetId ? t.products.coverReady : t.products.coverMissing}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">{t.products.coverHint}</p>
          </div>
        </div>
        <div className="space-y-4">
          <p className="text-sm font-medium text-navy-800">{t.products.optionalFields}</p>
          <Field label={t.products.sku} htmlFor="visual-sku" hint={t.products.skuHint}>
            <TextInput id="visual-sku" name="sku" defaultValue={data.product.sku} />
          </Field>
          <Field label={t.products.category} htmlFor="visual-categoryId">
            <Select id="visual-categoryId" name="categoryId" defaultValue={data.product.categoryId ?? ''} options={[{ value: '', label: t.products.noCategory }, ...data.categories.map((category) => ({ value: category.id, label: category.name }))]} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.products.sortOrder} htmlFor="visual-sortOrder" hint={t.products.sortOrderHint}>
              <TextInput id="visual-sortOrder" name="sortOrder" type="number" defaultValue={String(data.product.sortOrder)} />
            </Field>
            <div className="pt-7">
              <Checkbox id="visual-featured" name="featured" label={t.products.featured} defaultChecked={data.product.featured} />
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingText={t.common.saving}>{t.products.saveDraft}</SubmitButton>
      </div>
    </section>
  );
}

function VisualProductForm({
  data,
  activeLocale,
  t,
}: {
  data: ProductEditorData;
  activeLocale: AdminLocale;
  t: ReturnType<typeof useAdminT>;
}) {
  const [state, formAction, isPending] = useActionState(saveProductVisualAction, initialFormState);
  const { formProps } = useAutoSaveForm('visual', 'product-form-visual', state, isPending, formAction);

  return (
    <form id="product-form-visual" {...formProps} className="contents">
      <input type="hidden" name="id" value={data.product.id} />
      <div className="order-2 space-y-5 lg:col-start-2">
        {ADMIN_LOCALES.map((locale) => (
          <div key={locale} className={cn(locale === activeLocale ? 'contents' : 'hidden')}>
            <VisualLocaleFields locale={locale} data={data} t={t} />
          </div>
        ))}
        <VisualPricingFields data={data} t={t} />
      </div>
      <div className="order-4 lg:col-span-2">
        {ADMIN_LOCALES.map((locale) => (
          <div key={`details-${locale}`} className={cn(locale === activeLocale ? 'contents' : 'hidden')}>
            <VisualDetailsFields locale={locale} data={data} t={t} />
          </div>
        ))}
      </div>
      <div className="order-5 lg:col-span-2">
        <VisualBasicFields data={data} t={t} state={state} />
      </div>
    </form>
  );
}

/**
 * Customer-shaped product editing surface. Media and the commercial summary occupy the first
 * row; the configurable variant table comes next, followed by descriptive, operational and SEO
 * fields. The shared language switch controls every multilingual section on the page.
 */
export function VisualProductEditor({ data }: { data: ProductEditorData }) {
  const t = useAdminT();
  const [activeLocale, setActiveLocale] = useState<AdminLocale>(defaultLocale);

  return (
    <div id="visual-product-editor" className="space-y-5">
      <section className="rounded-2xl border border-navy-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-copper-700">{t.products.visualTitle}</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-navy-950">{t.products.visualTitle}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{t.products.visualHint}</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted">{t.products.contentLanguage}</p>
            <div role="tablist" aria-label={t.products.contentLanguage} className="inline-flex flex-wrap gap-1 rounded-xl border border-navy-200 bg-navy-50 p-1">
              {ADMIN_LOCALES.map((locale) => {
                const selected = activeLocale === locale;
                const hasName = data.translations[locale].name.trim().length > 0;
                return (
                  <button
                    key={locale}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveLocale(locale)}
                    className={cn(
                      'rounded-lg px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500',
                      selected ? 'bg-navy-900 text-ivory-50' : 'text-navy-700 hover:bg-white',
                    )}
                  >
                    {getContentLocaleLabel(t, locale)}
                    {hasName ? <span aria-hidden className="ml-1 text-emerald-400">●</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)] lg:items-start">
        <VisualProductForm data={data} activeLocale={activeLocale} t={t} />
        <VisualMediaGallery
          productId={data.product.id}
          items={data.media}
          assets={data.galleryAssets}
          coverAssetId={data.product.coverAssetId}
          hoverVideoAssetId={data.product.hoverVideoAssetId}
          className="order-1"
        />
        <SpecsTab
          data={data}
          formId="product-form-visual-specs"
          statusTab="visual-specs"
          activeLocale={activeLocale}
          layout="grid"
        />
      </div>

      <section className="space-y-4 rounded-2xl border border-navy-200 bg-white p-4 sm:p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-copper-700">SEO</p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-navy-950">{t.products.seoSection}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">{t.products.seoVisualHint}</p>
        </div>
        <SeoTab
          data={data}
          formId="product-form-visual-seo"
          statusTab="visual-seo"
          activeLocale={activeLocale}
        />
      </section>
    </div>
  );
}
