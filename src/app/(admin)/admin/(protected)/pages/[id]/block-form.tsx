'use client';

import { useActionState } from 'react';
import { saveBlockAction } from '@/lib/admin/actions/pages';
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

export interface BlockFormValues {
  id: string;
  key: string;
  enabled: boolean;
  translations: Record<
    AdminLocale,
    { title: string; subtitle: string; body: string; ctaLabel: string; ctaHref: string }
  >;
}

/**
 * 区块表单。每个区块一个独立表单 —— 与商品编辑器一样，只写**草稿**，
 * 发布时才进线上。
 *
 * `id` 必须与页面里 `PageTranslateButton` 收到的 `block-form-<区块id>` 一致：
 * 一键翻译按它找到表单并逐个保存。改掉名字会让翻译读到旧内容。
 */
export function BlockForm({ values }: { values: BlockFormValues }) {
  const t = useAdminT();
  const [state, formAction] = useActionState(saveBlockAction, initialFormState);

  return (
    <form id={`block-form-${values.id}`} action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={values.id} />

      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}
      {state.status === 'success' && state.message ? (
        <Alert kind="success">{state.message}</Alert>
      ) : null}

      <Checkbox
        name="enabled"
        label={t.blockForm.enabled}
        defaultChecked={values.enabled}
      />

      {ADMIN_LOCALES.map((locale) => {
        const value = values.translations[locale];
        return (
          <LocaleSection
            key={locale}
            title={getContentLocaleLabel(t, locale)}
            open={locale === 'zh'}
          >
            <Field label={t.blockForm.title} htmlFor={`${values.id}-${locale}-title`}>
              <TextInput
                id={`${values.id}-${locale}-title`}
                name={`${locale}_title`}
                defaultValue={value.title}
              />
            </Field>
            <Field label={t.blockForm.subtitle} htmlFor={`${values.id}-${locale}-subtitle`}>
              <TextArea
                id={`${values.id}-${locale}-subtitle`}
                name={`${locale}_subtitle`}
                defaultValue={value.subtitle}
                rows={3}
              />
            </Field>
            <Field label={t.blockForm.body} htmlFor={`${values.id}-${locale}-body`}>
              <TextArea
                id={`${values.id}-${locale}-body`}
                name={`${locale}_body`}
                defaultValue={value.body}
                rows={3}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.blockForm.buttonLabel} htmlFor={`${values.id}-${locale}-ctaLabel`}>
                <TextInput
                  id={`${values.id}-${locale}-ctaLabel`}
                  name={`${locale}_ctaLabel`}
                  defaultValue={value.ctaLabel}
                />
              </Field>
              <Field
                label={t.blockForm.buttonLink}
                htmlFor={`${values.id}-${locale}-ctaHref`}
                hint={t.blockForm.buttonLinkHint}
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

      <SubmitButton pendingText={t.common.saving}>{t.blockForm.save}</SubmitButton>
    </form>
  );
}
