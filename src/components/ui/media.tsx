import type { Locale } from '@/lib/i18n/config';
import { getMediaBySlot, type MediaSlot } from '@/lib/media';
import { cn } from '@/lib/cn';
import { MediaPlaceholder } from './media-placeholder';

interface MediaProps {
  slot: MediaSlot;
  locale: Locale;
  kind?: 'image' | 'video';
  label?: string;
  className?: string;
  priority?: boolean;
}

/**
 * 语义化媒体组件：通过 slot 绑定后台素材。
 * 本阶段 getMediaBySlot 恒返回 null，因此渲染 MediaPlaceholder；
 * 下一阶段素材接入后，自动切换为真实图片/视频。
 */
export async function Media({ slot, locale, kind = 'image', label, className, priority = false }: MediaProps) {
  const asset = await getMediaBySlot(slot, locale);

  if (asset) {
    if (asset.type === 'video') {
      return (
        <video
          className={cn('h-full w-full object-cover', className)}
          poster={asset.posterUrl}
          controls
          preload="metadata"
          aria-label={asset.alt[locale]}
        />
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 素材来自 OSS 动态域名，接入后切换到 next/image + remotePatterns
      <img
        src={asset.url}
        alt={asset.alt[locale]}
        loading={priority ? 'eager' : 'lazy'}
        className={cn('h-full w-full object-cover', className)}
      />
    );
  }

  return <MediaPlaceholder slot={slot} kind={kind} label={label} className={className} />;
}
