'use client';

import type { Locale } from '@/lib/i18n';
import { getCatalogDict } from '@/lib/i18n/catalog';
import { cn } from '@/lib/cn';
import type { ProductSort } from '@/lib/catalog';
import { catalogPath } from './urls';

/**
 * 排序控件。
 *
 * 用真实 `<form method="get">`：排序结果反映在地址栏，刷新与复制链接都不会丢失状态。
 * 有 JavaScript 时改变选项即时提交；没有 JavaScript 时 `<noscript>` 里的
 * 「应用」按钮照常可用 —— 两条路径都不会缺功能。
 */
export function SortSelect({
  locale,
  action,
  value,
  query,
  category,
  className,
}: {
  locale: Locale;
  /** 提交地址（GET），默认当前语言的目录页 */
  action?: string;
  value: ProductSort;
  query?: string;
  category?: string;
  className?: string;
}) {
  const dict = getCatalogDict(locale);

  const options: { value: ProductSort; label: string }[] = [
    { value: 'recommended', label: dict.list.sortRecommended },
    { value: 'newest', label: dict.list.sortNewest },
    { value: 'price-asc', label: dict.list.sortPriceAsc },
    { value: 'price-desc', label: dict.list.sortPriceDesc },
  ];

  const selectId = `catalog-sort-${action ? action.replace(/\W+/g, '-') : 'default'}`;

  return (
    <form
      action={action ?? catalogPath(locale)}
      method="get"
      className={cn('flex items-center gap-2', className)}
    >
      {query ? <input type="hidden" name="q" value={query} /> : null}
      {category ? <input type="hidden" name="category" value={category} /> : null}

      <label htmlFor={selectId} className="shrink-0 text-sm text-navy-600">
        {dict.list.sortLabel}
      </label>
      <select
        id={selectId}
        name="sort"
        defaultValue={value}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="h-11 min-w-0 border border-navy-200 bg-transparent px-4 pr-8 text-sm text-navy-900 focus:border-copper-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <noscript>
        <button
          type="submit"
          className="h-10 rounded-full border border-navy-300 px-4 text-sm font-medium text-navy-800 transition-colors hover:bg-navy-50"
        >
          {dict.list.searchButton}
        </button>
      </noscript>
    </form>
  );
}
