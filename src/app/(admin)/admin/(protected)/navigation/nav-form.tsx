'use client';

import { useActionState } from 'react';
import { saveNavAction } from '@/lib/admin/actions/navigation';
import { initialFormState } from '@/lib/admin/action-state';
import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';
import { getContentLocaleLabel } from '@/lib/admin/labels';
import {
  Alert,
  Checkbox,
  Field,
  LocaleSection,
  SubmitButton,
  TextInput,
} from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';

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
  const t = useAdminT();
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
          label={t.navForm.linkUrl}
          htmlFor={`href-${key}`}
          hint={t.navForm.linkUrlHint}
        >
          <TextInput id={`href-${key}`} name="href" defaultValue={initial.href} required />
        </Field>
        <Field
          label={t.navForm.displayOrder}
          htmlFor={`sortOrder-${key}`}
          hint={t.navForm.displayOrderHint}
        >
          <TextInput
            id={`sortOrder-${key}`}
            name="sortOrder"
            type="number"
            defaultValue={String(initial.sortOrder)}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-6">
        <Checkbox name="enabled" label={t.navForm.enabled} defaultChecked={initial.enabled} />
        <Checkbox name="external" label={t.navForm.external} defaultChecked={initial.external} />
      </div>

      {ADMIN_LOCALES.map((locale) => (
        <LocaleSection
          key={locale}
          title={`${getContentLocaleLabel(t, locale)}${t.navForm.labelSection}`}
          open={locale === 'zh'}
        >
          <Field label={t.navForm.label} htmlFor={`${locale}_label-${key}`}>
            <TextInput
              id={`${locale}_label-${key}`}
              name={`${locale}_label`}
              defaultValue={initial.translations[locale].label}
            />
          </Field>
        </LocaleSection>
      ))}

      <SubmitButton pendingText={t.common.saving}>{submitLabel}</SubmitButton>
    </form>
  );
}
