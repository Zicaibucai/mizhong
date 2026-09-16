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
import { useDirtyForm } from './tabs';
import type { ProductEditorData } from './types';

/** Name, short introduction, full description, specifications and applications per language. */
export function TranslationsTab({ data }: { data: ProductEditorData }) {
  const t = useAdminT();
  const [state, formAction] = useActionState(saveProductTranslationsAction, initialFormState);
  const dirty = useDirtyForm('translations', state);

  return (
    <form action={formAction} onChange={dirty.markDirty} className="space-y-5">
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
