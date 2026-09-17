'use client';

import { useEffect, useState } from 'react';

/**
 * 网址后缀的实时预览。
 *
 * 光写「Slug」没人知道那是什么，但把完整网址摊在眼前就一目了然了：
 * 客户打开这个商品时浏览器地址栏里会出现这一串。
 *
 * 监听 slug 输入框的 `input` 事件 —— 包括 SlugAutoFill 自动填入时派发的那个，
 * 所以自动生成的结果也会立刻反映在这里。
 */
export function SlugPreview({
  formId,
  slugFieldId,
  prefix,
  label,
}: {
  formId: string;
  slugFieldId: string;
  /** 显示在 slug 前面的固定部分，例如 `/zh/products/` */
  prefix: string;
  label: string;
}) {
  const [value, setValue] = useState('');

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!form) return;
    const input = form.querySelector<HTMLInputElement>(`#${CSS.escape(slugFieldId)}`);
    if (!input) return;

    const sync = () => setValue(input.value.trim());
    sync();
    input.addEventListener('input', sync);
    return () => input.removeEventListener('input', sync);
  }, [formId, slugFieldId]);

  return (
    <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-xs">
      <span className="text-navy-400">{label}</span>
      <code className="break-all font-mono text-navy-800">
        {prefix}
        {value || <span className="text-navy-300">…</span>}
      </code>
    </p>
  );
}
