'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveBlockAction, savePageAction, translatePageAction } from '@/lib/admin/actions/pages';
import { initialFormState } from '@/lib/admin/action-state';
import { Alert } from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';

/**
 * 页面的「一键翻译」。
 *
 * 与商品那个按钮的区别在于**先保存、再翻译**。
 *
 * 商品的编辑器是每几秒自动保存一次的，所以按钮直接扫 DOM 就能拿到最新中文。
 * 页面的表单是「页面信息 + 每个区块各一个」，浏览器一次只能提交一个，
 * 扫描也很麻烦（区块表单里字段名会重名）。所以这里改成：
 *
 *   1. 把页面上每个表单**逐个交给服务端保存**（await 到每一个都完成）；
 *   2. 再让服务端按草稿里刚刚保存的最新中文去翻译。
 *
 * 结果是一样的 —— 翻译的一定是你在输入框里看到的那份中文 ——
 * 只是中间多了一次明确的保存。多出来的这个好处是：翻译失败时你的编辑已经存好了，
 * 不会白打一遍。
 */
export interface PageFormRef {
  /** 表单的 DOM id */
  id: string;
  /** 该表单该交给哪个保存动作 */
  kind: 'page' | 'block';
}

export function PageTranslateButton({
  pageId,
  forms,
  targetCount,
}: {
  pageId: string;
  /** 页面上全部表单，按顺序逐个保存 */
  forms: PageFormRef[];
  targetCount: number;
}) {
  const t = useAdminT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);

  const run = () => {
    setNotice(null);

    startTransition(async () => {
      // 第一步：逐个保存。任何一次失败都停下来 —— 带着半份草稿去翻译，
      // 只会翻出一个你并没打算发布的中间状态。
      for (const form of forms) {
        const element = document.getElementById(form.id);
        if (!(element instanceof HTMLFormElement)) continue;

        const formData = new FormData(element);
        const action = form.kind === 'page' ? savePageAction : saveBlockAction;

        let saved: Awaited<ReturnType<typeof savePageAction>>;
        try {
          saved = await action(initialFormState, formData);
        } catch {
          setNotice({ kind: 'error', text: t.actions.networkFailed });
          return;
        }

        if (saved.status === 'error') {
          setNotice({ kind: 'error', text: saved.message ?? t.actions.saveFailed });
          return;
        }
      }

      // 第二步：翻译。服务端读的是刚刚保存进草稿的那份中文。
      let result: Awaited<ReturnType<typeof translatePageAction>>;
      try {
        result = await translatePageAction({ pageId });
      } catch {
        setNotice({ kind: 'error', text: t.actions.networkFailed });
        return;
      }

      router.refresh();

      if (!result.ok) {
        const detail = result.failures.map((item) => item.locale).join('、');
        setNotice({ kind: 'error', text: detail ? `${result.message}（${detail}）` : result.message });
        return;
      }
      setNotice({ kind: 'success', text: result.message });
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="inline-flex h-10 items-center rounded-full bg-copper-700 px-5 text-sm font-medium text-ivory-50 transition-colors hover:bg-copper-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? t.translation.translating : t.translation.button}
        </button>
        <span className="text-xs text-muted">
          {t.pageDetail.translateHint.replace('{count}', String(targetCount))}
        </span>
      </div>

      {notice ? <Alert kind={notice.kind}>{notice.text}</Alert> : null}
    </div>
  );
}
