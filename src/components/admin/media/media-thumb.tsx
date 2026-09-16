import { cn } from '@/lib/cn';

/**
 * 素材缩略图：图片显示缩略图（缺失时回退原图），视频显示 poster 或占位标识。
 *
 * 刻意使用原生 `<img>`：素材由 Nginx 从 /media 提供，不是 Next 的静态资源，
 * 走 next/image 需要额外的 remotePatterns/加载器配置（见 next.config.mjs 的 TODO）。
 */
export function MediaThumb({
  type,
  url,
  thumbnailUrl,
  posterUrl,
  alt,
  fallbackLabel,
  className,
}: {
  type: 'image' | 'video' | 'IMAGE' | 'VIDEO';
  url: string;
  thumbnailUrl?: string | null;
  posterUrl?: string | null;
  alt: string;
  /** 视频无封面时的占位文案 */
  fallbackLabel: string;
  className?: string;
}) {
  const box = cn('overflow-hidden rounded-lg bg-navy-50', className);

  if (type === 'VIDEO' || type === 'video') {
    if (posterUrl) {
      return (
        <div className={box}>
          <video
            src={url}
            poster={posterUrl}
            preload="metadata"
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        </div>
      );
    }

    return (
      <div
        className={cn(
          box,
          'texture-weave-dark flex items-center justify-center bg-navy-900 px-2 text-center text-[11px] font-medium text-ivory-100',
        )}
      >
        <span>{fallbackLabel}</span>
      </div>
    );
  }

  return (
    <div className={box}>
      {/* eslint-disable-next-line @next/next/no-img-element -- 素材为 /media 静态资源，非 Next 优化资源 */}
      <img
        src={thumbnailUrl ?? url}
        alt={alt}
        loading="lazy"
        className="h-full w-full object-cover"
      />
    </div>
  );
}
