'use client';

import { useActionState } from 'react';
import { setAssetEnabledAction } from '@/lib/admin/actions/media';
import { initialFormState } from '@/lib/admin/action-state';
import { Alert, SubmitButton } from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';

/** 启用 / 停用开关：点击后立即生效（停用的素材不会出现在前台） */
export function AssetStatusForm({ id, enabled }: { id: string; enabled: boolean }) {
  const t = useAdminT();
  const [state, formAction] = useActionState(setAssetEnabledAction, initialFormState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {/* 提交的是「翻转后的状态」 */}
      <input type="hidden" name="enabled" value={enabled ? '0' : '1'} />

      <p className="text-sm text-muted">{t.media.enabledHint}</p>

      <div className="flex flex-wrap items-center gap-3">
        <span
          className={
            enabled
              ? 'rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700'
              : 'rounded-full bg-navy-100 px-2.5 py-0.5 text-xs text-navy-600'
          }
        >
          {enabled ? t.media.enabled : t.media.disabled}
        </span>
        <SubmitButton variant="secondary" pendingText={t.common.processing}>
          {enabled ? t.media.disableButton : t.media.enableButton}
        </SubmitButton>
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
