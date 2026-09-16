import type { Locale } from '@/lib/i18n/config';
import { getMediaBySlot, type MediaSlot } from '@/lib/media';
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
 */

type Tone = 'navy' | 'ink' | 'ivory' | 'sand';

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
  slot: MediaSlot;
  locale: Locale;
  /** SVG defs 的唯一前缀（同一页面内不可重复） */
  uid: string;
  /** 覆盖媒体位默认的织纹结构 */
  variant?: WeaveVariant;
  /** 覆盖媒体位默认的色调 */
  tone?: Tone;
  /** 真实素材的替代文本（未绑定素材时用于说明这是生成的装饰图形） */
  alt?: string;
  className?: string;
}

export async function PreviewMedia({
  slot,
  locale,
  uid,
  variant,
  tone,
  alt,
  className,
}: PreviewMediaProps) {
  const asset = await getMediaBySlot(slot, locale);
  const art = SLOT_ART[slot] ?? { variant: 'warp', tone: 'navy' };

  return (
    <div className={cn('pv-plate-art absolute inset-0', className)}>
      {asset ? (
        asset.type === 'video' ? (
          <video
            className="h-full w-full object-cover"
            poster={asset.posterUrl}
            controls
            preload="metadata"
            aria-label={asset.alt[locale]}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- 素材将来自 OSS 动态域名，接入后统一切换到 next/image + remotePatterns
          <img
            src={asset.url}
            alt={asset.alt[locale]}
            loading="lazy"
            className="h-full w-full object-cover"
          />
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
      {!asset && alt ? <span className="sr-only">{alt}</span> : null}
    </div>
  );
}
