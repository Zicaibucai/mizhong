'use client';

import { useActionState } from 'react';
import { saveProductSeoAction } from '@/lib/admin/actions/products';
import { initialFormState } from '@/lib/admin/action-state';
import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';
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
import { cn } from '@/lib/cn';
import { defaultLocale } from '@/lib/i18n/config';
import { useAutoSaveForm } from './tabs';
import type { ProductEditorData } from './types';

/** Search-engine listing copy per language. */
export function SeoTab({
  data,
  formId = 'product-form-seo',
  statusTab = 'seo',
  activeLocale = defaultLocale,
}: {
  data: ProductEditorData;
  formId?: string;
  statusTab?: string;
  activeLocale?: AdminLocale;
}) {
  const t = useAdminT();
  const [state, formAction, isPending] = useActionState(saveProductSeoAction, initialFormState);
  const { formProps } = useAutoSaveForm(statusTab, formId, state, isPending, formAction);

  return (
    <form id={formId} {...formProps} className="space-y-5">
      <input type="hidden" name="id" value={data.product.id} />

      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}
      {state.status === 'success' && state.message ? (
        <Alert kind="success">{state.message}</Alert>
      ) : null}

      {ADMIN_LOCALES.map((locale) => (
        <div key={locale} className={cn(locale === activeLocale ? 'block' : 'hidden')}>
          <LocaleSection
            title={`${getContentLocaleLabel(t, locale)} · ${t.products.seoSection}`}
            open
          >
            <Field
              label={t.products.seoTitleLabel}
              htmlFor={`${formId}-${locale}-seoTitle`}
              hint={t.products.seoTitleHint}
            >
              <TextInput
                id={`${formId}-${locale}-seoTitle`}
                name={`${locale}_seoTitle`}
                defaultValue={data.translations[locale].seoTitle}
              />
            </Field>
            <Field label={t.products.seoDescriptionLabel} htmlFor={`${formId}-${locale}-seoDescription`}>
              <TextArea
                id={`${formId}-${locale}-seoDescription`}
                name={`${locale}_seoDescription`}
                defaultValue={data.translations[locale].seoDescription}
                rows={3}
              />
            </Field>
          </LocaleSection>
        </div>
      ))}

      <div className="flex justify-end">
        <SubmitButton pendingText={t.common.saving}>{t.products.saveDraft}</SubmitButton>
      </div>
    </form>
  );
}
