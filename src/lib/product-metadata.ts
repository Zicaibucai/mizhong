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
