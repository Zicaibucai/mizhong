import type { Locale } from '@/lib/i18n';
import type { ProductCardView } from '@/lib/catalog';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { ImageIcon } from '@/components/ui/icons';
import { ProductCard } from './product-card';

/**
 * 产品网格：目录页与搜索页共用同一套卡片与栅格。
 * 手机端单列，平板两列，桌面三列。
 */
export function ProductGrid({
  locale,
  products,
  className,
}: {
  locale: Locale;
  products: ProductCardView[];
  className?: string;
}) {
  return (
    <ul
      className={cn(
        'grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8',
        className,
      )}
    >
      {products.map((product) => (
        <li key={product.id} className="h-full">
          <ProductCard locale={locale} product={product} />
        </li>
      ))}
    </ul>
  );
}

/** 空状态：提示文案 + 返回完整目录的链接 */
export function CatalogEmptyState({
  message,
  hint,
  actionHref,
  actionLabel,
}: {
  message: string;
  hint?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-navy-200 bg-white px-6 py-16 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-copper-300/60 text-copper-500">
        <ImageIcon className="h-5 w-5" />
      </span>
      <p className="mt-5 text-base font-medium text-navy-900">{message}</p>
      {hint ? <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{hint}</p> : null}
      {actionHref && actionLabel ? (
        <Button href={actionHref} variant="outline" className="mt-7">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
