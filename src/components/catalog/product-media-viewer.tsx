import type { Locale } from '@/lib/i18n';
import type { ProductMediaView } from '@/lib/catalog';
import { getCatalogDict } from '@/lib/i18n/catalog';
import { cn } from '@/lib/cn';
import { PlayIcon } from '@/components/ui/icons';

/** 缩略图使用的地址：视频优先用封面，图片优先用缩略图 */
function thumbSrc(item: ProductMediaView): string | null {
  if (item.type === 'video') return item.posterUrl ?? item.thumbnailUrl ?? null;
  return item.thumbnailUrl ?? item.url ?? null;
}

function slideId(index: number): string {
  return `pmedia-${index}`;
}

/**
 * 产品详情页媒体查看器：主媒体 + 缩略图列表，图片与视频可切换。
 *
 * 切换用纯 CSS 的 `:target`（样式见 globals.css 的 `.media-stage` 规则），因此
 * **没有 JavaScript 也能切换**，缩略图是真实的锚点链接，键盘可以直接 Tab 到并回车。
 * 每个媒体都带 `scroll-margin-top`，跳转时不会被吸顶的站点头遮住。
 *
 * 视频始终渲染可用的播放器（带 controls、`preload="metadata"` 与 poster），
 * 图片使用原生 <img> 并懒加载。
 */
export function ProductMediaViewer({
  locale,
  items,
  fallbackAlt,
  className,
}: {
  locale: Locale;
  items: ProductMediaView[];
  /** 素材缺少 alt 时使用的替代文本（产品名称） */
  fallbackAlt: string;
  className?: string;
}) {
  const dict = getCatalogDict(locale);
  if (items.length === 0) return null;

  return (
    <div className={className}>
      <div className="media-stage">
        {items.map((item, index) => {
          const label = item.alt.trim() || fallbackAlt;
          const poster = item.posterUrl?.trim() || undefined;

          return (
            <div
              key={item.id}
              id={slideId(index)}
              className="media-slide scroll-mt-24"
              role="group"
              aria-label={`${index + 1} / ${items.length}`}
            >
              {item.type === 'video' && item.url ? (
                <video
                  className="aspect-[4/3] w-full border border-navy-200/80 bg-navy-950 object-contain"
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
                  src={item.url}
                  alt={label}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  className="aspect-[4/3] w-full border border-navy-200/80 bg-white object-cover"
                />
              ) : null}

              {item.caption ? (
                <p className="mt-3 text-sm leading-relaxed text-muted">{item.caption}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      {items.length > 1 ? (
        <ul
          aria-label={dict.detail.mediaThumbnails}
          className="mt-4 flex gap-3 overflow-x-auto pb-1"
        >
          {items.map((item, index) => {
            const src = thumbSrc(item);
            return (
              <li key={item.id} className="shrink-0">
                <a
                  href={`#${slideId(index)}`}
                  aria-label={`${item.type === 'video' ? dict.detail.videoLabel : dict.detail.imageLabel} ${index + 1}`}
                  className="group relative block h-20 w-20 overflow-hidden border border-navy-200 bg-navy-50 transition-colors hover:border-copper-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 素材来自 OSS 动态域名，接入 next/image remotePatterns 后统一替换
                    <img
                      src={src}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center">
                      <PlayIcon className="h-5 w-5 text-navy-400" />
                    </span>
                  )}
                  {item.type === 'video' ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-navy-950/35">
                      <PlayIcon className="h-5 w-5 text-ivory-50" />
                    </span>
                  ) : null}
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** 规格参数表：只渲染有值的行，空行由数据层过滤掉 */
export function ProductSpecTable({
  specs,
  caption,
  className,
}: {
  specs: { id: string; name: string; value: string }[];
  caption?: string;
  className?: string;
}) {
  if (specs.length === 0) return null;

  return (
    <table className={cn('w-full border-collapse border-t border-navy-200 text-left text-sm', className)}>
      {caption ? <caption className="sr-only">{caption}</caption> : null}
      <tbody className="divide-y divide-navy-200">
        {specs.map((spec) => (
          <tr key={spec.id} className="align-top">
            <th
              scope="row"
              className="w-2/5 py-3 pr-4 font-medium text-navy-600 sm:w-1/3"
            >
              {spec.name}
            </th>
            <td className="py-3 text-navy-900">{spec.value || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
