'use client';

import { useEffect } from 'react';
import { slugify } from '@/lib/slugify';

/**
 * 按英文名称自动建议 slug（纯增强，不接管表单状态）。
 *
 * 行为：
 *   - 只在 slug 输入框**还是空的**（或内容仍等于上一次自动填入的建议值）时才写入；
 *   - 管理员一旦手动改过 slug，就永久停止覆盖 —— 自动建议绝不能盖掉人工决定；
 *   - 名称清空时把建议值也收回，避免留下一个无意义的 slug。
 *
 * 用原生 DOM 事件而不是 React 受控状态：后台表单统一是非受控的（defaultValue + FormData），
 * 把 slug 改成受控组件会脱离这套约定，也会让「保存」路径多出一条状态分支。
 */
export function SlugAutoFill({
  formId,
  nameFieldId,
  slugFieldId,
}: {
  formId: string;
  nameFieldId: string;
  slugFieldId: string;
}) {
  useEffect(() => {
    const form = document.getElementById(formId);
    if (!form) return;
    const nameInput = form.querySelector<HTMLInputElement>(`#${CSS.escape(nameFieldId)}`);
    const slugInput = form.querySelector<HTMLInputElement>(`#${CSS.escape(slugFieldId)}`);
    if (!nameInput || !slugInput) return;

    // 已有 slug（编辑既有商品）时不自动改写，除非它本来就是空的
    let lastSuggested = slugInput.value;
    let armed = slugInput.value.trim().length === 0;

    const onSlugInput = () => {
      // 手动清空 → 重新武装：空 slug 本来就保存不了，此时按名称给建议是用户想要的
      if (slugInput.value.trim().length === 0) {
        armed = true;
        lastSuggested = '';
        return;
      }
      // 手动改成别的值 → 交还控制权
      if (slugInput.value !== lastSuggested) armed = false;
    };

    const onNameInput = () => {
      if (!armed) return;
      const next = slugify(nameInput.value);
      lastSuggested = next;
      slugInput.value = next;
    };

    slugInput.addEventListener('input', onSlugInput);
    nameInput.addEventListener('input', onNameInput);
    return () => {
      slugInput.removeEventListener('input', onSlugInput);
      nameInput.removeEventListener('input', onNameInput);
    };
  }, [formId, nameFieldId, slugFieldId]);

  return null;
}
