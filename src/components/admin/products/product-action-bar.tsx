'use client';

import { useActionState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { setProductPublishedAction } from '@/lib/admin/actions/products';
import { initialFormState } from '@/lib/admin/action-state';
import { Alert } from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';
import { cn } from '@/lib/cn';
import { useActiveTab } from './tabs';
import type { ProductEditorData } from './types';

/**
 * 商品编辑器的操作栏（吸顶）。
 *
 * 三个动作始终可见，不用滚到页面底部去找：
 *   - 保存草稿：`type="submit" form="product-form-<当前分页>"`，提交当前分页的表单。
 *     用 HTML 的 form 关联属性而不是把六个表单合成一个 —— 每个分区分开保存，
 *     互不覆盖（合并后会出现在价格页点保存却把多语言清空这类问题）。
 *   - 发布 / 取消发布：服务端会校验 slug、至少一种语言有名称、以及封面图。
 *   - 在前台查看：新窗口打开商品详情页。
 *
 * 未保存提示由 ProductTabs 的 beforeunload 与新窗口打开前的提示负责。
 */
export function ProductActionBar({ data }: { data: ProductEditorData }) {
  const t = useAdminT();
  const router = useRouter();
  const active = useActiveTab();
  const product = data.product;

  const [state, formAction] = useActionState(setProductPublishedAction, initialFormState);

  // 发布状态变化会同时影响顶部的徽标与前台，因此重新读取服务端数据
  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);

  return (
    <div className="sticky top-0 z-20 -mx-5 border-b border-navy-200 bg-ivory-50/95 px-5 py-3 backdrop-blur lg:-mx-8 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs',
            product.published ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
          )}
        >
          {product.published ? t.products.statusPublished : t.products.statusDraft}
        </span>

        <p className="hidden text-xs text-muted xl:block">{t.products.saveBarHint}</p>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="submit"
            form={active ? `product-form-${active}` : undefined}
            className="inline-flex h-10 items-center rounded-full bg-navy-900 px-5 text-sm font-medium text-ivory-50 transition-colors hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
          >
            {t.products.saveDraft}
          </button>

          <form action={formAction}>
            <input type="hidden" name="id" value={product.id} />
            <input type="hidden" name="target" value={product.published ? 'draft' : 'publish'} />
            <button
              type="submit"
              className={cn(
                'inline-flex h-10 items-center rounded-full px-5 text-sm font-medium transition-colors',
                product.published
                  ? 'border border-navy-300 text-navy-800 hover:bg-navy-50'
                  : 'bg-copper-700 text-ivory-50 hover:bg-copper-800',
              )}
            >
              {product.published ? t.products.unpublish : t.products.publish}
            </button>
          </form>

          <Link
            href={data.previewHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center rounded-full border border-navy-300 px-5 text-sm font-medium text-navy-800 transition-colors hover:bg-navy-50"
          >
            {t.products.preview} ↗
          </Link>
        </div>
      </div>

      {state.status === 'error' && state.message ? (
        <div className="mt-3">
          <Alert kind="error">{state.message}</Alert>
        </div>
      ) : null}
      {state.status === 'success' && state.message ? (
        <div className="mt-3">
          <Alert kind="success">{state.message}</Alert>
        </div>
      ) : null}
    </div>
  );
}
