import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getDictionary, defaultLocale, isLocale } from '@/lib/i18n';
import { tryDb } from '@/lib/db';
import { findSlugRedirect } from '@/lib/slug-history';

/**
 * 兜底路由的 metadata。
 *
 * 必须写在**路由**里而不是 not-found.tsx 里：notFound() 抛出前，Next 已经解析完
 * 当前路由的 metadata 了，所以 404 边界上的 generateMetadata 不会生效，
 * 页面会继承 site 布局的标题（也就是首页标题），看起来像「这个页面存在」。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const l = isLocale(locale) ? locale : defaultLocale;
  return {
    title: getDictionary(l).notFound.title,
    robots: { index: false, follow: true },
  };
}

/**
 * 兜底路由：接住 /zh|en|vi 下所有**没有对应页面**的地址，交给 (site) 组的
 * not-found.tsx 渲染。
 *
 * 为什么需要它：本项目没有 `src/app/layout.tsx`，三个 route group 各自提供根布局
 * （(site) / (preview) / (admin)）。网址匹配不到任何路由时就没有布局链可用，
 * Next 会退回内置的白页 404 —— 没有页头页脚、没有语言切换、没有任何回目录的入口。
 * 有了这个兜底，走错的网址会落进 site 布局，拿到的是带站点头尾的正式 404。
 *
 * 具体路由优先于 catch-all，所以它不会抢走 /zh/products、/zh/design-preview
 * 等已存在的页面。
 *
 * 顺带做一件事：页面（Page）改过 slug 之后，旧地址在这里被 301 到新地址。
 * 这条查询只在**本来就要 404** 的路径上发生，正常访问一次都不会多查。
 */
export default async function CatchAll({
  params,
}: {
  params: Promise<{ locale: string; rest: string[] }>;
}) {
  const { locale, rest } = await params;
  const l = isLocale(locale) ? locale : defaultLocale;

  // 单段路径才可能是页面 slug；更深的路径（/products/xxx 之类）由各自的页面处理
  if (rest.length === 1) {
    const moved = await tryDb((db) => findSlugRedirect(db, 'page', rest[0]));
    if (moved) permanentRedirect(`/${l}/${encodeURIComponent(moved)}`);
  }

  notFound();
}
