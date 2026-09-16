import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import type { CategoryView } from '@/lib/catalog';
import { getCatalogDict } from '@/lib/i18n/catalog';
import { cn } from '@/lib/cn';
import { catalogPath, withQuery } from './urls';

interface CategoryFilterProps {
  locale: Locale;
  categories: CategoryView[];
  activeSlug?: string;
  /** 当前搜索词：切分类时保留，保证「搜索 + 分类」可以叠加 */
  query?: string;
  className?: string;
}

const chipBase =
  'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500';
const chipActive = 'border-navy-900 bg-navy-900 text-ivory-50';
const chipIdle = 'border-navy-200 bg-white text-navy-700 hover:border-navy-400 hover:text-navy-900';

/**
 * 分类筛选：真实链接，切换分类时保留关键词并重置页码。
 */
export function CategoryFilter({
  locale,
  categories,
  activeSlug,
  query,
  className,
}: CategoryFilterProps) {
  const dict = getCatalogDict(locale);

  if (categories.length === 0) return null;

  const base = catalogPath(locale);
  const allActive = !activeSlug;

  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-400">
        {dict.list.categoryLabel}
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        <li>
          <Link
            href={withQuery(base, { q: query })}
            aria-current={allActive ? 'true' : undefined}
            className={cn(chipBase, allActive ? chipActive : chipIdle)}
          >
            {dict.list.allCategories}
          </Link>
        </li>
        {categories.map((category) => {
          const active = category.slug === activeSlug;
          return (
            <li key={category.id}>
              <Link
                href={withQuery(base, { q: query, category: category.slug })}
                aria-current={active ? 'true' : undefined}
                className={cn(chipBase, active ? chipActive : chipIdle)}
              >
                {category.name}
                <span className={cn('text-xs', active ? 'text-navy-200' : 'text-navy-400')}>
                  {category.productCount}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
