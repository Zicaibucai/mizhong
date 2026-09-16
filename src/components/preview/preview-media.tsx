import type { Locale } from '@/lib/i18n/config';
import { getMediaBySlot, altFor, type MediaSlot } from '@/lib/media';
import { cn } from '@/lib/cn';
import { TextileArtwork, type WeaveVariant } from './textile-artwork';

/**
 * 预览页媒体组件。
 *
 * 与正式站的 `Media` 组件保持同一套语义化媒体位（MEDIA_SLOTS）：
 * 后台素材接入后，这里会自动渲染真实图片 / 视频，无需改动页面结构。
 *
 * 与正式站的区别在**未绑定素材时的回退**：
 *   正式站渲染带「媒体占位」字样的开发占位框；
 *   预览页渲染生成式织纹图形（TextileArtwork），前台不出现任何开发文案。
 *
 * 三种素材来源，优先级从高到低：
 *   1. `asset` —— 调用方已拿到的真实素材（如商品主图）；
 *   2. `slot`  —— 按语义化媒体位查询后台绑定；
 *   3. 生成式织纹图形 —— 装饰性回退，屏幕阅读器会说明它不是产品照片。
 */

type Tone = 'navy' | 'ink' | 'ivory' | 'sand';

export interface PreviewAssetView {
  type?: 'image' | 'video';
  url: string;
  posterUrl?: string | null;
  alt: string;
}

interface ArtSpec {
  variant: WeaveVariant;
  tone: Tone;
}

/** 每个媒体位对应的默认织纹结构与色调（保证不同分类在视觉上可区分） */
const SLOT_ART: Record<string, ArtSpec> = {
  'hero.image': { variant: 'warp', tone: 'navy' },
  'supply.image': { variant: 'twill', tone: 'ink' },
  'quality.image': { variant: 'macro', tone: 'ink' },
  'product.webbing': { variant: 'rib', tone: 'navy' },
  'product.labels': { variant: 'plain', tone: 'sand' },
  'product.zippers': { variant: 'teeth', tone: 'ink' },
  'product.elastics': { variant: 'chevron', tone: 'ivory' },
  'product.lace': { variant: 'net', tone: 'ink' },
  'product.packaging': { variant: 'fold', tone: 'sand' },
};

interface PreviewMediaProps {
  /** 语义化媒体位（可选：调用方直接给 asset 时不需要） */
  slot?: MediaSlot;
  locale: Locale;
  /** SVG defs 的唯一前缀（同一页面内不可重复） */
  uid: string;
  /** 调用方已持有的真实素材（如商品主图），优先于 slot */
  asset?: PreviewAssetView | null;
  /** 覆盖媒体位默认的织纹结构 */
  variant?: WeaveVariant;
  /** 覆盖媒体位默认的色调 */
  tone?: Tone;
  /** 生成式图形对屏幕阅读器的说明（说明它不是产品照片） */
  alt?: string;
  className?: string;
}

export async function PreviewMedia({
  slot,
  locale,
  uid,
  asset,
  variant,
  tone,
  alt,
  className,
}: PreviewMediaProps) {
  // 归一成单一形态，避免「调用方给的素材」与「后台媒体位素材」两套类型在渲染处交叉
  let resolved: {
    type: 'image' | 'video';
    url: string;
    posterUrl: string | null;
    alt: string;
  } | null = null;

  if (asset) {
    resolved = {
      type: asset.type ?? 'image',
      url: asset.url,
      posterUrl: asset.posterUrl ?? null,
      alt: asset.alt,
    };
  } else if (slot) {
    const found = await getMediaBySlot(slot, locale);
    if (found) {
      resolved = {
        type: found.type,
        url: found.url,
        posterUrl: found.posterUrl ?? null,
        alt: altFor(found, locale),
      };
    }
  }

  const art = (slot ? SLOT_ART[slot] : undefined) ?? { variant: 'warp', tone: 'navy' };

  return (
    <div className={cn('pv-plate-art absolute inset-0', className)}>
      {resolved ? (
        resolved.type === 'video' ? (
          <video
            className="h-full w-full object-cover"
            poster={resolved.posterUrl ?? undefined}
            controls
            preload="metadata"
            aria-label={resolved.alt}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- 素材将来自 OSS 动态域名，接入后统一切换到 next/image + remotePatterns
          <img src={resolved.url} alt={resolved.alt} loading="lazy" className="pv-tile-img" />
        )
      ) : (
        <TextileArtwork
          variant={variant ?? art.variant}
          tone={tone ?? art.tone}
          uid={uid}
          className="h-full w-full"
        />
      )}
      {/* 屏幕阅读器说明：这是生成的装饰图形，不是产品照片 */}
      {!resolved && alt ? <span className="sr-only">{alt}</span> : null}
    </div>
  );
}
