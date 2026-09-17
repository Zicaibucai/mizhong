'use client';

import { useActionState } from 'react';
import { saveProductTranslationsAction } from '@/lib/admin/actions/products';
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

/** 名称、一句话介绍、尺寸摘要、完整介绍、规格说明、应用场景 —— 每种语言一组。 */
export function TranslationsTab({ data }: { data: ProductEditorData }) {
  const t = useAdminT();
  const [state, formAction, isPending] = useActionState(saveProductTranslationsAction, initialFormState);
  const { formProps } = useAutoSaveForm('translations', 'product-form-translations', state, isPending, formAction);
  

  return (
    <form
      id="product-form-translations"
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
          title={`${getContentLocaleLabel(t, locale)} · ${t.products.translationsSection}`}
          open={locale === 'zh'}
        >
          <Field label={t.products.nameLabel} htmlFor={`${locale}_name`}>
            <TextInput id={`${locale}_name`} name={`${locale}_name`} defaultValue={data.translations[locale].name} />
          </Field>
          <Field label={t.products.shortDescriptionLabel} htmlFor={`${locale}_shortDescription`}>
            <TextArea
              id={`${locale}_shortDescription`}
              name={`${locale}_shortDescription`}
              defaultValue={data.translations[locale].shortDescription}
              rows={2}
            />
          </Field>
          <Field
            label={t.products.sizeSummaryLabel}
            htmlFor={`${locale}_sizeSummary`}
            hint={t.products.sizeSummaryHint}
          >
            <TextInput
              id={`${locale}_sizeSummary`}
              name={`${locale}_sizeSummary`}
              defaultValue={data.translations[locale].sizeSummary}
            />
          </Field>
          <Field label={t.products.descriptionLabel} htmlFor={`${locale}_description`}>
            <TextArea
              id={`${locale}_description`}
              name={`${locale}_description`}
              defaultValue={data.translations[locale].description}
              rows={4}
            />
          </Field>
          <Field label={t.products.specLabel} htmlFor={`${locale}_spec`}>
            <TextArea
              id={`${locale}_spec`}
              name={`${locale}_spec`}
              defaultValue={data.translations[locale].spec}
              rows={3}
            />
          </Field>
          <Field label={t.products.applicationLabel} htmlFor={`${locale}_application`}>
            <TextArea
              id={`${locale}_application`}
              name={`${locale}_application`}
              defaultValue={data.translations[locale].application}
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
