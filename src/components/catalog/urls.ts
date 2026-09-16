/**
 * 产品目录 / 搜索页面的 URL 与查询参数工具。
 *
 * 页面必须在不依赖客户端 JS 的情况下可用，因此所有筛选、分页都通过真实链接与
 * GET 表单完成；这里只负责在保留现有参数的前提下生成可分享的地址。
 */

export type SearchParamsInput = Record<string, string | string[] | undefined>;

/** 同名参数可能出现多次（?q=a&q=b），统一取第一个值 */
export function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/** 解析页码：非法、0、负数一律回落到第 1 页 */
export function parsePage(raw: string | string[] | undefined): number {
  const value = firstValue(raw);
  if (!value) return 1;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/**
 * 拼接查询字符串。空值（undefined / null / 空串）会被丢弃，保证
 * 「无筛选」时地址干净，不出现 ?q= 这样的空参数。
 */
export function withQuery(
  path: string,
  params: Record<string, string | number | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (!text) continue;
    search.set(key, text);
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export function catalogPath(locale: string): string {
  return `/${locale}/products`;
}

export function productPath(locale: string, slug: string): string {
  return `/${locale}/products/${encodeURIComponent(slug)}`;
}

export function searchPath(locale: string): string {
  return `/${locale}/search`;
}

/**
 * 产品的绝对地址，用于 WhatsApp / 邮件正文。
 * 域名来自 NEXT_PUBLIC_SITE_URL，未配置或格式非法时回退到占位域名（与站点其他位置一致）。
 */
export function absoluteProductUrl(locale: string, slug: string): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim();
  // 未配置域名时的兜底，与 src/lib/site-config.ts 保持一致
  const base = /^https?:\/\//i.test(configured)
    ? configured.replace(/\/+$/, '')
    : 'https://www.example.com';
  return `${base}/${locale}/products/${encodeURIComponent(slug)}`;
}
