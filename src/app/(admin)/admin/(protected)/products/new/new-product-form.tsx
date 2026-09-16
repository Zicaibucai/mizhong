'use client';

import { useActionState } from 'react';
import { createProductAction } from '@/lib/admin/actions/products';
import { initialFormState } from '@/lib/admin/action-state';
import { ADMIN_LOCALES } from '@/lib/admin/validation';
import { getContentLocaleLabel } from '@/lib/admin/labels';
import {
  Alert,
  Field,
  LocaleSection,
  Select,
  SubmitButton,
  TextInput,
} from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';
import { SlugAutoFill } from '@/components/admin/products/slug-auto-fill';

/**
 * Creates a draft product (slug + optional category + an optional name in any language) and opens
 * its editor. Everything else — media, translations, SEO — is edited there.
 */
export function NewProductForm({ categories }: { categories: { id: string; name: string }[] }) {
  const t = useAdminT();
  const [state, formAction] = useActionState(createProductAction, initialFormState);

  return (
    <form id="new-product-form" action={formAction} className="space-y-5">
      {/* 英文名称 → slug 建议；管理员手动改过 slug 后不再覆盖 */}
      <SlugAutoFill formId="new-product-form" nameFieldId="en_name" slugFieldId="slug" />

      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.products.slug} htmlFor="slug" hint={t.products.slugHint}>
          <TextInput id="slug" name="slug" required />
        </Field>
        <Field label={t.products.category} htmlFor="categoryId">
          <Select
            id="categoryId"
            name="categoryId"
            defaultValue=""
            options={[
              { value: '', label: t.products.noCategory },
              ...categories.map((category) => ({ value: category.id, label: category.name })),
            ]}
          />
        </Field>
      </div>

      {ADMIN_LOCALES.map((locale) => (
        <LocaleSection
          key={locale}
          title={`${getContentLocaleLabel(t, locale)} · ${t.products.nameLabel}`}
          open={locale === 'zh'}
        >
          <Field label={t.products.nameLabel} htmlFor={`${locale}_name`}>
            <TextInput id={`${locale}_name`} name={`${locale}_name`} />
          </Field>
        </LocaleSection>
      ))}

      <div className="flex justify-end">
        <SubmitButton pendingText={t.common.processing}>{t.products.new}</SubmitButton>
      </div>
    </form>
  );
}
