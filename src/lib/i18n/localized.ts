import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';

/**
 * 多语言结构的通用工具。
 *
 * 放在这里而不是某个具体业务模块里，是因为「每种语言一份」这个模式在
 * 商品、分类、导航、联系方式、公司资料、素材等所有后台表单里都要用。
 *
 * 存在的意义只有一个：**让「加了语言却漏改一处」变成编译错误，而不是运行时的 undefined。**
 * 在这之前，代码里到处是手写的 `{ zh: …, en: …, vi: … }`，加语言时只能靠人肉搜索。
 */

/** 造一个「每个语言一份」的记录 */
export function localizedRecord<T>(make: (locale: AdminLocale) => T): Record<AdminLocale, T> {
  return Object.fromEntries(ADMIN_LOCALES.map((locale) => [locale, make(locale)])) as Record<
    AdminLocale,
    T
  >;
}

/**
 * 多语言文本取值：当前语言 → 英文 → 其余语言里第一个非空的。
 *
 * 前台商品查询、后台列表、媒体库原本各自硬编码着 zh/en/vi 的逐级回退，
 * 集中到这里之后，加语言时它们全部自动跟上。
 */
export function pickLocalized(
  values: Record<AdminLocale, string> | undefined | null,
  locale: AdminLocale,
): string {
  if (!values) return '';
  const direct = values[locale]?.trim();
  if (direct) return direct;
  const english = values.en?.trim();
  if (english) return english;
  for (const candidate of ADMIN_LOCALES) {
    const value = values[candidate]?.trim();
    if (value) return value;
  }
  return '';
}
