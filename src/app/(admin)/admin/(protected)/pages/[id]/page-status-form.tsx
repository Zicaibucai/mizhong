'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { setPageStatusAction } from '@/lib/admin/actions/pages';
import { initialFormState } from '@/lib/admin/action-state';
import { Alert } from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';

/**
 * Submit button for the publish control.
 *
 * The status value travels in a hidden input rather than on the button: React's form-action
 * serialisation does not include the submitter button's name/value, so a `<button name="status"
 * value="PUBLISHED">` arrives without `status` and the action always failed validation.
 */
function StatusSubmit({
  tone,
  pendingText,
  children,
}: {
  tone: 'primary' | 'secondary';
  pendingText: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        tone === 'primary'
          ? 'inline-flex h-10 items-center rounded-full bg-copper-700 px-5 text-sm font-medium text-ivory-50 transition-colors hover:bg-copper-800 disabled:opacity-60'
          : 'inline-flex h-10 items-center rounded-full border border-navy-300 px-5 text-sm font-medium text-navy-800 transition-colors hover:bg-navy-50 disabled:opacity-60'
      }
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function PageStatusForm({
  id,
  status,
}: {
  id: string;
  status: 'DRAFT' | 'PUBLISHED';
}) {
  const t = useAdminT();
  const [state, formAction] = useActionState(setPageStatusAction, initialFormState);
  const published = status === 'PUBLISHED';

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={published ? 'DRAFT' : 'PUBLISHED'} />

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-navy-700">
          {t.pageStatus.currentStatus}{' '}
          <span className={published ? 'text-emerald-700' : 'text-amber-700'}>
            {published ? t.pageStatus.published : t.pageStatus.draft}
          </span>
        </span>
        <StatusSubmit tone={published ? 'secondary' : 'primary'} pendingText={t.common.processing}>
          {published ? t.pageStatus.moveToDraft : t.pageStatus.publish}
        </StatusSubmit>
      </div>

      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}
      {state.status === 'success' && state.message ? (
        <Alert kind="success">{state.message}</Alert>
      ) : null}
    </form>
  );
}
