import type { AdminLocale } from '@/lib/admin/validation';
import type { ProductTranslationValues } from '@/lib/product-draft';

/**
 * 搜索引擎展示信息（SEO 标题 / 描述）的回退规则。
 *
 * 规则（由需求指定）：
 *   - 优先用**该语言自己**填写的 SEO 标题 / 描述；
 *   - 为空时回退到该语言的商品名称 / 一句话介绍；
 *   - 该语言的名称（或简介）也为空时**保持为空**，绝不拿另一种语言（尤其是中文）
 *     的内容去顶替 —— 阿拉伯语的页面上出现中文标题，比没有标题更糟。
 *
 * 关于「自动生成」与「手动填写」的区分：
 *
 *   存进数据库的 SEO 字段**只保存人工填写的值**。回退值不落库，只在界面上以占位提示
 *   （placeholder）的形式展示。这样做的好处是两者永远不会混淆：
 *   字段为空 = 当前用的是自动回退，字段有值 = 人工填写。
 *   如果把回退值也写进数据库，之后改了商品名，那条「自动」的标题就会变成一条
 *   看起来像人工填写的旧值，再也回退不动了。
 */

export interface SeoResolution {
  title: string;
  /** true 表示标题来自商品名称的回退，而不是人工填写 */
  titleIsFallback: boolean;
  description: string;
  descriptionIsFallback: boolean;
}

export function resolveSeo(
  values: Pick<ProductTranslationValues, 'name' | 'shortDescription' | 'seoTitle' | 'seoDescription'>,
): SeoResolution {
  const manualTitle = values.seoTitle.trim();
  const manualDescription = values.seoDescription.trim();
  const name = values.name.trim();
  const shortDescription = values.shortDescription.trim();

  return {
    title: manualTitle || name,
    titleIsFallback: !manualTitle && Boolean(name),
    description: manualDescription || shortDescription,
    descriptionIsFallback: !manualDescription && Boolean(shortDescription),
  };
}

/** 一次解析全部语言，供编辑器与前台共用 */
export function resolveSeoAll(
  translations: Record<AdminLocale, ProductTranslationValues>,
  locales: readonly AdminLocale[],
): Record<AdminLocale, SeoResolution> {
  return Object.fromEntries(
    locales.map((locale) => [locale, resolveSeo(translations[locale])]),
  ) as Record<AdminLocale, SeoResolution>;
}
