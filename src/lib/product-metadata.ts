import { resolveSeo } from '@/lib/seo-fallback';

/**
 * 商品页的 SEO 元数据计算。
 *
 * 抽成纯函数有两个目的：
 *   1. **和后台的灰色占位提示共用同一套规则**（都走 `resolveSeo`）。
 *      需求里特别强调「后台灰色占位符不能只做视觉展示」—— 之前这里和后台各写了一份
 *      `seoTitle || name`，两份实现一旦漂移，后台提示的和前台真正生效的就会不一致；
 *   2. 能被单测直接覆盖 —— `generateMetadata` 长在路由里，不抽出来就没法自动测。
 *
 * 注意「跨语言回退」的边界：
 *   本函数只处理**同一种语言内部**的 SEO → 名称 → 简介回退。
 *   至于「这个商品压根没有阿拉伯语翻译」这种整行缺失，由数据层
 *   `getProductBySlug` 决定（会带回英文并在页面上显示 fallbackNotice），
 *   那是商品级的既有行为，不是 SEO 字段的回退，两者不要混为一谈。
 */

export interface ProductMetadataSource {
  name: string;
  shortDescription: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  coverUrl: string | null;
  coverThumbnailUrl: string | null;
  coverAlt: string | null;
}

export interface ProductMetadataValues {
  title: string;
  /** 全都为空时为 undefined —— 交给 Next 沿用站点级默认描述，而不是编一个 */
  description: string | undefined;
  image: string | undefined;
  imageAlt: string;
}

/** 兜底页面的 SEO 处理结果 */
export interface FallbackSeo {
  /** canonical 指向的地址：有兜底时指向**真正承载这份内容**的语言 */
  canonicalPath: string;
  /** 是否要求搜索引擎不要索引这个地址 */
  noindex: boolean;
}

/**
 * 一个语言页面在**显示别的语言的内容**时，该如何对搜索引擎交代。
 *
 * 问题：`/ar/products/x` 显示的是英文内容。如果放任它被索引，搜索引擎会把它
 * 当成「阿拉伯语版本的 x」收进去 —— 于是同一个英文页面在索引里出现十次，
 * 每次挂着一个不同的语言标签。这是标准的重复内容问题，代价是**每一个**
 * 都排不上去。
 *
 * 三条处理，对应三种事实：
 *   - `noindex, follow` —— 这个地址现在没有它自己语言的内容，先别收；
 *   - canonical 指向**英文本体**（`/en/products/x`）—— 权重与收录都归到那一份；
 *   - 不列进 hreflang（由调用方保证）—— 它本来就不是阿拉伯语内容。
 *
 * 等该语言自己的译文补齐，这三条自动全部撤销：地址回到可索引、canonical 回到
 * 自己、hreflang 与 sitemap 把它加回来。**同一个判断函数同时管开关两边**，
 * 因此不会出现「译文到了、noindex 忘了摘」这种半吊子状态。
 *
 * 严格回退关闭时一律返回「可索引 + canonical 指向自己」—— 那是改造前的行为，
 * 第一阶段部署必须逐字保持。
 */
export function resolveFallbackSeo(input: {
  /** 请求的语言 */
  locale: string;
  /** 实际渲染的语言；与 locale 相同则为 null */
  fallbackLocale: string | null;
  /** `/products/slug` 这样的路径（不含语言前缀） */
  path: string;
  /** 严格语言回退是否开启 */
  strict: boolean;
}): FallbackSeo {
  if (!input.strict || !input.fallbackLocale) {
    return { canonicalPath: `/${input.locale}${input.path}`, noindex: false };
  }
  return { canonicalPath: `/${input.fallbackLocale}${input.path}`, noindex: true };
}

export function resolveProductMetadata(product: ProductMetadataSource): ProductMetadataValues {
  const seo = resolveSeo({
    name: product.name,
    shortDescription: product.shortDescription ?? '',
    seoTitle: product.seoTitle ?? '',
    seoDescription: product.seoDescription ?? '',
  });

  return {
    title: seo.title,
    description: seo.description.trim() || undefined,
    image: product.coverUrl ?? product.coverThumbnailUrl ?? undefined,
    imageAlt: product.coverAlt?.trim() || product.name,
  };
}
