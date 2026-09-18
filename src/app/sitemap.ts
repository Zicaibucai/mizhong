import type { MetadataRoute } from 'next';
import { locales } from '@/lib/i18n';
import { site } from '@/lib/site-config';
import { tryDb } from '@/lib/db';
import { localesWithContent } from '@/lib/catalog';

/**
 * 站点地图。
 *
 * 只列**真实可访问**的地址：某个商品只有中文内容时，就不该出现它的阿拉伯语地址 ——
 * 那会把爬虫引到一个 404 上，属于自伤。
 *
 * 判断用的是 `localesWithContent`（在 src/lib/catalog.ts 里），与目录、hreflang、
 * 面包屑共用同一个函数。三处用同一个判断，才不会出现「地图里有、点进去 404」。
 *
 * 数据库不可用时（构建期或故障中）退化成只列各语言首页 —— 首页在任何语言下都存在
 * （内容为空时回退到内置字典），所以这个降级结果是正确的，不是权宜之计。
 */

/** 站点地图缓存一小时：内容变了不需要立刻反映在 sitemap 里，但也不该永远是旧的 */
export const revalidate = 3600;

/**
 * 查数据库的硬超时。
 *
 * 这一个不是可有可无的：sitemap 原本是纯静态的，现在会查库；而 Prisma 默认
 * **没有查询超时** —— 数据库慢或网络卡住时，这个路由会一直挂着。
 * sitemap 挂住不该影响任何一个访客能看到的页面，所以宁可降级成「只列首页」，
 * 也不要把请求吊在那里。
 */
const DB_TIMEOUT_MS = 5_000;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    work,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]).catch(() => null);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const homeEntries: MetadataRoute.Sitemap = locales.map((locale) => ({
    url: `${site.url}/${locale}`,
    changeFrequency: 'monthly',
    priority: 1,
  }));

  const contentEntries = await withTimeout(
    tryDb(async (db) => {
      const entries: MetadataRoute.Sitemap = [];

      const [products, pages] = await Promise.all([
        db.product.findMany({
          where: { published: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            slug: true,
            updatedAt: true,
            translations: { select: { locale: true, name: true } },
          },
        }),
        db.page.findMany({
          where: { status: 'PUBLISHED', isHome: false },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            slug: true,
            updatedAt: true,
            translations: { select: { locale: true, title: true } },
          },
        }),
      ]);

      for (const product of products) {
        for (const locale of contentLocales(
          product.translations.map((row) => ({ locale: row.locale, text: row.name })),
        )) {
          entries.push({
            url: `${site.url}/${locale}/products/${encodeURIComponent(product.slug)}`,
            lastModified: product.updatedAt,
            changeFrequency: 'weekly',
            priority: 0.8,
          });
        }
      }

      for (const page of pages) {
        for (const locale of contentLocales(
          page.translations.map((row) => ({ locale: row.locale, text: row.title })),
        )) {
          entries.push({
            url: `${site.url}/${locale}/${encodeURIComponent(page.slug)}`,
            lastModified: page.updatedAt,
            changeFrequency: 'monthly',
            priority: 0.6,
          });
        }
      }

      return entries;
    }),
    DB_TIMEOUT_MS,
  );

  return [...homeEntries, ...(contentEntries ?? [])];
}

/**
 * 这条内容在哪些语言下**真的**有内容。
 *
 * 直接用 catalog 里那个 `localesWithContent` —— 与目录、hreflang、面包屑同一条规则、
 * 同一个开关。三处共用一份判断，才不会出现「地图里有、点进去 404」这类自相矛盾；
 * 各写一份的话，严格回退开关一翻就会有一处忘了跟上。
 */
function contentLocales<T extends { locale: string; text: string | null }>(rows: T[]): string[] {
  return localesWithContent(
    rows.map((row) => ({ locale: row.locale as never, name: row.text ?? '' })),
    locales,
  );
}
