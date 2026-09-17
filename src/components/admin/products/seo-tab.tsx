'use client';

import { useActionState } from 'react';
import { saveProductSeoAction } from '@/lib/admin/actions/products';
import { initialFormState } from '@/lib/admin/action-state';
import { ADMIN_LOCALES } from '@/lib/admin/validation';
import { getContentLocaleLabel } from '@/lib/admin/labels';
import {
  Alert,
  Field,
  LocaleSection,
  SubmitButton,
  TextArea,
  TextInput,
} from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';
import { useAutoSaveForm } from './tabs';
import type { ProductEditorData } from './types';

/** Search-engine listing copy per language. */
export function SeoTab({ data }: { data: ProductEditorData }) {
  const t = useAdminT();
  const [state, formAction, isPending] = useActionState(saveProductSeoAction, initialFormState);
  const { formProps } = useAutoSaveForm('seo', 'product-form-seo', state, isPending, formAction);
  

  return (
    <form
      id="product-form-seo"
      {...formProps}
      
      className="space-y-5"
    >
      <input type="hidden" name="id" value={data.product.id} />

      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}
      {state.status === 'success' && state.message ? (
        <Alert kind="success">{state.message}</Alert>
      ) : null}

      {ADMIN_LOCALES.map((locale) => (
        <LocaleSection
          key={locale}
          title={`${getContentLocaleLabel(t, locale)} · ${t.products.seoSection}`}
          open={locale === 'zh'}
        >
          <Field
            label={t.products.seoTitleLabel}
            htmlFor={`${locale}_seoTitle`}
            hint={t.products.seoTitleHint}
          >
            <TextInput
              id={`${locale}_seoTitle`}
              name={`${locale}_seoTitle`}
              defaultValue={data.translations[locale].seoTitle}
            />
          </Field>
          <Field label={t.products.seoDescriptionLabel} htmlFor={`${locale}_seoDescription`}>
            <TextArea
              id={`${locale}_seoDescription`}
              name={`${locale}_seoDescription`}
              defaultValue={data.translations[locale].seoDescription}
              rows={3}
            />
          </Field>
        </LocaleSection>
      ))}

      <div className="flex justify-end">
        <SubmitButton pendingText={t.common.saving}>{t.products.saveDraft}</SubmitButton>
      </div>
    </form>
  );
}
