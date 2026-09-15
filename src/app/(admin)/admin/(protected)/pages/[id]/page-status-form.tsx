'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { setPageStatusAction } from '@/lib/admin/actions/pages';
import { initialFormState } from '@/lib/admin/action-state';
import { Alert } from '@/components/admin/form';

function StatusButton({
  value,
  children,
  tone,
}: {
  value: 'PUBLISHED' | 'DRAFT';
  children: React.ReactNode;
  tone: 'primary' | 'secondary';
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
      {pending ? '处理中…' : children}
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
  const [state, formAction] = useActionState(setPageStatusAction, initialFormState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-navy-700">
          当前状态：
          <span className={status === 'PUBLISHED' ? 'text-emerald-700' : 'text-amber-700'}>
            {status === 'PUBLISHED' ? '已发布' : '草稿'}
          </span>
        </span>
        {status === 'PUBLISHED' ? (
          <StatusButton value="DRAFT" tone="secondary">
            转为草稿
          </StatusButton>
        ) : (
          <StatusButton value="PUBLISHED" tone="primary">
            发布
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
