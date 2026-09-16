'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { deleteProductCategoryAction } from '@/lib/admin/actions/product-categories';
import { initialFormState } from '@/lib/admin/action-state';
import { Alert, Field, Select } from '@/components/admin/form';
import { DeleteForm } from '@/components/admin/delete-form';
import { useAdminT } from '@/components/admin/i18n-provider';
import { cn } from '@/lib/cn';

function SubmitAction({
  name,
  value,
  children,
  pendingText,
  variant,
}: {
  name: string;
  value: string;
  children: React.ReactNode;
  pendingText: string;
  variant: 'primary' | 'danger';
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={cn(
        'inline-flex h-10 items-center rounded-full px-5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'primary'
          ? 'bg-navy-900 text-ivory-50 hover:bg-navy-800'
          : 'border border-red-300 text-red-700 hover:bg-red-50',
      )}
    >
      {pending ? pendingText : children}
    </button>
  );
}

/**
 * Deletion guard for a category that still holds products.
 *
 * Nothing is deleted until the admin either moves those products to another category or clears
 * their category — and products are never removed as a side effect of deleting a category.
 */
export function CategoryDeleteForm({
  id,
  products,
  targets,
}: {
  id: string;
  products: { id: string; name: string }[];
  targets: { id: string; name: string }[];
}) {
  const t = useAdminT();
  const [state, formAction] = useActionState(deleteProductCategoryAction, initialFormState);
  const [moveOpen, setMoveOpen] = useState(false);

  if (products.length === 0) {
    return (
      <DeleteForm
        action={deleteProductCategoryAction}
        id={id}
        label={t.common.delete}
        confirmText={t.productCategories.deleteConfirm}
      />
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={id} />

      <Alert kind="info">
        <p className="font-medium">{t.productCategories.hasProductsTitle}</p>
        <p className="mt-1">{t.productCategories.hasProductsBody}</p>
        <ul className="mt-2 list-inside list-disc">
          {products.map((product) => (
            <li key={product.id}>{product.name}</li>
          ))}
        </ul>
      </Alert>

      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}
      {state.status === 'success' && state.message ? (
        <Alert kind="success">{state.message}</Alert>
      ) : null}

      {targets.length > 0 ? (
        <div className="space-y-3 border-t border-navy-100 pt-4">
          {moveOpen ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-full sm:w-64">
                <Field label={t.productCategories.reassignTo} htmlFor={`reassign-${id}`}>
                  <Select
                    id={`reassign-${id}`}
                    name="reassignTo"
                    options={targets.map((target) => ({ value: target.id, label: target.name }))}
                  />
                </Field>
              </div>
              <SubmitAction
                name="action"
                value="reassign"
                variant="primary"
                pendingText={t.common.processing}
              >
                {t.productCategories.reassignButton}
              </SubmitAction>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setMoveOpen(true)}
              className="inline-flex h-10 items-center rounded-full border border-navy-300 px-5 text-sm font-medium text-navy-800 transition-colors hover:bg-navy-50"
            >
              {t.productCategories.reassignTo}
            </button>
          )}
        </div>
      ) : null}

      <div className="border-t border-navy-100 pt-4">
        <SubmitAction
          name="action"
          value="clear"
          variant="danger"
          pendingText={t.common.processing}
        >
          {t.productCategories.clearCategory}
        </SubmitAction>
      </div>
    </form>
  );
}
