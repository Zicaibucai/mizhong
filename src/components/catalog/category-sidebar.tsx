import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import type { CategoryView } from '@/lib/catalog';
import { getCatalogDict } from '@/lib/i18n/catalog';
import { cn } from '@/lib/cn';
import { catalogPath, withQuery } from './urls';

interface BaseProps {
  locale: Locale;
  categories: CategoryView[];
  activeSlug?: string;
  /** 当前搜索词：切分类时保留，保证「搜索 + 分类」可以叠加 */
  query?: string;
  /** 当前排序：切分类时保留，避免翻到另一分类后排序被重置 */
  sort?: string;
}

const itemBase =
  'flex w-full items-baseline justify-between gap-3 border-t border-navy-200 px-0 py-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500';
const itemActive = 'border-copper-500 font-medium text-copper-800';
const itemIdle = 'text-navy-700 hover:border-navy-900 hover:text-navy-950';

/** 分类清单：桌面侧栏与移动端展开面板共用同一份链接结构 */
function CategoryLinks({ locale, categories, activeSlug, query, sort }: BaseProps) {
  const dict = getCatalogDict(locale);
  const base = catalogPath(locale);
  const allActive = !activeSlug;

  return (
    <ul className="space-y-1">
      <li>
        <Link
          href={withQuery(base, { q: query, sort })}
          aria-current={allActive ? 'page' : undefined}
          className={cn(itemBase, allActive ? itemActive : itemIdle)}
        >
          <span>{dict.list.allCategories}</span>
        </Link>
      </li>
      {categories.map((category) => {
        const active = category.slug === activeSlug;
        return (
          <li key={category.id}>
            <Link
              href={withQuery(base, { q: query, sort, category: category.slug })}
              aria-current={active ? 'page' : undefined}
              className={cn(itemBase, active ? itemActive : itemIdle)}
            >
              <span className="min-w-0">{category.name}</span>
              <span
                className={cn(
                  'shrink-0 font-mono text-xs',
                  active ? 'text-copper-700' : 'text-navy-500',
                )}
              >
                {category.productCount}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 桌面端分类侧栏（240–280px，可 sticky）。
 *
 * `top-20` 让侧栏吸附在 64px 高的站点头之下，底部留出内边距，
 * 因此既不会遮挡页头，也不会在滚动到底时压住页脚。
 * 分类为 0 时不渲染，由目录页自行处理空状态。
 */
export function CategorySidebar(props: BaseProps & { className?: string }) {
  const dict = getCatalogDict(props.locale);
  if (props.categories.length === 0) return null;

  return (
    <aside className={cn('hidden w-full lg:block lg:w-[264px] lg:shrink-0', props.className)}>
      <nav
        aria-label={dict.list.categorySidebarTitle}
        className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pb-4"
      >
        <p className="pv-mono pb-4 text-[0.58rem] text-copper-700">
          {dict.list.categorySidebarTitle}
        </p>
        <CategoryLinks {...props} />
      </nav>
    </aside>
  );
}

/**
 * 移动端「分类 / 筛选」面板。
 *
 * 用原生 `<details>`：不需要 JavaScript 即可展开，键盘与触摸都能操作，
 * 且默认收起，因此不会永久占用手机端空间。
 * 收起时 summary 里显示当前分类名称，选中状态始终可见。
 */
export function CategoryMobilePanel(props: BaseProps & { className?: string }) {
  const dict = getCatalogDict(props.locale);
  if (props.categories.length === 0) return null;

  const active = props.categories.find((category) => category.slug === props.activeSlug);
  const currentLabel = active?.name ?? dict.list.allCategories;

  return (
    <details className={cn('group border border-navy-200 bg-transparent lg:hidden', props.className)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-navy-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0">{dict.list.filtersButton}</span>
          <span
            className={cn(
              'truncate border px-2.5 py-0.5 text-xs',
              active ? 'border-copper-500 text-copper-800' : 'border-navy-200 text-navy-700',
            )}
          >
            {currentLabel}
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-navy-500 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-navy-100 p-2">
        <CategoryLinks {...props} />
      </div>
    </details>
  );
}
