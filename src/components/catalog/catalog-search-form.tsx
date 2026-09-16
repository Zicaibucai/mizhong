import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';

interface CatalogSearchFormProps {
  /** 表单提交地址（GET），例如 /zh/products */
  action: string;
  defaultQuery?: string;
  /** 存在时作为隐藏字段随搜索一起提交，保证在分类内搜索不会丢失分类 */
  category?: string;
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
  placeholder,
  buttonLabel,
  className,
}: CatalogSearchFormProps) {
  const inputId = `catalog-search-${action.replace(/\W+/g, '-')}`;

  return (
    <form action={action} method="get" role="search" className={cn('flex w-full gap-2', className)}>
      {category ? <input type="hidden" name="category" value={category} /> : null}
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
        className="h-11 min-w-0 flex-1 rounded-full border border-navy-200 bg-white px-5 text-sm text-navy-900 placeholder:text-navy-400 focus:border-navy-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
      />
      <Button type="submit" variant="primary">
        {buttonLabel}
      </Button>
    </form>
  );
}
