import type { Locale } from '@/lib/i18n/config';

export type MediaType = 'image' | 'video';

/** 素材的多语言文本字段（后台素材管理模块的数据形状，本阶段仅定义接口） */
export type LocalizedText = Record<Locale, string>;

/** 素材库资源 */
export interface MediaAsset {
  id: string;
  slot: MediaSlot;
  type: MediaType;
  url: string;
  posterUrl?: string;
  alt: LocalizedText;
  title: LocalizedText;
  width?: number;
  height?: number;
}

/**
 * 语义化媒体位：每个槽位对应站点上一个固定位置，后台可将其绑定到素材库资源。
 * 命名约定：<页面>.<区块>，如 hero.image、product.webbing。
 */
export const MEDIA_SLOTS = {
  /** 品牌 Logo（后台可配置；未上传时不渲染图片） */
  logo: 'brand.logo',
  heroImage: 'hero.image',
  heroVideo: 'hero.video',
  manufacturingImage: 'manufacturing.image',
  manufacturingVideo: 'manufacturing.video',
  qualityImage: 'quality.image',
  product: {
    webbing: 'product.webbing',
    labels: 'product.labels',
    zippers: 'product.zippers',
    elastics: 'product.elastics',
    lace: 'product.lace',
    packaging: 'product.packaging',
  },
  certificate1: 'certificate.1',
  certificate2: 'certificate.2',
  certificate3: 'certificate.3',
} as const;

/** 从 MEDIA_SLOTS 推导出的字面量联合类型，保证槽位拼写编译期可校验 */
type LeafValues<T> = T extends string
  ? T
  : { [K in keyof T]: LeafValues<T[K]> }[keyof T];

export type MediaSlot = LeafValues<typeof MEDIA_SLOTS>;

/** 产品卡片对应的媒体位（顺序与产品分类一一对应） */
export const PRODUCT_MEDIA_SLOTS: readonly MediaSlot[] = [
  MEDIA_SLOTS.product.webbing,
  MEDIA_SLOTS.product.labels,
  MEDIA_SLOTS.product.zippers,
  MEDIA_SLOTS.product.elastics,
  MEDIA_SLOTS.product.lace,
  MEDIA_SLOTS.product.packaging,
];

/**
 * 按槽位取素材。
 * 本阶段后台与数据库尚未实现，恒返回 null（前端渲染占位符）；
 * 下一阶段在此接入 Prisma + OSS：按 slot 查询 SlotBinding → Asset → 生成签名 URL。
 */
export async function getMediaBySlot(slot: MediaSlot, locale: Locale): Promise<MediaAsset | null> {
  void slot;
  void locale;
  return null;
}
