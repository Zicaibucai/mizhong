'use client';

import { useActionState } from 'react';
import { saveNavAction } from '@/lib/admin/actions/navigation';
import { initialFormState } from '@/lib/admin/action-state';
import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';
import { LOCALE_LABELS } from '@/lib/admin/labels';
import {
  Alert,
  Checkbox,
  Field,
  LocaleSection,
  SubmitButton,
  TextInput,
} from '@/components/admin/form';

export interface NavValues {
  id?: string;
  href: string;
  external: boolean;
  sortOrder: number;
  enabled: boolean;
  translations: Record<AdminLocale, { label: string }>;
}

const EMPTY: NavValues = {
  href: '',
  external: false,
  sortOrder: 0,
  enabled: true,
  translations: { zh: { label: '' }, en: { label: '' }, vi: { label: '' } },
};

export function NavForm({ item, submitLabel }: { item?: NavValues; submitLabel: string }) {
  const initial = item ?? EMPTY;
  const [state, formAction] = useActionState(saveNavAction, initialFormState);
  const key = initial.id ?? 'new';

  return (
    <form action={formAction} className="space-y-4">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}
      {state.status === 'success' && state.message ? (
        <Alert kind="success">{state.message}</Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Field
          label="链接地址"
          htmlFor={`href-${key}`}
          hint="站内路径（/ 或 # 开头）或完整 http(s) 地址"
        >
          <TextInput id={`href-${key}`} name="href" defaultValue={initial.href} required />
        </Field>
        <Field label="显示顺序" htmlFor={`sortOrder-${key}`} hint="数字越小越靠前">
          <TextInput
            id={`sortOrder-${key}`}
            name="sortOrder"
            type="number"
            defaultValue={String(initial.sortOrder)}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-6">
        <Checkbox name="enabled" label="启用（启用后前台才会展示）" defaultChecked={initial.enabled} />
        <Checkbox name="external" label="外部链接（新窗口打开）" defaultChecked={initial.external} />
      </div>

      {ADMIN_LOCALES.map((locale) => (
        <LocaleSection key={locale} title={`${LOCALE_LABELS[locale]} · 导航名称`} open={locale === 'zh'}>
          <Field label="名称" htmlFor={`${locale}_label-${key}`}>
            <TextInput
              id={`${locale}_label-${key}`}
              name={`${locale}_label`}
              defaultValue={initial.translations[locale].label}
            />
          </Field>
        </LocaleSection>
      ))}

      <SubmitButton pendingText="保存中…">{submitLabel}</SubmitButton>
    </form>
  );
}
