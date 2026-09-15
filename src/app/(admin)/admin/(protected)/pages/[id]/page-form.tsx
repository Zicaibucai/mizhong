'use client';

import { useActionState } from 'react';
import { savePageAction } from '@/lib/admin/actions/pages';
import { initialFormState } from '@/lib/admin/action-state';
import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';
import { LOCALE_LABELS } from '@/lib/admin/labels';
import {
  Alert,
  Field,
  LocaleSection,
  SubmitButton,
  TextArea,
  TextInput,
} from '@/components/admin/form';

export interface PageFormValues {
  id: string;
  slug: string;
  translations: Record<AdminLocale, { title: string; seoTitle: string; seoDescription: string }>;
}

export function PageForm({ values }: { values: PageFormValues }) {
  const [state, formAction] = useActionState(savePageAction, initialFormState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={values.id} />

      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}
      {state.status === 'success' && state.message ? (
        <Alert kind="success">{state.message}</Alert>
      ) : null}

      <Field label="slug" htmlFor="slug" hint="仅小写字母、数字与连字符">
        <TextInput id="slug" name="slug" defaultValue={values.slug} required />
      </Field>

      {ADMIN_LOCALES.map((locale) => (
        <LocaleSection key={locale} title={LOCALE_LABELS[locale]} open={locale === 'zh'}>
          <Field label="页面标题" htmlFor={`${locale}_title`}>
            <TextInput
              id={`${locale}_title`}
              name={`${locale}_title`}
              defaultValue={values.translations[locale].title}
              required
            />
          </Field>
          <Field label="SEO 标题" htmlFor={`${locale}_seoTitle`} hint="留空则使用页面标题">
            <TextInput
              id={`${locale}_seoTitle`}
              name={`${locale}_seoTitle`}
              defaultValue={values.translations[locale].seoTitle}
            />
          </Field>
          <Field label="SEO 描述" htmlFor={`${locale}_seoDescription`}>
            <TextArea
              id={`${locale}_seoDescription`}
              name={`${locale}_seoDescription`}
              defaultValue={values.translations[locale].seoDescription}
              rows={3}
            />
          </Field>
        </LocaleSection>
      ))}

      <div className="flex justify-end">
        <SubmitButton pendingText="保存中…">保存页面信息</SubmitButton>
      </div>
    </form>
  );
}
