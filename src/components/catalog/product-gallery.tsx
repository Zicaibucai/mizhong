import type { ProductMediaView } from '@/lib/catalog';

/**
 * 产品图库：按后台保存的顺序展示图片与视频。
 *
 * - 图片使用原生 <img>（素材来自 OSS 动态域名，配置 next/image remotePatterns 后可无缝替换）并懒加载；
 * - 视频始终渲染可用播放器：poster 缺失时依然输出 <source>，不会出现空白播放器，
 *   也不会在没有地址时渲染 <video>。
 */
export function ProductGallery({
  items,
  fallbackAlt,
  className,
}: {
  items: ProductMediaView[];
  /** 素材缺少 alt 时使用的替代文本（产品名称） */
  fallbackAlt: string;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <ul className={className}>
      {items.map((item) => {
        const label = item.alt.trim() || fallbackAlt;
        const poster = item.posterUrl?.trim() || undefined;

        return (
          <li key={item.id}>
            {item.type === 'video' && item.url ? (
              <video
                className="aspect-[4/3] w-full rounded-xl border border-navy-200/80 bg-navy-950 object-cover"
                controls
                preload="metadata"
                poster={poster}
                aria-label={label}
              >
                <source src={item.url} />
              </video>
            ) : item.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- 素材来自 OSS 动态域名，接入 next/image remotePatterns 后统一替换
              <img
                src={item.thumbnailUrl ?? item.url}
                alt={label}
                loading="lazy"
                className="aspect-[4/3] w-full rounded-xl border border-navy-200/80 bg-white object-cover"
              />
            ) : null}
            {item.caption ? (
              <p className="mt-2.5 text-sm leading-relaxed text-muted">{item.caption}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
