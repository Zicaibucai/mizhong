'use client';

import { useActionState } from 'react';
import { saveContactAction } from '@/lib/admin/actions/contacts';
import { initialFormState } from '@/lib/admin/action-state';
import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';
import { getContactTypeOptions, getContentLocaleLabel } from '@/lib/admin/labels';
import {
  Alert,
  Checkbox,
  Field,
  LocaleSection,
  Select,
  SubmitButton,
  TextInput,
} from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';
import { localizedRecord } from '@/lib/i18n/localized';

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
  translations: localizedRecord(() => ({ label: '', value: '' })),
};

export function ContactForm({
  contact,
  submitLabel,
}: {
  contact?: ContactValues;
  submitLabel: string;
}) {
  const t = useAdminT();
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
        <Field label={t.contactForm.type} htmlFor={`type-${initial.id ?? 'new'}`}>
          <Select
            id={`type-${initial.id ?? 'new'}`}
            name="type"
            defaultValue={initial.type}
            options={getContactTypeOptions(t)}
          />
        </Field>
        <Field
          label={t.contactForm.displayOrder}
          htmlFor={`sortOrder-${initial.id ?? 'new'}`}
          hint={t.contactForm.displayOrderHint}
        >
          <TextInput
            id={`sortOrder-${initial.id ?? 'new'}`}
            name="sortOrder"
            type="number"
            defaultValue={String(initial.sortOrder)}
          />
        </Field>
      </div>

      <Field
        label={t.contactForm.sharedValue}
        htmlFor={`value-${initial.id ?? 'new'}`}
        hint={t.contactForm.sharedValueHint}
      >
        <TextInput id={`value-${initial.id ?? 'new'}`} name="value" defaultValue={initial.value} />
      </Field>

      <Field
        label={t.contactForm.customLink}
        htmlFor={`href-${initial.id ?? 'new'}`}
        hint={t.contactForm.customLinkHint}
      >
        <TextInput id={`href-${initial.id ?? 'new'}`} name="href" defaultValue={initial.href} />
      </Field>

      <Checkbox
        name="enabled"
        label={t.contactForm.enabled}
        defaultChecked={initial.enabled}
      />

      {ADMIN_LOCALES.map((locale) => (
        <LocaleSection
          key={locale}
          title={`${getContentLocaleLabel(t, locale)}${t.contactForm.displayTextSection}`}
          open={locale === 'zh'}
        >
          <Field
            label={t.contactForm.displayLabel}
            htmlFor={`${locale}_label-${initial.id ?? 'new'}`}
          >
            <TextInput
              id={`${locale}_label-${initial.id ?? 'new'}`}
              name={`${locale}_label`}
              defaultValue={initial.translations[locale].label}
            />
          </Field>
          <Field
            label={t.contactForm.valueForLocale}
            htmlFor={`${locale}_value-${initial.id ?? 'new'}`}
            hint={t.contactForm.valueForLocaleHint}
          >
            <TextInput
              id={`${locale}_value-${initial.id ?? 'new'}`}
              name={`${locale}_value`}
              defaultValue={initial.translations[locale].value}
            />
          </Field>
        </LocaleSection>
      ))}

      <SubmitButton pendingText={t.common.saving}>{submitLabel}</SubmitButton>
    </form>
  );
}
