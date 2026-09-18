'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { saveProductSpecificationsAction } from '@/lib/admin/actions/products';
import { initialFormState } from '@/lib/admin/action-state';
import type { AdminLocale } from '@/lib/admin/validation';
import { getContentLocaleLabel } from '@/lib/admin/labels';
import { Alert } from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';
import { cn } from '@/lib/cn';
import { defaultLocale } from '@/lib/i18n/config';
import { useAutoSaveForm } from './tabs';
import { localizedRecord } from '@/lib/i18n/localized';
import type { ProductEditorData, SpecTableData } from './types';

let sequence = 0;

function newId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence}`;
}

function emptyLocalizedText(): Record<AdminLocale, string> {
  return localizedRecord(() => '');
}

function newColumn(): SpecTableData['columns'][number] {
  return { id: newId('column'), values: emptyLocalizedText() };
}

function newRow(table: SpecTableData): SpecTableData['rows'][number] {
  return {
    id: newId('row'),
    cells: Object.fromEntries(table.columns.map((column) => [column.id, emptyLocalizedText()])),
  };
}

function cloneTable(table: SpecTableData): SpecTableData {
  return {
    columns: table.columns.map((column) => ({
      id: column.id,
      values: { ...column.values },
    })),
    rows: table.rows.map((row) => ({
      id: row.id,
      cells: Object.fromEntries(
        Object.entries(row.cells).map(([columnId, values]) => [columnId, { ...values }]),
      ),
    })),
  };
}

/**
 * 可视化规格/颜色表。
 *
 * 列是规格维度（例如规格/型号、颜色、包装），行是一组可询价的组合。
 * 结构和内容都按语言保存，但三种语言共用同一套行列，所以切换语言时布局不会变。
 */
export function SpecsTab({
  data,
  formId = 'product-form-specs',
  statusTab = 'specs',
  activeLocale = defaultLocale,
  layout = 'stacked',
}: {
  data: ProductEditorData;
  /** The visual editor also uses this component, so its form id must stay unique. */
  formId?: string;
  /** Status key reported to the shared product action bar. */
  statusTab?: string;
  /** The language selected in the visual editor header. */
  activeLocale?: AdminLocale;
  /** `grid` lets this form contribute a full-width card to the visual layout. */
  layout?: 'stacked' | 'grid';
}) {
  const t = useAdminT();
  const [state, formAction, isPending] = useActionState(saveProductSpecificationsAction, initialFormState);
  const { scheduleSave, formProps } = useAutoSaveForm(statusTab, formId, state, isPending, formAction);
  const [table, setTable] = useState<SpecTableData>(() => cloneTable(data.specTable));
  const lastSignature = useRef(JSON.stringify(data.specTable));

  // 服务端刷新后对齐；编辑过程中不被旧的 server props 覆盖。
  const signature = JSON.stringify(data.specTable);
  useEffect(() => {
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    setTable(cloneTable(data.specTable));
  }, [data.specTable, signature]);

  const updateTable = useCallback(
    (update: (current: SpecTableData) => SpecTableData) => {
      setTable((current) => update(current));
      scheduleSave();
    },
    [scheduleSave],
  );

  const updateColumn = (columnId: string, value: string) => {
    updateTable((current) => ({
      ...current,
      columns: current.columns.map((column) =>
        column.id === columnId
          ? { ...column, values: { ...column.values, [activeLocale]: value } }
          : column,
      ),
    }));
  };

  const updateCell = (rowId: string, columnId: string, value: string) => {
    updateTable((current) => ({
      ...current,
      rows: current.rows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              cells: {
                ...row.cells,
                [columnId]: { ...(row.cells[columnId] ?? emptyLocalizedText()), [activeLocale]: value },
              },
            }
          : row,
      ),
    }));
  };

  const addColumn = () => {
    updateTable((current) => {
      const column = newColumn();
      return {
        columns: [...current.columns, column],
        rows: current.rows.map((row) => ({
          ...row,
          cells: { ...row.cells, [column.id]: emptyLocalizedText() },
        })),
      };
    });
  };

  const removeColumn = (columnId: string) => {
    if (table.columns.length <= 1) return;
    updateTable((current) => ({
      columns: current.columns.filter((column) => column.id !== columnId),
      rows: current.rows.map((row) => {
        const cells = { ...row.cells };
        delete cells[columnId];
        return { ...row, cells };
      }),
    }));
  };

  const addRow = () => updateTable((current) => ({ ...current, rows: [...current.rows, newRow(current)] }));

  const removeRow = (rowId: string) => {
    updateTable((current) => ({ ...current, rows: current.rows.filter((row) => row.id !== rowId) }));
  };

  const moveRow = (rowIndex: number, direction: -1 | 1) => {
    const target = rowIndex + direction;
    if (target < 0 || target >= table.rows.length) return;
    updateTable((current) => {
      const rows = [...current.rows];
      const [moved] = rows.splice(rowIndex, 1);
      rows.splice(target, 0, moved);
      return { ...current, rows };
    });
  };

  const formClassName = layout === 'grid' ? 'contents' : 'space-y-5';

  return (
    <form id={formId} {...formProps} className={formClassName}>
      <input type="hidden" name="productId" value={data.product.id} />
      <input type="hidden" name="payload" readOnly value={JSON.stringify(table)} />

      <section className={cn('space-y-4 rounded-2xl border border-navy-200 bg-white p-4 sm:p-5', layout === 'grid' ? 'order-4 lg:col-span-2' : null)}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-copper-700">
              {t.products.specsSection}
            </p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-navy-950">
              {t.products.specTableTitle}
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
              {t.products.specTableHint}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="rounded-full bg-navy-50 px-3 py-1.5">
              {table.columns.length} {t.products.specColumnCount}
            </span>
            <span className="rounded-full bg-navy-50 px-3 py-1.5">
              {table.rows.length} {t.products.specRowCount}
            </span>
            <button
              type="button"
              onClick={addColumn}
              disabled={table.columns.length >= 20}
              className="inline-flex h-9 items-center rounded-full border border-navy-300 px-4 font-medium text-navy-800 transition-colors hover:border-copper-500 hover:bg-copper-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              + {t.products.specAddColumn}
            </button>
            <button
              type="button"
              onClick={addRow}
              disabled={table.rows.length >= 100}
              className="inline-flex h-9 items-center rounded-full bg-navy-900 px-4 font-medium text-ivory-50 transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              + {t.products.specAddRow}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-copper-100 bg-copper-50/60 px-4 py-3 text-xs text-copper-900">
          <span>{t.products.specTableLanguageHint}</span>
          <span className="font-medium">{getContentLocaleLabel(t, activeLocale)}</span>
        </div>

        {state.status === 'error' && state.message ? <Alert kind="error">{state.message}</Alert> : null}
        {state.status === 'success' && state.message ? <Alert kind="success">{state.message}</Alert> : null}

        <div className="overflow-x-auto rounded-xl border border-navy-200">
          <table className="min-w-[760px] w-full border-collapse text-left text-sm">
            <thead className="bg-navy-50/80">
              <tr className="border-b border-navy-200">
                <th scope="col" className="w-28 px-3 py-3 text-xs font-medium text-muted">
                  #
                </th>
                {table.columns.map((column) => (
                  <th key={column.id} scope="col" className="min-w-[190px] px-3 py-2 align-top">
                    <div className="flex items-center gap-2">
                      <input
                        value={column.values[activeLocale]}
                        onChange={(event) => updateColumn(column.id, event.target.value)}
                        placeholder={t.products.specColumnPlaceholder}
                        aria-label={`${t.products.specColumnLabel} ${getContentLocaleLabel(t, activeLocale)}`}
                        className="min-w-0 flex-1 rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm font-semibold text-navy-900 placeholder:font-normal placeholder:text-navy-300 focus:border-copper-500 focus:outline-none focus:ring-2 focus:ring-copper-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => removeColumn(column.id)}
                        disabled={table.columns.length <= 1}
                        aria-label={t.products.specDeleteColumn}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg leading-none text-navy-400 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ×
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100 bg-white">
              {table.rows.map((row, rowIndex) => (
                <tr key={row.id} className="align-top hover:bg-navy-50/40">
                  <th scope="row" className="px-3 py-3 font-normal text-muted">
                    <div className="flex flex-col items-start gap-2">
                      <span className="font-mono text-xs">{String(rowIndex + 1).padStart(2, '0')}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={rowIndex === 0}
                          onClick={() => moveRow(rowIndex, -1)}
                          aria-label={t.products.specMoveUp}
                          className="rounded border border-navy-200 px-1.5 py-1 text-xs text-navy-600 hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={rowIndex === table.rows.length - 1}
                          onClick={() => moveRow(rowIndex, 1)}
                          aria-label={t.products.specMoveDown}
                          className="rounded border border-navy-200 px-1.5 py-1 text-xs text-navy-600 hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          aria-label={t.products.specRemove}
                          className="rounded border border-transparent px-1.5 py-1 text-xs text-navy-500 hover:border-red-100 hover:bg-red-50 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </th>
                  {table.columns.map((column) => (
                    <td key={column.id} className="px-3 py-3">
                      <input
                        value={row.cells[column.id]?.[activeLocale] ?? ''}
                        onChange={(event) => updateCell(row.id, column.id, event.target.value)}
                        placeholder={t.products.specCellPlaceholder}
                        aria-label={`${column.values[activeLocale] || t.products.specColumnLabel} ${rowIndex + 1}`}
                        className="block w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy-900 placeholder:text-navy-300 focus:border-copper-500 focus:outline-none focus:ring-2 focus:ring-copper-500/20"
                      />
                    </td>
                  ))}
                </tr>
              ))}
              {table.rows.length === 0 ? (
                <tr>
                  <td colSpan={table.columns.length + 1} className="px-5 py-10 text-center text-sm text-muted">
                    <p>{t.products.specTableEmpty}</p>
                    <button type="button" onClick={addRow} className="mt-3 font-medium text-copper-700 hover:underline">
                      + {t.products.specAddRow}
                    </button>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <p className="text-xs leading-relaxed text-muted">{t.products.specTableFooterHint}</p>
      </section>
    </form>
  );
}
