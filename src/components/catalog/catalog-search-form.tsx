import { cn } from '@/lib/cn';

interface CatalogSearchFormProps {
  /** 表单提交地址（GET），例如 /zh/products */
  action: string;
  defaultQuery?: string;
  /** 存在时作为隐藏字段随搜索一起提交，保证在分类内搜索不会丢失分类 */
  category?: string;
  /** 存在时随搜索一起提交，保证搜索不会重置当前排序 */
  sort?: string;
  placeholder: string;
  buttonLabel: string;
  className?: string;
}

/**
 * 纯 HTML GET 表单：无客户端 JS 也能搜索，结果反映在地址栏中，可分享、可刷新。
 */
export function CatalogSearchForm({
  action,
  defaultQuery,
  category,
  sort,
  placeholder,
  buttonLabel,
  className,
}: CatalogSearchFormProps) {
  const inputId = `catalog-search-${action.replace(/\W+/g, '-')}`;

  return (
    <form action={action} method="get" role="search" className={cn('flex w-full gap-2', className)}>
      {category ? <input type="hidden" name="category" value={category} /> : null}
      {sort ? <input type="hidden" name="sort" value={sort} /> : null}
      <label htmlFor={inputId} className="sr-only">
        {placeholder}
      </label>
      <input
        id={inputId}
        type="search"
        name="q"
        defaultValue={defaultQuery}
        placeholder={placeholder}
        autoComplete="off"
        className="h-12 min-w-0 flex-1 border border-navy-200 bg-transparent px-4 text-sm text-navy-900 placeholder:text-navy-500 focus:border-copper-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
      />
      <button
        type="submit"
        className="pv-btn pv-btn-ink h-12 shrink-0 px-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
      >
        {buttonLabel}
      </button>
    </form>
  );
}
