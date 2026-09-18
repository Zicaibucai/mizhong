'use client';

import { useActionState } from 'react';
import { savePageAction } from '@/lib/admin/actions/pages';
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

export interface PageFormValues {
  id: string;
  slug: string;
  translations: Record<AdminLocale, { title: string; seoTitle: string; seoDescription: string }>;
}

/**
 * 页面信息表单。
 *
 * `id="page-form"` 不是装饰：一键翻译按钮按这个 id 找到表单、把它交给保存动作，
 * 再让服务端按刚保存的内容去翻译。改掉它会静默地让翻译读到旧内容。
 */
export function PageForm({ values }: { values: PageFormValues }) {
  const t = useAdminT();
  const [state, formAction] = useActionState(savePageAction, initialFormState);

  return (
    <form id="page-form" action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={values.id} />

      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}
      {state.status === 'success' && state.message ? (
        <Alert kind="success">{state.message}</Alert>
      ) : null}

      <Field
        label={t.pageForm.slug}
        htmlFor="slug"
        hint={t.pageForm.slugHint}
      >
        <TextInput id="slug" name="slug" defaultValue={values.slug} required />
      </Field>

      {ADMIN_LOCALES.map((locale) => (
        <LocaleSection
          key={locale}
          title={getContentLocaleLabel(t, locale)}
          open={locale === 'zh'}
        >
          <Field label={t.pageForm.pageTitle} htmlFor={`${locale}_title`}>
            <TextInput
              id={`${locale}_title`}
              name={`${locale}_title`}
              defaultValue={values.translations[locale].title}
              required
            />
          </Field>
          <Field
            label={t.pageForm.seoTitle}
            htmlFor={`${locale}_seoTitle`}
            hint={t.pageForm.seoTitleHint}
          >
            <TextInput
              id={`${locale}_seoTitle`}
              name={`${locale}_seoTitle`}
              defaultValue={values.translations[locale].seoTitle}
            />
          </Field>
          <Field label={t.pageForm.seoDescription} htmlFor={`${locale}_seoDescription`}>
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
        <SubmitButton pendingText={t.common.saving}>{t.pageForm.save}</SubmitButton>
      </div>
    </form>
  );
}
