'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveProductSpecificationsAction } from '@/lib/admin/actions/products';
import { initialFormState } from '@/lib/admin/action-state';
import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';
import { getContentLocaleLabel } from '@/lib/admin/labels';
import { Alert, SubmitButton } from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';
import { cn } from '@/lib/cn';
import { useDirtyForm } from './tabs';
import type { ProductEditorData, SpecRowData, SpecRowValues } from './types';

let rowSequence = 0;

function emptyValues(): Record<AdminLocale, SpecRowValues> {
  return {
    zh: { name: '', value: '' },
    en: { name: '', value: '' },
    vi: { name: '', value: '' },
  };
}

function newRow(): SpecRowData {
  rowSequence += 1;
  return { key: `new-${rowSequence}`, id: null, values: emptyValues() };
}

/**
 * 结构化参数编辑器。
 *
 * 每一行是一条参数，三种语言各有一组「名称 / 值」输入 —— 管理员可以任意增加、删除、
 * 编辑并用拖动（或上移 / 下移按钮）调整顺序，保存时整表提交，顺序即前台的展示顺序。
 *
 * 为什么用「整表提交」而不是每行一个表单：顺序是这张表的语义的一部分，
 * 逐行保存会让「删除中间一行」变成两次不一致的写入。
 */
export function SpecsTab({ data }: { data: ProductEditorData }) {
  const t = useAdminT();
  const router = useRouter();
  const [state, formAction] = useActionState(saveProductSpecificationsAction, initialFormState);
  const dirty = useDirtyForm('specs', state);
  const [rows, setRows] = useState<SpecRowData[]>(data.specifications);
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // 服务端数据变化（保存成功 / 刷新）后对齐，但绝不在编辑过程中覆盖用户输入
  const signature = data.specifications
    .map((row) => `${row.id ?? ''}:${JSON.stringify(row.values)}`)
    .join('|');
  const lastSignature = useRef(signature);
  useEffect(() => {
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    setRows(data.specifications);
  }, [signature, data.specifications]);

  const update = useCallback(
    (key: string, locale: AdminLocale, field: keyof SpecRowValues, value: string) => {
      setRows((current) =>
        current.map((row) =>
          row.key === key
            ? { ...row, values: { ...row.values, [locale]: { ...row.values[locale], [field]: value } } }
            : row,
        ),
      );
      dirty.markDirty();
    },
    [dirty],
  );

  const addRow = () => {
    setRows((current) => [...current, newRow()]);
    dirty.markDirty();
  };

  const removeRow = (key: string) => {
    setConfirmingKey(null);
    setRows((current) => current.filter((row) => row.key !== key));
    dirty.markDirty();
  };

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    setRows((current) => {
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
    dirty.markDirty();
  };

  const drop = (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      return;
    }
    setRows((current) => {
      const next = [...current];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setDragIndex(null);
    dirty.markDirty();
  };

  // 保存成功后从服务端重新读取，避免本地顺序与数据库不一致
  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);

  return (
    <form id="product-form-specs" action={formAction} onChange={dirty.markDirty} className="space-y-5">
      <input type="hidden" name="productId" value={data.product.id} />
      {/*
        动态行整表序列化：服务端会用 Zod 重新校验每一行。
        这里必须转成**服务端契约的形状**（name / value 两种语言映射），
        而不是直接 stringify 本组件的行状态 —— 后者字段名对不上时会被 Zod 静默剥掉，
        表现为「保存成功但一条参数都没写进去」。
      */}
      <input
        type="hidden"
        name="payload"
        readOnly
        value={JSON.stringify(
          rows.map((row) => ({
            id: row.id,
            name: {
              zh: row.values.zh.name,
              en: row.values.en.name,
              vi: row.values.vi.name,
            },
            value: {
              zh: row.values.zh.value,
              en: row.values.en.value,
              vi: row.values.vi.value,
            },
          })),
        )}
      />

      <section className="space-y-4 rounded-xl border border-navy-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-navy-900">{t.products.specsSection}</h2>
            <p className="mt-1 text-xs text-muted">{t.products.specsHint}</p>
          </div>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex h-9 items-center rounded-full border border-navy-300 px-4 text-sm font-medium text-navy-800 transition-colors hover:bg-navy-50"
          >
            + {t.products.specAddRow}
          </button>
        </div>

        {state.status === 'error' && state.message ? (
          <Alert kind="error">{state.message}</Alert>
        ) : null}
        {state.status === 'success' && state.message ? (
          <Alert kind="success">{state.message}</Alert>
        ) : null}

        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-navy-200 bg-white px-5 py-6 text-sm text-muted">
            {t.products.specEmpty}
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row, index) => (
              <li
                key={row.key}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  drop(index);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={cn(
                  'rounded-xl border border-navy-200 bg-white p-4',
                  dragIndex === index ? 'opacity-60' : null,
                )}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span aria-hidden className="cursor-grab select-none text-navy-300">
                    ⠿
                  </span>
                  <span className="font-mono text-xs text-navy-400">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-navy-700">
                    {row.values.zh.name || row.values.en.name || row.values.vi.name || '—'}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      className="rounded-full border border-navy-200 px-3 py-1.5 text-xs text-navy-700 transition-colors hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {t.products.specMoveUp}
                    </button>
                    <button
                      type="button"
                      disabled={index === rows.length - 1}
                      onClick={() => move(index, 1)}
                      className="rounded-full border border-navy-200 px-3 py-1.5 text-xs text-navy-700 transition-colors hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {t.products.specMoveDown}
                    </button>

                    {confirmingKey === row.key ? (
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => removeRow(row.key)}
                          className="rounded-full border border-red-200 px-3 py-1.5 text-xs text-red-700 transition-colors hover:bg-red-50"
                        >
                          {t.common.confirmDelete}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingKey(null)}
                          className="rounded-full px-2 py-1.5 text-xs text-navy-600 hover:bg-navy-100"
                        >
                          {t.common.cancel}
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingKey(row.key)}
                        className="rounded-full px-3 py-1.5 text-xs text-navy-600 transition-colors hover:bg-navy-100"
                      >
                        {t.products.specRemove}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  {ADMIN_LOCALES.map((locale) => (
                    <fieldset key={locale} className="rounded-lg border border-navy-100 p-3">
                      <legend className="px-1 text-xs font-medium text-navy-500">
                        {getContentLocaleLabel(t, locale)}
                      </legend>
                      <div className="space-y-2">
                        <input
                          aria-label={`${getContentLocaleLabel(t, locale)} · ${t.products.specName}`}
                          value={row.values[locale].name}
                          onChange={(event) => update(row.key, locale, 'name', event.target.value)}
                          placeholder={t.products.specNamePlaceholder}
                          className="block w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-navy-300 focus:border-copper-500 focus:outline-none focus:ring-2 focus:ring-copper-500/30"
                        />
                        <input
                          aria-label={`${getContentLocaleLabel(t, locale)} · ${t.products.specValue}`}
                          value={row.values[locale].value}
                          onChange={(event) => update(row.key, locale, 'value', event.target.value)}
                          placeholder={t.products.specValuePlaceholder}
                          className="block w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-navy-300 focus:border-copper-500 focus:outline-none focus:ring-2 focus:ring-copper-500/30"
                        />
                      </div>
                    </fieldset>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-end">
        <SubmitButton pendingText={t.common.saving}>{t.products.saveDraft}</SubmitButton>
      </div>
    </form>
  );
}
