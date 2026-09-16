'use client';

import { useActionState } from 'react';
import { bindAssetSlotAction, unbindAssetSlotAction } from '@/lib/admin/actions/media';
import { initialFormState } from '@/lib/admin/action-state';
import { Alert, Field, Select, SubmitButton } from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';

export interface AssetSlotBinding {
  id: string;
  slot: string;
}

/**
 * 槽位绑定：把素材绑定到站点的固定位置（替换该槽位 0 号位的素材），
 * 或解除已有绑定。
 */
export function AssetSlotSection({
  id,
  bindings,
  slotOptions,
}: {
  id: string;
  bindings: AssetSlotBinding[];
  slotOptions: { value: string; label: string }[];
}) {
  const t = useAdminT();
  const [bindState, bindAction] = useActionState(bindAssetSlotAction, initialFormState);
  const [unbindState, unbindAction] = useActionState(unbindAssetSlotAction, initialFormState);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t.media.slotsHint}</p>

      <div>
        <h3 className="mb-2 text-sm font-medium text-navy-800">{t.media.currentSlots}</h3>
        {bindings.length === 0 ? (
          <p className="text-sm text-muted">{t.media.noSlots}</p>
        ) : (
          <ul className="space-y-2">
            {bindings.map((binding) => (
              <li
                key={binding.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-navy-200 px-3 py-2"
              >
                <span className="rounded-full bg-copper-100 px-2.5 py-0.5 font-mono text-xs text-copper-800">
                  {binding.slot}
                </span>
                <form action={unbindAction} className="ml-auto">
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="bindingId" value={binding.id} />
                  <SubmitButton variant="danger" pendingText={t.common.processing}>
                    {t.media.unbind}
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        {unbindState.status === 'error' && unbindState.message ? (
          <div className="mt-2">
            <Alert kind="error">{unbindState.message}</Alert>
          </div>
        ) : null}
      </div>

      <form action={bindAction} className="space-y-4">
        <input type="hidden" name="id" value={id} />
        <Field label={t.media.bindSlot} htmlFor={`slot-${id}`}>
          <Select
            id={`slot-${id}`}
            name="slot"
            options={slotOptions}
            defaultValue={slotOptions[0]?.value}
          />
        </Field>

        {bindState.status === 'error' && bindState.message ? (
          <Alert kind="error">{bindState.message}</Alert>
        ) : null}
        {bindState.status === 'success' && bindState.message ? (
          <Alert kind="success">{bindState.message}</Alert>
        ) : null}

        <SubmitButton pendingText={t.common.processing}>{t.media.bindButton}</SubmitButton>
      </form>
    </div>
  );
}
