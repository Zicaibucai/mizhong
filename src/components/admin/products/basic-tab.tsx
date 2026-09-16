'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import {
  deleteProductAction,
  duplicateProductAction,
  saveProductBasicAction,
} from '@/lib/admin/actions/products';
import { initialFormState } from '@/lib/admin/action-state';
import { Alert, Checkbox, Field, Select, SubmitButton, TextInput } from '@/components/admin/form';
import { DeleteForm } from '@/components/admin/delete-form';
import { useAdminT } from '@/components/admin/i18n-provider';
import { useDirtyForm } from './tabs';
import type { ProductEditorData } from './types';

/**
 * 基本资料：名称 / Slug / SKU / 分类 / 精选 / 排序。
 *
 * 封面图与悬停视频在「图片视频」页，「价格与贸易信息」在价格页，
 * 发布与预览在编辑器顶部的操作栏 —— 每一块都只有一个地方可以改，不存在两处不一致的可能。
 * 表单 id 固定为 `product-form-basic`，供顶部操作栏的「保存草稿」按 id 提交。
 */
export function BasicTab({ data }: { data: ProductEditorData }) {
  const t = useAdminT();
  const { product, categories } = data;

  const [state, formAction] = useActionState(saveProductBasicAction, initialFormState);
  const dirty = useDirtyForm('basic', state);

  const [duplicateState, duplicateAction] = useActionState(
    duplicateProductAction,
    initialFormState,
  );

  return (
    <div className="space-y-5">
      <form
        id="product-form-basic"
        action={formAction}
        onChange={dirty.markDirty}
        className="space-y-5"
      >
        <section className="space-y-4 rounded-xl border border-navy-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-navy-900">{t.products.basicSection}</h2>

          <input type="hidden" name="id" value={product.id} />

          {state.status === 'error' && state.message ? (
            <Alert kind="error">{state.message}</Alert>
          ) : null}
          {state.status === 'success' && state.message ? (
            <Alert kind="success">{state.message}</Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.products.slug} htmlFor="slug" hint={t.products.slugHint}>
              <TextInput id="slug" name="slug" defaultValue={product.slug} required />
            </Field>
            <Field label={t.products.sku} htmlFor="sku" hint={t.products.skuHint}>
              <TextInput id="sku" name="sku" defaultValue={product.sku} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.products.category} htmlFor="categoryId">
              <Select
                id="categoryId"
                name="categoryId"
                defaultValue={product.categoryId ?? ''}
                options={[
                  { value: '', label: t.products.noCategory },
                  ...categories.map((category) => ({
                    value: category.id,
                    label: category.name,
                  })),
                ]}
              />
            </Field>
            <Field
              label={t.products.sortOrder}
              htmlFor="sortOrder"
              hint={t.products.sortOrderHint}
            >
              <TextInput
                id="sortOrder"
                name="sortOrder"
                type="number"
                defaultValue={String(product.sortOrder)}
              />
            </Field>
          </div>

          <div>
            <Checkbox
              name="featured"
              id="featured"
              label={t.products.featured}
              defaultChecked={product.featured}
            />
            <p className="mt-1 text-xs text-muted">{t.products.featuredHint}</p>
          </div>

          <div className="flex justify-end">
            <SubmitButton pendingText={t.common.saving}>{t.products.saveDraft}</SubmitButton>
          </div>
        </section>
      </form>

      <section className="space-y-4 rounded-xl border border-navy-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <form action={duplicateAction}>
            <input type="hidden" name="id" value={product.id} />
            <SubmitButton variant="secondary" pendingText={t.common.processing}>
              {t.products.duplicate}
            </SubmitButton>
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

        {duplicateState.status === 'error' && duplicateState.message ? (
          <Alert kind="error">{duplicateState.message}</Alert>
        ) : null}
        {duplicateState.status === 'success' && duplicateState.message ? (
          <Alert kind="success">{duplicateState.message}</Alert>
        ) : null}

        <div className="border-t border-navy-100 pt-4">
          <DeleteForm
            action={deleteProductAction}
            id={product.id}
            label={t.products.delete}
            confirmText={t.products.deleteConfirm}
          />
        </div>
      </section>
    </div>
  );
}
