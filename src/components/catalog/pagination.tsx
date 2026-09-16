import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import { format, getCatalogDict } from '@/lib/i18n/catalog';
import { cn } from '@/lib/cn';
import { ArrowRightIcon } from '@/components/ui/icons';
import { withQuery } from './urls';

const base =
  'inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500';
const enabled = 'border-navy-300 text-navy-900 hover:border-navy-900 hover:bg-navy-50';
const disabled = 'border-navy-200 text-navy-300';

/**
 * 分页：上一页 / 下一页均为真实链接，保留 q 与 category。
 * 页码会被夹在 [1, pageCount] 内，因此永远不会渲染超出总页数的链接。
 */
export function Pagination({
  locale,
  basePath,
  query,
  category,
  page,
  pageCount,
  className,
}: {
  locale: Locale;
  basePath: string;
  query?: string;
  category?: string;
  page: number;
  pageCount: number;
  className?: string;
}) {
  const dict = getCatalogDict(locale);
  const total = Math.max(1, pageCount);
  const current = Math.min(Math.max(1, page), total);
  const label = format(dict.list.pageOf, { page: current, total });

  if (pageCount <= 1) return null;

  const prevPage = current > 1 ? current - 1 : null;
  const nextPage = current < total ? current + 1 : null;

  return (
    <nav
      aria-label={label}
      className={cn(
        'mt-12 flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-sm text-muted">{label}</p>

      <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
        {prevPage ? (
          <Link
            href={withQuery(basePath, { q: query, category, page: prevPage })}
            className={cn(base, enabled)}
          >
            <ArrowRightIcon className="h-4 w-4 rotate-180" />
            {dict.list.prev}
          </Link>
        ) : (
          <span className={cn(base, disabled)} aria-hidden="true">
            <ArrowRightIcon className="h-4 w-4 rotate-180" />
            {dict.list.prev}
          </span>
        )}

        {nextPage ? (
          <Link
            href={withQuery(basePath, { q: query, category, page: nextPage })}
            className={cn(base, enabled)}
          >
            {dict.list.next}
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        ) : (
          <span className={cn(base, disabled)} aria-hidden="true">
            {dict.list.next}
            <ArrowRightIcon className="h-4 w-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
