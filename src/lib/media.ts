import type { Locale } from '@/lib/i18n/config';
import { tryDb } from '@/lib/db';

export type MediaType = 'image' | 'video';

/** 素材的多语言文本字段 */
export type LocalizedText = Record<Locale, string>;

/** 素材库资源（前台视图对象） */
export interface MediaAsset {
  id: string;
  slot: MediaSlot | null;
  type: MediaType;
  url: string;
  thumbnailUrl?: string;
  posterUrl?: string;
  mimeType: string;
  width?: number;
  height?: number;
  alt: LocalizedText;
  title: LocalizedText;
  caption: LocalizedText;
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
  supplyImage: 'supply.image',
  supplyVideo: 'supply.video',
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
type LeafValues<T> = T extends string ? T : { [K in keyof T]: LeafValues<T[K]> }[keyof T];

export type MediaSlot = LeafValues<typeof MEDIA_SLOTS>;

/** 后台「槽位」下拉可选项（含中英文说明） */
export const SLOT_OPTIONS: { value: MediaSlot; label: string }[] = [
  { value: MEDIA_SLOTS.logo, label: 'brand.logo — 品牌 Logo' },
  { value: MEDIA_SLOTS.heroImage, label: 'hero.image — 首页首屏图片' },
  { value: MEDIA_SLOTS.heroVideo, label: 'hero.video — 首页首屏视频' },
  { value: MEDIA_SLOTS.supplyImage, label: 'supply.image — 供应链区块图片' },
  { value: MEDIA_SLOTS.supplyVideo, label: 'supply.video — 供应链区块视频' },
  { value: MEDIA_SLOTS.qualityImage, label: 'quality.image — 质量区块图片' },
  { value: MEDIA_SLOTS.certificate1, label: 'certificate.1 — 证书位 1' },
  { value: MEDIA_SLOTS.certificate2, label: 'certificate.2 — 证书位 2' },
  { value: MEDIA_SLOTS.certificate3, label: 'certificate.3 — 证书位 3' },
];

/** 产品卡片对应的媒体位（顺序与产品分类一一对应） */
export const PRODUCT_MEDIA_SLOTS: readonly MediaSlot[] = [
  MEDIA_SLOTS.product.webbing,
  MEDIA_SLOTS.product.labels,
  MEDIA_SLOTS.product.zippers,
  MEDIA_SLOTS.product.elastics,
  MEDIA_SLOTS.product.lace,
  MEDIA_SLOTS.product.packaging,
];

interface AssetRow {
  id: string;
  type: 'IMAGE' | 'VIDEO';
  url: string;
  thumbnailUrl: string | null;
  posterUrl: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  translations: { locale: Locale; title: string | null; caption: string | null; alt: string | null }[];
}

/** 取多语言字段，按语言逐项填充（缺失由调用方回退英文） */
function localizedText(
  translations: AssetRow['translations'],
  field: 'title' | 'caption' | 'alt',
): LocalizedText {
  const pick = (target: Locale) =>
    translations.find((item) => item.locale === target)?.[field] ?? '';
  return { zh: pick('zh'), en: pick('en'), vi: pick('vi') };
}

export function toMediaAsset(asset: AssetRow, slot: MediaSlot | null): MediaAsset {
  const alt = localizedText(asset.translations, 'alt');
  const title = localizedText(asset.translations, 'title');
  const caption = localizedText(asset.translations, 'caption');

  return {
    id: asset.id,
    slot,
    type: asset.type === 'VIDEO' ? 'video' : 'image',
    url: asset.url,
    thumbnailUrl: asset.thumbnailUrl ?? undefined,
    posterUrl: asset.posterUrl ?? undefined,
    mimeType: asset.mimeType,
    width: asset.width ?? undefined,
    height: asset.height ?? undefined,
    alt,
    title,
    caption,
  };
}

/** 当前语言下的 alt（缺失回退英文，再回退空串） */
export function altFor(asset: MediaAsset, locale: Locale): string {
  return asset.alt[locale] || asset.alt.en || '';
}

/**
 * 按槽位取素材。
 * 未绑定、素材被停用或数据库不可用时返回 null，由调用方渲染占位符。
 *
 * `locale` 保留在签名中：当前 SlotBinding 与语言无关（返回的 alt/title/caption 已含全部语言），
 * 但调用方与后续「按语言绑定不同素材」的扩展都会用到它，因此不删除该参数。
 */
export async function getMediaBySlot(slot: MediaSlot, locale: Locale): Promise<MediaAsset | null> {
  void locale;

  const bindings = await tryDb((db) =>
    db.slotBinding.findMany({
      where: { slot, asset: { enabled: true } },
      orderBy: [{ position: 'asc' }],
      take: 1,
      include: { asset: { include: { translations: true } } },
    }),
  );

  const binding = bindings?.[0];
  if (!binding) return null;
  return toMediaAsset(binding.asset, slot);
}

/** 批量取槽位（用于证书位等重复区块） */
export async function getMediaBySlots(
  slots: readonly MediaSlot[],
  locale: Locale,
): Promise<Record<string, MediaAsset | null>> {
  const entries = await Promise.all(
    slots.map(async (slot) => [slot, await getMediaBySlot(slot, locale)] as const),
  );
  return Object.fromEntries(entries);
}
