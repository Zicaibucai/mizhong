'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { duplicateProductAction } from '@/lib/admin/actions/products';
import { initialFormState, type FormState } from '@/lib/admin/action-state';
import { formatMessage } from '@/lib/admin/i18n';
import { Alert, SubmitButton } from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';

/**
 * 「复制商品」入口。
 *
 * 两步确认（点复制 → 出现确认按钮），确认语里**写出原商品名**，
 * 避免在列表里点错行却复制了另一个商品。
 *
 * 复制用的是既有的 `duplicateProductAction`，本组件只负责确认与跳转：
 * 复制成功后直接打开新商品的编辑器 —— 复制本来就是为了接着改，
 * 停在原商品上再让用户自己去列表里找副本是多余的一步。
 */
/** 复制动作的返回：标准 FormState + 新商品 id */
type DuplicateState = FormState & { duplicateId?: string };

export function DuplicateProductButton({
  productId,
  productName,
}: {
  productId: string;
  /** 原商品名称，显示在确认语里 */
  productName: string;
}) {
  const t = useAdminT();
  const router = useRouter();
  // 这个 action 除了标准的 FormState 还会带回新商品的 id（用于跳转），
// 初始状态因此要显式标注类型，否则 useActionState 只会推断出 FormState。
  const [state, formAction] = useActionState(duplicateProductAction, initialFormState as DuplicateState);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  // 复制成功后跳到新商品。用 startTransition + router.push，
  // 让列表缓存一起失效（revalidatePublicCatalogue 已在服务端调用）。
  useEffect(() => {
    if (state.status !== 'success' || !state.duplicateId) return;
    const id = state.duplicateId;
    startTransition(() => {
      router.push(`/admin/products/${id}`);
      router.refresh();
    });
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="id" value={productId} />

      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-navy-700">
            {formatMessage(t.products.duplicateConfirmNamed, { name: productName })}
          </span>
          <SubmitButton pendingText={t.common.processing}>{t.products.duplicate}</SubmitButton>
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
          disabled={pending}
          className="inline-flex h-9 items-center rounded-full border border-navy-300 px-4 text-sm font-medium text-navy-800 transition-colors hover:bg-navy-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500 disabled:opacity-50"
        >
          {t.products.duplicate}
        </button>
      )}

      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}
    </form>
  );
}
