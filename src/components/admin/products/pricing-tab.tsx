'use client';

import { useActionState, useState } from 'react';
import { saveProductPricingAction } from '@/lib/admin/actions/products';
import { initialFormState } from '@/lib/admin/action-state';
import { CURRENCY_CODES, TRADE_UNITS, type PriceMode } from '@/lib/pricing';
import { Alert, Field, Select, SubmitButton, TextInput } from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';
import { useDirtyForm } from './tabs';
import type { ProductEditorData } from './types';

/** 计价单位 / 起订单位的候选项：用 <datalist> 提供建议，同时允许自由输入 */
function UnitInput({
  id,
  name,
  defaultValue,
  listId,
}: {
  id: string;
  name: string;
  defaultValue: string;
  listId: string;
}) {
  return (
    <>
      <input
        id={id}
        name={name}
        defaultValue={defaultValue}
        list={listId}
        autoComplete="off"
        className="block w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-navy-300 focus:border-copper-500 focus:outline-none focus:ring-2 focus:ring-copper-500/30"
      />
      <datalist id={listId}>
        {TRADE_UNITS.map((unit) => (
          <option key={unit} value={unit} />
        ))}
      </datalist>
    </>
  );
}

/**
 * 价格与贸易信息。
 *
 * 价格模式决定显示哪些输入框：
 *   - 面议（NEGOTIABLE）：不显示任何价格输入，前台显示「面议」
 *   - 固定价格（FIXED）：只显示最低价格
 *   - 价格区间（RANGE）：显示最低价格与最高价格，服务端校验 最高价 ≥ 最低价
 *
 * 付款币种、计价单位与起订量三种模式共用。货币与单位在服务端会被重新校验，
 * 客户端的条件渲染只是体验层。
 */
export function PricingTab({ data }: { data: ProductEditorData }) {
  const t = useAdminT();
  const [state, formAction] = useActionState(saveProductPricingAction, initialFormState);
  const dirty = useDirtyForm('pricing', state);
  const [mode, setMode] = useState<PriceMode>(data.product.priceMode);

  const currencyOptions = CURRENCY_CODES.map((code) => ({ value: code, label: code }));

  return (
    <form
      id="product-form-pricing"
      action={formAction}
      onChange={dirty.markDirty}
      className="space-y-5"
    >
      <input type="hidden" name="id" value={data.product.id} />

      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}
      {state.status === 'success' && state.message ? (
        <Alert kind="success">{state.message}</Alert>
      ) : null}

      <section className="space-y-4 rounded-xl border border-navy-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-semibold text-navy-900">{t.products.pricingSection}</h2>
          <p className="mt-1 text-xs text-muted">{t.products.pricingHint}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.products.priceMode} htmlFor="priceMode" hint={t.products.priceModeHint}>
            <select
              id="priceMode"
              name="priceMode"
              value={mode}
              onChange={(event) => setMode(event.target.value as PriceMode)}
              className="block w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 focus:border-copper-500 focus:outline-none focus:ring-2 focus:ring-copper-500/30"
            >
              <option value="NEGOTIABLE">{t.products.priceModeNegotiable}</option>
              <option value="FIXED">{t.products.priceModeFixed}</option>
              <option value="RANGE">{t.products.priceModeRange}</option>
            </select>
          </Field>

          <Field label={t.products.currency} htmlFor="currency">
            <Select
              id="currency"
              name="currency"
              defaultValue={data.product.currency}
              options={currencyOptions}
            />
          </Field>
        </div>

        {mode === 'NEGOTIABLE' ? (
          <p className="rounded-lg border border-navy-200 bg-navy-50 px-4 py-3 text-sm text-navy-700">
            {t.products.priceNegotiableNote}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.products.priceMin} htmlFor="priceMin">
              <TextInput
                id="priceMin"
                name="priceMin"
                type="text"
                defaultValue={data.product.priceMin}
                placeholder="0.00"
              />
            </Field>
            {mode === 'RANGE' ? (
              <Field label={t.products.priceMax} htmlFor="priceMax">
                <TextInput
                  id="priceMax"
                  name="priceMax"
                  type="text"
                  defaultValue={data.product.priceMax}
                  placeholder="0.00"
                />
              </Field>
            ) : null}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.products.priceUnit} htmlFor="priceUnit" hint={t.products.priceUnitHint}>
            <UnitInput
              id="priceUnit"
              name="priceUnit"
              defaultValue={data.product.priceUnit}
              listId="price-unit-options"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.products.moq} htmlFor="moq" hint={t.products.moqHint}>
            <TextInput
              id="moq"
              name="moq"
              type="number"
              defaultValue={data.product.moq}
              placeholder="1000"
            />
          </Field>
          <Field label={t.products.moqUnit} htmlFor="moqUnit">
            <UnitInput
              id="moqUnit"
              name="moqUnit"
              defaultValue={data.product.moqUnit}
              listId="moq-unit-options"
            />
          </Field>
        </div>
      </section>

      <div className="flex justify-end">
        <SubmitButton pendingText={t.common.saving}>{t.products.saveDraft}</SubmitButton>
      </div>
    </form>
  );
}
