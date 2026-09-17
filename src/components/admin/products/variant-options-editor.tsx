'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { saveProductVariantGroupsAction } from '@/lib/admin/actions/products';
import { initialFormState } from '@/lib/admin/action-state';
import type { AdminLocale } from '@/lib/admin/validation';
import { getContentLocaleLabel } from '@/lib/admin/labels';
import { Alert } from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';
import { AssetThumb } from './asset-picker';
import { useAutoSaveForm } from './tabs';
import type { ProductEditorData, VariantGroupData } from './types';

let sequence = 0;

function newId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence}`;
}

function emptyLocalizedText(): Record<AdminLocale, string> {
  return { zh: '', en: '', vi: '' };
}

function newOption(): VariantGroupData['options'][number] {
  return { id: newId('option'), assetId: null, values: emptyLocalizedText() };
}

function newGroup(): VariantGroupData {
  return {
    id: newId('group'),
    values: { zh: '型号', en: 'Model', vi: 'Mẫu mã' },
    options: [newOption()],
  };
}

function cloneGroups(groups: VariantGroupData[]): VariantGroupData[] {
  return groups.map((group) => ({
    id: group.id,
    values: { ...group.values },
    options: group.options.map((option) => ({
      id: option.id,
      assetId: option.assetId,
      values: { ...option.values },
    })),
  }));
}

/**
 * 1688-style model/colour editor: every option is an individual thumbnail card, while groups
 * and cards flow naturally onto additional rows. Technical dimensions remain in SpecsTab.
 */
export function VariantOptionsEditor({
  data,
  activeLocale,
  formId = 'product-form-visual-variants',
  statusTab = 'visual-variants',
}: {
  data: ProductEditorData;
  activeLocale: AdminLocale;
  formId?: string;
  statusTab?: string;
}) {
  const t = useAdminT();
  const [state, formAction, isPending] = useActionState(
    saveProductVariantGroupsAction,
    initialFormState,
  );
  const { scheduleSave, formProps } = useAutoSaveForm(
    statusTab,
    formId,
    state,
    isPending,
    formAction,
  );
  const [groups, setGroups] = useState<VariantGroupData[]>(() => cloneGroups(data.variantGroups));
  const lastSignature = useRef(JSON.stringify(data.variantGroups));

  const signature = JSON.stringify(data.variantGroups);
  useEffect(() => {
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    setGroups(cloneGroups(data.variantGroups));
  }, [data.variantGroups, signature]);

  const updateGroups = useCallback(
    (update: (current: VariantGroupData[]) => VariantGroupData[]) => {
      setGroups((current) => update(current));
      scheduleSave();
    },
    [scheduleSave],
  );

  const addGroup = () => {
    if (groups.length >= 10) return;
    updateGroups((current) => [...current, newGroup()]);
  };

  const removeGroup = (groupId: string) => {
    updateGroups((current) => current.filter((group) => group.id !== groupId));
  };

  const updateGroupLabel = (groupId: string, value: string) => {
    updateGroups((current) =>
      current.map((group) =>
        group.id === groupId
          ? { ...group, values: { ...group.values, [activeLocale]: value } }
          : group,
      ),
    );
  };

  const addOption = (groupId: string) => {
    updateGroups((current) =>
      current.map((group) =>
        group.id === groupId && group.options.length < 100
          ? { ...group, options: [...group.options, newOption()] }
          : group,
      ),
    );
  };

  const removeOption = (groupId: string, optionId: string) => {
    updateGroups((current) =>
      current.map((group) =>
        group.id === groupId
          ? { ...group, options: group.options.filter((option) => option.id !== optionId) }
          : group,
      ),
    );
  };

  const updateOption = (
    groupId: string,
    optionId: string,
    patch: { label?: string; assetId?: string | null },
  ) => {
    updateGroups((current) =>
      current.map((group) =>
        group.id === groupId
          ? {
              ...group,
              options: group.options.map((option) =>
                option.id === optionId
                  ? {
                      ...option,
                      assetId:
                        patch.assetId === undefined ? option.assetId : patch.assetId,
                      values:
                        patch.label === undefined
                          ? option.values
                          : { ...option.values, [activeLocale]: patch.label },
                    }
                  : option,
              ),
            }
          : group,
      ),
    );
  };

  return (
    <form id={formId} {...formProps} className="contents">
      <input type="hidden" name="productId" value={data.product.id} />
      <input type="hidden" name="payload" readOnly value={JSON.stringify(groups)} />

      <section className="order-3 space-y-5 rounded-2xl border border-navy-200 bg-white p-4 sm:p-5 lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-copper-700">
              {t.products.variantsSection}
            </p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-navy-950">
              {t.products.variantsTitle}
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
              {t.products.variantsHint}
            </p>
          </div>
          <button
            type="button"
            onClick={addGroup}
            disabled={groups.length >= 10}
            className="inline-flex h-10 items-center rounded-full bg-navy-900 px-5 text-sm font-medium text-ivory-50 transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + {t.products.variantAddGroup}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-copper-100 bg-copper-50/60 px-4 py-3 text-xs text-copper-900">
          <span>{t.products.variantsLanguageHint}</span>
          <span className="font-medium">{getContentLocaleLabel(t, activeLocale)}</span>
        </div>

        {state.status === 'error' && state.message ? <Alert kind="error">{state.message}</Alert> : null}
        {state.status === 'success' && state.message ? <Alert kind="success">{state.message}</Alert> : null}

        {groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-navy-300 bg-navy-50/40 px-5 py-10 text-center text-sm text-muted">
            <p>{t.products.variantEmpty}</p>
            <button type="button" onClick={addGroup} className="mt-3 font-medium text-copper-700 hover:underline">
              + {t.products.variantAddGroup}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <fieldset key={group.id} className="rounded-xl border border-navy-200 bg-navy-50/25 p-4">
                <legend className="sr-only">{group.values[activeLocale] || t.products.variantGroupLabel}</legend>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <label className="min-w-[220px] flex-1 text-sm font-medium text-navy-800">
                    <span className="mb-1.5 block text-xs text-muted">{t.products.variantGroupLabel}</span>
                    <input
                      value={group.values[activeLocale]}
                      onChange={(event) => updateGroupLabel(group.id, event.target.value)}
                      placeholder={t.products.variantGroupPlaceholder}
                      className="block h-10 w-full rounded-lg border border-navy-200 bg-white px-3 text-sm font-semibold text-navy-900 placeholder:font-normal placeholder:text-navy-300 focus:border-copper-500 focus:outline-none focus:ring-2 focus:ring-copper-500/20"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeGroup(group.id)}
                    className="h-10 rounded-full border border-navy-200 px-4 text-xs font-medium text-navy-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                  >
                    {t.products.variantRemoveGroup}
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-start gap-3">
                  {group.options.map((option) => {
                    const asset = data.coverAssets.find((candidate) => candidate.id === option.assetId) ?? null;
                    return (
                      <div
                        key={option.id}
                        className="w-full min-w-0 rounded-xl border border-navy-200 bg-white p-2.5 shadow-sm sm:w-[260px]"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-navy-100 bg-navy-50 text-[10px] text-muted">
                            {asset ? (
                              <AssetThumb asset={asset} imgClassName="h-full w-full object-cover" />
                            ) : (
                              <span className="px-1 text-center">{t.products.variantNoImage}</span>
                            )}
                          </div>
                          <input
                            value={option.values[activeLocale]}
                            onChange={(event) =>
                              updateOption(group.id, option.id, { label: event.target.value })
                            }
                            placeholder={t.products.variantOptionPlaceholder}
                            aria-label={t.products.variantOptionPlaceholder}
                            className="h-10 min-w-0 flex-1 rounded-lg border border-navy-200 bg-white px-3 text-sm text-navy-900 placeholder:text-navy-300 focus:border-copper-500 focus:outline-none focus:ring-2 focus:ring-copper-500/20"
                          />
                          <button
                            type="button"
                            onClick={() => removeOption(group.id, option.id)}
                            title={t.products.variantRemoveOption}
                            aria-label={t.products.variantRemoveOption}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg text-navy-400 hover:bg-red-50 hover:text-red-700"
                          >
                            ×
                          </button>
                        </div>
                        <label className="mt-2 block text-[11px] font-medium text-muted">
                          <span className="sr-only">{t.products.variantImage}</span>
                          <select
                            value={option.assetId ?? ''}
                            onChange={(event) =>
                              updateOption(group.id, option.id, {
                                assetId: event.target.value || null,
                              })
                            }
                            className="block h-9 w-full truncate rounded-lg border border-navy-200 bg-white px-2 text-xs text-navy-700 focus:border-copper-500 focus:outline-none focus:ring-2 focus:ring-copper-500/20"
                          >
                            <option value="">{t.products.variantNoImage}</option>
                            {data.coverAssets.map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => addOption(group.id)}
                    disabled={group.options.length >= 100}
                    className="flex h-[104px] w-full items-center justify-center rounded-xl border border-dashed border-navy-300 bg-white px-5 text-sm font-medium text-navy-700 transition-colors hover:border-copper-500 hover:bg-copper-50 disabled:cursor-not-allowed disabled:opacity-40 sm:w-[180px]"
                  >
                    + {t.products.variantAddOption}
                  </button>
                </div>

                {group.options.length === 0 ? (
                  <p className="mt-3 text-xs text-muted">{t.products.variantOptionEmpty}</p>
                ) : null}
              </fieldset>
            ))}
          </div>
        )}
      </section>
    </form>
  );
}
