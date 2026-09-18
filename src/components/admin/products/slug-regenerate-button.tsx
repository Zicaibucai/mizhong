'use client';

import { useState, useTransition } from 'react';
import { generateSlugAction } from '@/lib/admin/actions/translation';
import { formatMessage } from '@/lib/admin/i18n';
import { useAdminT } from '@/components/admin/i18n-provider';

/**
 * 「根据英文名称重新生成」按钮。
 *
 * 与 `SlugAutoFill` 的分工：
 *   - `SlugAutoFill` 在**边打字边**给建议，而且一旦管理员手动改过 slug 就永久停手；
 *   - 这个按钮是**显式**的：管理员主动点，才会用当前的英文名重新生成一次。
 *
 * 也就是说「用户手动改过之后不再自动覆盖」与「用户想要时仍然能重新生成」
 * 这两件事各由一个入口负责，不会互相打架。
 *
 * 英文名为空时会请服务端先用 DeepSeek 生成一个英文名（见 generateSlugAction），
 * 并把生成的英文名一并回填到英文名称输入框里 —— 只生成 slug 而不告诉用户
 * 这个英文名是什么，会让人看不懂网址为什么长这样。
 */
export function SlugRegenerateButton({
  productId,
  formId,
  slugFieldId,
  nameFieldId,
}: {
  productId: string;
  /** slug 输入框所在的表单 */
  formId: string;
  slugFieldId: string;
  /** 英文名称输入框（优先用它生成） */
  nameFieldId: string;
}) {
  const t = useAdminT();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const run = () => {
    setMessage(null);
    setFailed(false);

    const form = document.getElementById(formId);
    const slugInput =
      form?.querySelector<HTMLInputElement>(`#${CSS.escape(slugFieldId)}`) ??
      document.querySelector<HTMLInputElement>(`#${CSS.escape(slugFieldId)}`);
    const nameInput = document.querySelector<HTMLInputElement>(`#${CSS.escape(nameFieldId)}`);
    const zhNameInput = document.querySelector<HTMLInputElement>('#visual-zh-name');
    if (!slugInput) return;

    startTransition(async () => {
      const result = await generateSlugAction({
        productId,
        englishName: nameInput?.value ?? '',
        chineseName: zhNameInput?.value ?? '',
      });

      if (result.status === 'error') {
        setFailed(true);
        setMessage(result.message);
        return;
      }

      slugInput.value = result.slug;
      // 让「网址预览」与自动保存都看到这次改动
      slugInput.dispatchEvent(new Event('input', { bubbles: true }));

      // 服务端顺带生成了英文名：回填到英文名称输入框，否则用户不知道网址从哪来
      if (result.generatedName && nameInput) {
        nameInput.value = result.generatedName;
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        setMessage(
          formatMessage(t.slug.generatedWithName, {
            name: result.generatedName,
            slug: result.slug,
          }),
        );
        return;
      }

      setMessage(formatMessage(t.slug.generated, { slug: result.slug }));
    });
  };

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex h-9 items-center rounded-full border border-navy-300 px-4 text-xs font-medium text-navy-800 transition-colors hover:border-copper-500 hover:bg-copper-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? t.slug.regenerating : t.slug.regenerate}
      </button>
      {message ? (
        <p className={failed ? 'text-xs text-copper-700' : 'text-xs text-muted'}>{message}</p>
      ) : null}
    </div>
  );
}
