'use client';

import { useActionState, useMemo, useState } from 'react';
import { deleteAssetAction } from '@/lib/admin/actions/media';
import { initialFormState } from '@/lib/admin/action-state';
import { Alert, SubmitButton } from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';
import type { AssetReference } from '@/components/admin/media/asset-references';

/**
 * 删除素材：若素材正被商品 / 分类封面 / 槽位引用，先列出引用位置，
 * 并要求管理员再点一次「仍然删除」才会强制解绑后删除。
 */
export function AssetDeleteForm({
  id,
  references,
}: {
  id: string;
  references: AssetReference[];
}) {
  const t = useAdminT();
  const [state, formAction] = useActionState(deleteAssetAction, initialFormState);
  const [step, setStep] = useState<'idle' | 'confirm' | 'force'>('idle');
  const hasReferences = references.length > 0;

  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const reference of references) {
      const list = map.get(reference.group) ?? [];
      list.push(reference.label);
      map.set(reference.group, list);
    }
    return Array.from(map.entries());
  }, [references]);

  if (step === 'idle') {
    return (
      <div className="space-y-3">
        {state.status === 'error' && state.message ? (
          <Alert kind="error">{state.message}</Alert>
        ) : null}
        <button
          type="button"
          onClick={() => setStep(hasReferences ? 'force' : 'confirm')}
          className="rounded-full border border-red-200 px-4 py-1.5 text-sm text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
        >
          {t.common.delete}
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {/* 第二步确认后才会提交 force=1 */}
      <input type="hidden" name="force" value={step === 'force' ? '1' : '0'} />

      {hasReferences ? (
        <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium">{t.media.inUseTitle}</p>
          <p>{t.media.inUseBody}</p>
          <ul className="space-y-2">
            {groups.map(([group, labels]) => (
              <li key={group}>
                <span className="font-medium">{group}</span>
                <ul className="mt-1 list-disc pl-5">
                  {labels.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-red-700">{t.media.deleteConfirm}</p>
      )}

      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton variant="danger" pendingText={t.common.deleting}>
          {hasReferences ? t.media.inUseForce : t.common.confirmDelete}
        </SubmitButton>
        <button
          type="button"
          onClick={() => setStep('idle')}
          className="rounded-full px-3 py-1.5 text-sm text-navy-600 hover:bg-navy-100"
        >
          {t.common.cancel}
        </button>
      </div>
    </form>
  );
}
