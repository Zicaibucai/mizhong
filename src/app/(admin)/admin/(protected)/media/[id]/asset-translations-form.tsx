'use client';

import { useActionState } from 'react';
import { saveAssetTranslationsAction } from '@/lib/admin/actions/media';
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

export interface AssetTranslationValues {
  title: string;
  caption: string;
  alt: string;
}

export function AssetTranslationsForm({
  id,
  translations,
}: {
  id: string;
  translations: Record<AdminLocale, AssetTranslationValues>;
}) {
  const t = useAdminT();
  const [state, formAction] = useActionState(saveAssetTranslationsAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={id} />

      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}

      {/* 字典中没有「已保存」文案键，这里用符号 + 无障碍名称表达保存成功 */}
      {state.status === 'success' ? (
        <span
          role="status"
          aria-label={t.media.save}
          title={t.media.save}
          className="text-sm font-medium text-emerald-700"
        >
          ✓
        </span>
      ) : null}

      {ADMIN_LOCALES.map((locale) => (
        <LocaleSection
          key={locale}
          title={`${getContentLocaleLabel(t, locale)} · ${t.media.translationsSection}`}
          open={locale === 'zh'}
        >
          <Field label={t.media.titleLabel} htmlFor={`${locale}_title-${id}`}>
            <TextInput
              id={`${locale}_title-${id}`}
              name={`${locale}_title`}
              defaultValue={translations[locale].title}
            />
          </Field>
          <Field label={t.media.captionLabel} htmlFor={`${locale}_caption-${id}`}>
            <TextArea
              id={`${locale}_caption-${id}`}
              name={`${locale}_caption`}
              defaultValue={translations[locale].caption}
              rows={3}
            />
          </Field>
          <Field
            label={t.media.altLabel}
            htmlFor={`${locale}_alt-${id}`}
            hint={t.media.altHint}
          >
            <TextInput
              id={`${locale}_alt-${id}`}
              name={`${locale}_alt`}
              defaultValue={translations[locale].alt}
            />
          </Field>
        </LocaleSection>
      ))}

      <SubmitButton pendingText={t.common.saving}>{t.media.save}</SubmitButton>
    </form>
  );
}
