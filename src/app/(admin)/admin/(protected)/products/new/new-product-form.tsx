'use client';

import { useActionState } from 'react';
import { createProductAction } from '@/lib/admin/actions/products';
import { initialFormState } from '@/lib/admin/action-state';
import { ADMIN_LOCALES } from '@/lib/admin/validation';
import { getContentLocaleLabel } from '@/lib/admin/labels';
import { defaultLocale } from '@/lib/i18n/config';
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
import { SlugPreview } from '@/components/admin/products/slug-preview';

/**
 * 新建商品。
 *
 * 这里刻意只问「商品叫什么」——名称是任何人都答得上来的问题。
 * 网址后缀（slug）是技术细节，放在最后、标为可选、并给出完整网址预览；
 * 留空时服务端会按名称自动生成（见 createProductAction / resolveCreateSlug）。
 *
 * 建好后直接跳转到完整的商品编辑器，价格、图片视频、规格参数、多语言都在那里填，
 * 所以这个页面不需要、也不应该复制那六个分区。
 */
export function NewProductForm({ categories }: { categories: { id: string; name: string }[] }) {
  const t = useAdminT();
  const [state, formAction] = useActionState(createProductAction, initialFormState);

  return (
    <form id="new-product-form" action={formAction} className="space-y-5">
      {/* 英文名称 → 网址后缀建议；管理员手动改过后不再覆盖 */}
      <SlugAutoFill formId="new-product-form" nameFieldId="en_name" slugFieldId="slug" />

      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}

      <p className="rounded-lg border border-navy-200 bg-navy-50 px-4 py-3 text-sm leading-relaxed text-navy-700">
        {t.products.createNote}
      </p>

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

      <Field label={t.products.slug} htmlFor="slug" hint={t.products.slugCreateHint}>
        <TextInput id="slug" name="slug" placeholder="webbing-25mm" />
        <SlugPreview
          formId="new-product-form"
          slugFieldId="slug"
          prefix={`/${defaultLocale}/products/`}
          label={t.products.slugPreviewLabel}
        />
      </Field>

      <div className="flex justify-end">
        <SubmitButton pendingText={t.common.processing}>{t.products.new}</SubmitButton>
      </div>
    </form>
  );
}
