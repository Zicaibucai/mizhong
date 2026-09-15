'use client';

import { useActionState } from 'react';
import { saveContactAction } from '@/lib/admin/actions/contacts';
import { initialFormState } from '@/lib/admin/action-state';
import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';
import { CONTACT_TYPE_LABELS, LOCALE_LABELS } from '@/lib/admin/labels';
import {
  Alert,
  Checkbox,
  Field,
  LocaleSection,
  Select,
  SubmitButton,
  TextInput,
} from '@/components/admin/form';

export interface ContactValues {
  id?: string;
  type: string;
  value: string;
  href: string;
  sortOrder: number;
  enabled: boolean;
  translations: Record<AdminLocale, { label: string; value: string }>;
}

const EMPTY: ContactValues = {
  type: 'EMAIL',
  value: '',
  href: '',
  sortOrder: 0,
  enabled: true,
  translations: {
    zh: { label: '', value: '' },
    en: { label: '', value: '' },
    vi: { label: '', value: '' },
  },
};

export function ContactForm({
  contact,
  submitLabel,
}: {
  contact?: ContactValues;
  submitLabel: string;
}) {
  const initial = contact ?? EMPTY;
  const [state, formAction] = useActionState(saveContactAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}
      {state.status === 'success' && state.message ? (
        <Alert kind="success">{state.message}</Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="类型" htmlFor={`type-${initial.id ?? 'new'}`}>
          <Select
            id={`type-${initial.id ?? 'new'}`}
            name="type"
            defaultValue={initial.type}
            options={Object.entries(CONTACT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </Field>
        <Field label="显示顺序" htmlFor={`sortOrder-${initial.id ?? 'new'}`} hint="数字越小越靠前">
          <TextInput
            id={`sortOrder-${initial.id ?? 'new'}`}
            name="sortOrder"
            type="number"
            defaultValue={String(initial.sortOrder)}
          />
        </Field>
      </div>

      <Field
        label="通用值"
        htmlFor={`value-${initial.id ?? 'new'}`}
        hint="邮箱地址 / 电话号码 / WhatsApp 号码等（各语言通用）"
      >
        <TextInput id={`value-${initial.id ?? 'new'}`} name="value" defaultValue={initial.value} />
      </Field>

      <Field
        label="自定义链接（可选）"
        htmlFor={`href-${initial.id ?? 'new'}`}
        hint="留空时按类型自动生成 mailto: / tel: / wa.me 链接"
      >
        <TextInput id={`href-${initial.id ?? 'new'}`} name="href" defaultValue={initial.href} />
      </Field>

      <Checkbox name="enabled" label="启用（启用后前台才会展示）" defaultChecked={initial.enabled} />

      {ADMIN_LOCALES.map((locale) => (
        <LocaleSection key={locale} title={`${LOCALE_LABELS[locale]} · 展示文字`} open={locale === 'zh'}>
          <Field label="展示标签（留空使用类型默认名）" htmlFor={`${locale}_label-${initial.id ?? 'new'}`}>
            <TextInput
              id={`${locale}_label-${initial.id ?? 'new'}`}
              name={`${locale}_label`}
              defaultValue={initial.translations[locale].label}
            />
          </Field>
          <Field
            label="该语言的值（如地址文本）"
            htmlFor={`${locale}_value-${initial.id ?? 'new'}`}
            hint="留空则使用上方「通用值」"
          >
            <TextInput
              id={`${locale}_value-${initial.id ?? 'new'}`}
              name={`${locale}_value`}
              defaultValue={initial.translations[locale].value}
            />
          </Field>
        </LocaleSection>
      ))}

      <SubmitButton pendingText="保存中…">{submitLabel}</SubmitButton>
    </form>
  );
}
