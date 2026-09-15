'use client';

import { useActionState } from 'react';
import { saveBlockAction } from '@/lib/admin/actions/pages';
import { initialFormState } from '@/lib/admin/action-state';
import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';
import { LOCALE_LABELS } from '@/lib/admin/labels';
import {
  Alert,
  Checkbox,
  Field,
  LocaleSection,
  SubmitButton,
  TextArea,
  TextInput,
} from '@/components/admin/form';

export interface BlockFormValues {
  id: string;
  key: string;
  enabled: boolean;
  translations: Record<
    AdminLocale,
    { title: string; subtitle: string; body: string; ctaLabel: string; ctaHref: string }
  >;
}

export function BlockForm({ values }: { values: BlockFormValues }) {
  const [state, formAction] = useActionState(saveBlockAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={values.id} />

      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}
      {state.status === 'success' && state.message ? (
        <Alert kind="success">{state.message}</Alert>
      ) : null}

      <Checkbox name="enabled" label="启用该区块（关闭后前台不显示）" defaultChecked={values.enabled} />

      {ADMIN_LOCALES.map((locale) => {
        const value = values.translations[locale];
        return (
          <LocaleSection key={locale} title={LOCALE_LABELS[locale]} open={locale === 'zh'}>
            <Field label="标题" htmlFor={`${values.id}-${locale}-title`}>
              <TextInput
                id={`${values.id}-${locale}-title`}
                name={`${locale}_title`}
                defaultValue={value.title}
              />
            </Field>
            <Field label="副标题 / 描述" htmlFor={`${values.id}-${locale}-subtitle`}>
              <TextArea
                id={`${values.id}-${locale}-subtitle`}
                name={`${locale}_subtitle`}
                defaultValue={value.subtitle}
                rows={3}
              />
            </Field>
            <Field label="正文（可选）" htmlFor={`${values.id}-${locale}-body`}>
              <TextArea
                id={`${values.id}-${locale}-body`}
                name={`${locale}_body`}
                defaultValue={value.body}
                rows={3}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="按钮文字" htmlFor={`${values.id}-${locale}-ctaLabel`}>
                <TextInput
                  id={`${values.id}-${locale}-ctaLabel`}
                  name={`${locale}_ctaLabel`}
                  defaultValue={value.ctaLabel}
                />
              </Field>
              <Field
                label="按钮链接"
                htmlFor={`${values.id}-${locale}-ctaHref`}
                hint="如 #inquiry 或 /zh/products"
              >
                <TextInput
                  id={`${values.id}-${locale}-ctaHref`}
                  name={`${locale}_ctaHref`}
                  defaultValue={value.ctaHref}
                />
              </Field>
            </div>
          </LocaleSection>
        );
      })}

      <SubmitButton pendingText="保存中…">保存区块</SubmitButton>
    </form>
  );
}
