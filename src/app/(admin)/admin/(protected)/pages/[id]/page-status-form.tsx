'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { setPageStatusAction } from '@/lib/admin/actions/pages';
import { initialFormState } from '@/lib/admin/action-state';
import { Alert } from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';

function StatusButton({
  value,
  children,
  tone,
  pendingText,
}: {
  value: 'PUBLISHED' | 'DRAFT';
  children: React.ReactNode;
  tone: 'primary' | 'secondary';
  pendingText: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="status"
      value={value}
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

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-navy-700">
          {t.pageStatus.currentStatus}{' '}
          <span className={status === 'PUBLISHED' ? 'text-emerald-700' : 'text-amber-700'}>
            {status === 'PUBLISHED' ? t.pageStatus.published : t.pageStatus.draft}
          </span>
        </span>
        {status === 'PUBLISHED' ? (
          <StatusButton value="DRAFT" tone="secondary" pendingText={t.common.processing}>
            {t.pageStatus.moveToDraft}
          </StatusButton>
        ) : (
          <StatusButton value="PUBLISHED" tone="primary" pendingText={t.common.processing}>
            {t.pageStatus.publish}
          </StatusButton>
        )}
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
