'use client';

import { useActionState, useState } from 'react';
import { initialFormState, type FormState } from '@/lib/admin/action-state';
import { SubmitButton } from './form';

/**
 * 删除按钮：两段式二次确认（点击删除 → 出现确认按钮），不使用浏览器弹窗。
 */
export function DeleteForm({
  action,
  id,
  label = '删除',
  confirmText = '确认删除？此操作不可撤销。',
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  id: string;
  label?: string;
  confirmText?: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const [confirming, setConfirming] = useState(false);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="id" value={id} />
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-red-700">{confirmText}</span>
          <SubmitButton variant="danger" pendingText="删除中…">
            确认删除
          </SubmitButton>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-full px-3 py-1.5 text-sm text-navy-600 hover:bg-navy-100"
          >
            取消
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-full border border-red-200 px-4 py-1.5 text-sm text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
        >
          {label}
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
