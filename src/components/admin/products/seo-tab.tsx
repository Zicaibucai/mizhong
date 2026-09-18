'use client';

import { useActionState, useEffect } from 'react';
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
  nameSourceFormId,
}: {
  data: ProductEditorData;
  formId?: string;
  statusTab?: string;
  activeLocale?: AdminLocale;
  /** 商品名称 / 简介所在的表单，用来实时读取它们的当前值（通常是可视化编辑表单） */
  nameSourceFormId?: string;
}) {
  const t = useAdminT();
  const [state, formAction, isPending] = useActionState(saveProductSeoAction, initialFormState);
  const { formProps } = useAutoSaveForm(statusTab, formId, state, isPending, formAction);

  useSeoFallbackPlaceholders({ formId, nameSourceFormId });

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

/**
 * 把 SEO 标题 / 描述的回退值显示成**占位提示**。
 *
 * 这是本项目对需求里「SEO 展示区域实时更新，但不能反向覆盖人工填写」的落地方式：
 *
 *   - 输入框里**有值** = 人工填写，原样保留，绝不改动；
 *   - 输入框**为空** = 当前使用回退值，于是把回退值（商品名称 / 一句话介绍）
 *     作为灰色占位提示显示出来，并随名称的输入实时变化。
 *
 * 之所以不把回退值直接写进输入框：一旦写进去，它就变成了一条「看起来像人工填写」的
 * 静态值 —— 之后再改商品名，那条旧标题不会跟着变，用户也分不清哪些是自己写的、
 * 哪些是系统填的。存进去的只有人工输入，回退永远发生在展示层。
 */
function useSeoFallbackPlaceholders({
  formId,
  nameSourceFormId,
}: {
  formId: string;
  nameSourceFormId?: string;
}) {
  useEffect(() => {
    const scope: ParentNode =
      (nameSourceFormId ? document.getElementById(nameSourceFormId) : null) ?? document;

    const sync = () => {
      for (const locale of ADMIN_LOCALES) {
        const name = scope.querySelector<HTMLInputElement>(`[name="${locale}_name"]`);
        const summary = scope.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          `[name="${locale}_shortDescription"]`,
        );
        const title = document.getElementById(`${formId}-${locale}-seoTitle`);
        const description = document.getElementById(`${formId}-${locale}-seoDescription`);

        // 只改 placeholder，绝不碰 value
        if (title instanceof HTMLInputElement) title.placeholder = name?.value.trim() ?? '';
        if (description instanceof HTMLTextAreaElement) {
          description.placeholder = summary?.value.trim() ?? '';
        }
      }
    };

    sync();
    // 名称 / 简介在别的表单里，用文档级监听覆盖全部输入
    document.addEventListener('input', sync);
    return () => document.removeEventListener('input', sync);
  }, [formId, nameSourceFormId]);
}
