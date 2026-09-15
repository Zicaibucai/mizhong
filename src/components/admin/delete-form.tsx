'use client';

import { useActionState, useState } from 'react';
import { initialFormState, type FormState } from '@/lib/admin/action-state';
import { SubmitButton } from './form';
import { useAdminT } from './i18n-provider';

/**
 * Delete button: two-step confirmation (click delete → a confirm button appears), with no browser dialog.
 */
export function DeleteForm({
  action,
  id,
  label,
  confirmText,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  id: string;
  label?: string;
  confirmText?: string;
}) {
  const t = useAdminT();
  const [state, formAction] = useActionState(action, initialFormState);
  const [confirming, setConfirming] = useState(false);

  const labelText = label ?? t.common.delete;
  const confirmMessage = confirmText ?? t.common.deleteConfirmDefault;

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="id" value={id} />
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-red-700">{confirmMessage}</span>
          <SubmitButton variant="danger" pendingText={t.common.deleting}>
            {t.common.confirmDelete}
          </SubmitButton>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-full px-3 py-1.5 text-sm text-navy-600 hover:bg-navy-100"
          >
            {t.common.cancel}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-full border border-red-200 px-4 py-1.5 text-sm text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
        >
          {labelText}
        </button>
      )}
      {state.status === 'error' && state.message ? (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      ) : null}
      {state.status === 'success' && state.message ? (
        <p className="text-sm text-emerald-700">{state.message}</p>
      ) : null}
    </form>
  );
}
