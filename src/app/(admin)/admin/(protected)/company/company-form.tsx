'use client';

import { useActionState } from 'react';
import { saveCompanyAction } from '@/lib/admin/actions/company';
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

export interface CompanyValues {
  name: string;
  tagline: string;
  about: string;
  positioning: string;
  address: string;
  businessHours: string;
  seoTitle: string;
  seoDescription: string;
}

export function CompanyForm({ values }: { values: Record<AdminLocale, CompanyValues> }) {
  const [state, formAction] = useActionState(saveCompanyAction, initialFormState);

  return (
    <form action={formAction} className="space-y-5">
      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}
      {state.status === 'success' && state.message ? (
        <Alert kind="success">{state.message}</Alert>
      ) : null}

      {ADMIN_LOCALES.map((locale) => {
        const value = values[locale];
        return (
          <LocaleSection key={locale} title={LOCALE_LABELS[locale]} open={locale === 'zh'}>
            <Field label="公司名称" htmlFor={`${locale}_name`}>
              <TextInput
                id={`${locale}_name`}
                name={`${locale}_name`}
                defaultValue={value.name}
                required
              />
            </Field>
            <Field label="品牌标语 Tagline" htmlFor={`${locale}_tagline`}>
              <TextInput
                id={`${locale}_tagline`}
                name={`${locale}_tagline`}
                defaultValue={value.tagline}
              />
            </Field>
            <Field label="公司简介" htmlFor={`${locale}_about`}>
              <TextArea
                id={`${locale}_about`}
                name={`${locale}_about`}
                defaultValue={value.about}
                rows={5}
              />
            </Field>
            <Field label="业务定位" htmlFor={`${locale}_positioning`}>
              <TextArea
                id={`${locale}_positioning`}
                name={`${locale}_positioning`}
                defaultValue={value.positioning}
                rows={2}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="地址" htmlFor={`${locale}_address`}>
                <TextInput
                  id={`${locale}_address`}
                  name={`${locale}_address`}
                  defaultValue={value.address}
                />
              </Field>
              <Field label="营业时间" htmlFor={`${locale}_businessHours`}>
                <TextInput
                  id={`${locale}_businessHours`}
                  name={`${locale}_businessHours`}
                  defaultValue={value.businessHours}
                />
              </Field>
            </div>
            <Field
              label="默认 SEO 标题"
              htmlFor={`${locale}_seoTitle`}
              hint="留空则自动使用「公司名 — 默认标题」"
            >
              <TextInput
                id={`${locale}_seoTitle`}
                name={`${locale}_seoTitle`}
                defaultValue={value.seoTitle}
              />
            </Field>
            <Field label="默认 SEO 描述" htmlFor={`${locale}_seoDescription`}>
              <TextArea
                id={`${locale}_seoDescription`}
                name={`${locale}_seoDescription`}
                defaultValue={value.seoDescription}
                rows={3}
              />
            </Field>
          </LocaleSection>
        );
      })}

      <div className="flex justify-end">
        <SubmitButton pendingText="保存中…">保存公司资料</SubmitButton>
      </div>
    </form>
  );
}
