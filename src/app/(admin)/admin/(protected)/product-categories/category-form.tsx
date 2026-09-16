'use client';

import { useActionState } from 'react';
import { saveProductCategoryAction } from '@/lib/admin/actions/product-categories';
import { initialFormState } from '@/lib/admin/action-state';
import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';
import { getContentLocaleLabel } from '@/lib/admin/labels';
import {
  Alert,
  Checkbox,
  Field,
  LocaleSection,
  SubmitButton,
  TextArea,
  TextInput,
} from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';
import { AssetPicker, type PickerAsset } from '@/components/admin/products/asset-picker';

export interface CategoryValues {
  id?: string;
  slug: string;
  sortOrder: number;
  enabled: boolean;
  coverAssetId: string | null;
  translations: Record<AdminLocale, { name: string; description: string }>;
}

const EMPTY: CategoryValues = {
  slug: '',
  sortOrder: 0,
  enabled: true,
  coverAssetId: null,
  translations: {
    zh: { name: '', description: '' },
    en: { name: '', description: '' },
    vi: { name: '', description: '' },
  },
};

/** Create / edit form for one product category, rendered inline in the list. */
export function CategoryForm({
  category,
  assets,
  submitLabel,
}: {
  category?: CategoryValues;
  assets: PickerAsset[];
  submitLabel: string;
}) {
  const t = useAdminT();
  const initial = category ?? EMPTY;
  const suffix = initial.id ?? 'new';
  const [state, formAction] = useActionState(saveProductCategoryAction, initialFormState);

  return (
    <form action={formAction} className="space-y-5">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}
      {state.status === 'success' && state.message ? (
        <Alert kind="success">{state.message}</Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.productCategories.slug} htmlFor={`slug-${suffix}`} hint={t.productCategories.slugHint}>
          <TextInput
            id={`slug-${suffix}`}
            name="slug"
            defaultValue={initial.slug}
            required
          />
        </Field>
        <Field
          label={t.productCategories.sortOrder}
          htmlFor={`sortOrder-${suffix}`}
          hint={t.productCategories.sortOrderHint}
        >
          <TextInput
            id={`sortOrder-${suffix}`}
            name="sortOrder"
            type="number"
            defaultValue={String(initial.sortOrder)}
          />
        </Field>
      </div>

      <Checkbox
        name="enabled"
        label={t.productCategories.enabled}
        defaultChecked={initial.enabled}
        id={`enabled-${suffix}`}
      />

      <Field label={t.productCategories.cover} hint={t.productCategories.coverHint}>
        <AssetPicker
          name="coverAssetId"
          assets={assets}
          initialId={initial.coverAssetId}
          labels={{
            choose: t.productCategories.chooseCover,
            change: t.productCategories.changeCover,
            remove: t.productCategories.removeCover,
            none: t.productCategories.noCover,
            empty: t.media.empty,
          }}
        />
      </Field>

      {ADMIN_LOCALES.map((locale) => (
        <LocaleSection
          key={locale}
          title={`${getContentLocaleLabel(t, locale)} · ${t.productCategories.translationsSection}`}
          open={locale === 'zh'}
        >
          <Field label={t.productCategories.nameLabel} htmlFor={`${locale}_name-${suffix}`}>
            <TextInput
              id={`${locale}_name-${suffix}`}
              name={`${locale}_name`}
              defaultValue={initial.translations[locale].name}
              required
            />
          </Field>
          <Field
            label={t.productCategories.descriptionLabel}
            htmlFor={`${locale}_description-${suffix}`}
          >
            <TextArea
              id={`${locale}_description-${suffix}`}
              name={`${locale}_description`}
              defaultValue={initial.translations[locale].description}
              rows={3}
            />
          </Field>
        </LocaleSection>
      ))}

      <div className="flex justify-end">
        <SubmitButton pendingText={t.common.saving}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
